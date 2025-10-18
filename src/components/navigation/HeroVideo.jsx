import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Video from 'react-native-video';

const DEFAULT_VIDEO = require('../../../assets/video/hero.mp4');

export default function HeroVideo({
  style,
  restartKey,
  source = DEFAULT_VIDEO,
  enforceAspectRatio = true,
  placeholderColor = '#0B1020',
}) {
  const videoRef = useRef(null);
  const [lastTick, setLastTick] = useState(Date.now());

  const restart = useCallback(() => {
    try {
      const player = videoRef.current;
      if (player?.seek) player.seek(0);
    } catch {}
    setLastTick(Date.now());
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastTick > 6000) {
        restart();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [lastTick, restart]);

  useEffect(() => {
    if (restartKey != null) {
      restart();
    }
  }, [restart, restartKey]);

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
        source={source}
        style={styles.video}
        resizeMode="cover"
        repeat
        muted
        paused={false}
        ignoreSilentSwitch="obey"
        playInBackground={false}
        playWhenInactive={false}
        onLoad={() => {
          setLastTick(Date.now());
        }}
        onEnd={() => {
          restart();
        }}
        onPlaybackStalled={restart}
        onError={(e) => {
          console.warn('HeroVideo error:', e?.nativeEvent);
          restart();
        }}
        onProgress={() => setLastTick(Date.now())}
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
  aspect: {
    aspectRatio: 4 / 5,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
});
