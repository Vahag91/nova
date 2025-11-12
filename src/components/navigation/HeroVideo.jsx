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

  // Watchdog: if playback stalls >8s, seek to 0 (less aggressive)
  useEffect(() => {
    if (paused) return; // Don't check when paused
    const id = setInterval(() => {
      if (!paused && Date.now() - lastTickRef.current > 8000) {
        restart();
      }
    }, 3000);
    return () => clearInterval(id);
  }, [restart, paused]);

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
        paused={paused}
        ignoreSilentSwitch="obey"
        playInBackground={false}
        playWhenInactive={false}
        progressUpdateInterval={250}
        bufferConfig={{
          minBufferMs: 15000,
          maxBufferMs: 50000,
          bufferForPlaybackMs: 2500,
          bufferForPlaybackAfterRebufferMs: 5000,
        }}
        onLoad={bumpTick}
        onLoadStart={bumpTick}
        onBuffer={bumpTick}
        onProgress={bumpTick}
        onEnd={() => {
          if (playlist.length > 1) {
            setSourceIndex(i => (i + 1) % playlist.length);
          }
          // if single source, let `repeat` handle the loop (no manual restart)
        }}
        onPlaybackStalled={() => {
          // Only restart if actually stalled, not just buffering
          setTimeout(() => {
            if (Date.now() - lastTickRef.current > 3000) {
              restart();
            }
          }, 1000);
        }}
        onError={(e) => {
          console.warn('HeroVideo error:', e?.nativeEvent);
          // Only restart on actual errors, not warnings
          if (e?.nativeEvent?.error?.errorCode) {
            restart();
          }
        }}
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
