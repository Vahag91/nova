import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Video from 'react-native-video';

const DEFAULT_VIDEO = require('../../../assets/video/hero.mp4');

export default function HeroVideo({
  style,
  restartKey,
  source = DEFAULT_VIDEO,
  sources,
  enforceAspectRatio = true,
  placeholderColor = '#0B1020',
  // optional: pass paused from parent if you want to stop when screen not focused
  paused = false,
}) {
  const videoRef = useRef(null);
  const lastTickRef = useRef(Date.now());           // ← ref instead of state
  const [sourceIndex, setSourceIndex] = useState(0);

  const playlist = useMemo(() => {
    if (Array.isArray(sources) && sources.length) return sources;
    return [source || DEFAULT_VIDEO];
  }, [source, sources]);

  const bumpTick = useCallback(() => {
    lastTickRef.current = Date.now();
  }, []);

  const restart = useCallback(() => {
    try {
      videoRef.current?.seek?.(0);
    } catch { /* no-op */ }
    bumpTick();
  }, [bumpTick]);

  // Watchdog: if playback stalls >6s, seek to 0
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastTickRef.current > 6000) restart();
    }, 5000);
    return () => clearInterval(id);
  }, [restart]); // ← stable, not tied to every progress tick

  // Restart on key or playlist length change
  useEffect(() => {
    setSourceIndex(0);
    restart();
  }, [restartKey, playlist.length, restart]);

  // Reset index when playlist object changes
  useEffect(() => {
    setSourceIndex(0);
  }, [playlist]);

  // When index changes, ensure we start from 0
  useEffect(() => {
    try { videoRef.current?.seek?.(0); } catch {}
    bumpTick();
  }, [sourceIndex, bumpTick]);

  return (
    <View
      style={[
        styles.base,
        enforceAspectRatio && styles.aspect,
        { backgroundColor: placeholderColor },
        style,
      ]}
    >
      <Video
        ref={videoRef}
        source={playlist[sourceIndex] || playlist[0]}
        style={styles.video}
        resizeMode="cover"
        repeat
        muted
        paused={paused}                 // ← keep playing unless parent pauses it
        ignoreSilentSwitch="obey"
        playInBackground={false}
        playWhenInactive={false}
        onLoad={bumpTick}
        onBuffer={bumpTick}
        onProgress={bumpTick}           // ← no setState here; no re-render spam
        onEnd={() => {
          if (playlist.length > 1) {
            setSourceIndex(i => (i + 1) % playlist.length);
          }
          // if single source, let `repeat` handle the loop (no manual restart)
        }}
        onPlaybackStalled={restart}
        onError={(e) => {
          console.warn('HeroVideo error:', e?.nativeEvent);
          restart();
        }}
        // Android note: if you ever see cover-cropping glitches, try:
        // useTextureView={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#0B1020',
  },
  aspect: { aspectRatio: 4 / 5 },
  video: { ...StyleSheet.absoluteFillObject },
});
