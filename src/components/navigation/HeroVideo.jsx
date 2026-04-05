import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { perfEnd, perfLog, perfStart } from '../../lib/perfTrace';

const DEFAULT_VIDEO = require('../../../assets/video/hero.mp4');

export default function HeroVideo({
  style,
  restartKey,
  source = DEFAULT_VIDEO,
  sources,
  enforceAspectRatio = true,
  placeholderColor = '#0B1020',
  paused = false,
}) {
  const videoRef = useRef(null);
  const bufferingRef = useRef(false);
  const stalledRestartTimeoutRef = useRef(null);
  const lastTickRef = useRef(Date.now());
  const lastRestartAtRef = useRef(0);
  const [sourceIndex, setSourceIndex] = useState(0);

  const playlist = useMemo(() => {
    if (Array.isArray(sources) && sources.length) {
      return sources;
    }

    return [source || DEFAULT_VIDEO];
  }, [source, sources]);

  const bumpTick = useCallback(() => {
    lastTickRef.current = Date.now();
  }, []);

  const clearPendingRestart = useCallback(() => {
    if (stalledRestartTimeoutRef.current) {
      clearTimeout(stalledRestartTimeoutRef.current);
      stalledRestartTimeoutRef.current = null;
    }
  }, []);

  const seekToStart = useCallback(() => {
    try {
      videoRef.current?.seek?.(0);
    } catch {}

    bumpTick();
  }, [bumpTick]);

  const restart = useCallback((reason = 'manual') => {
    const now = Date.now();
    if (paused || now - lastRestartAtRef.current < 4000) {
      return;
    }

    lastRestartAtRef.current = now;
    clearPendingRestart();
    perfLog('hero_video.restart', {
      sourceIndex,
      reason,
    });
    seekToStart();
  }, [clearPendingRestart, paused, seekToStart, sourceIndex]);

  useEffect(() => {
    perfLog('hero_video.mounted', {
      playlistLength: playlist.length,
      paused,
    });

    return () => {
      clearPendingRestart();
      perfLog('hero_video.unmounted');
    };
  }, [clearPendingRestart, paused, playlist.length]);

  useEffect(() => {
    clearPendingRestart();
    setSourceIndex(0);
    seekToStart();
  }, [clearPendingRestart, restartKey, playlist.length, seekToStart]);

  useEffect(() => {
    setSourceIndex(0);
  }, [playlist]);

  useEffect(() => {
    clearPendingRestart();
    seekToStart();
  }, [clearPendingRestart, sourceIndex, seekToStart]);

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
        repeat={playlist.length <= 1}
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
        onLoad={event => {
          clearPendingRestart();
          perfEnd('hero_video.load', {
            sourceIndex,
            duration: event?.duration,
          });
          bumpTick();
        }}
        onLoadStart={() => {
          clearPendingRestart();
          perfStart('hero_video.load', {
            sourceIndex,
            paused,
          });
          bumpTick();
        }}
        onBuffer={event => {
          const isBuffering = !!event?.isBuffering;
          if (bufferingRef.current !== isBuffering) {
            bufferingRef.current = isBuffering;
            perfLog('hero_video.buffer', {
              sourceIndex,
              isBuffering,
            });
          }
          bumpTick();
        }}
        onProgress={bumpTick}
        onEnd={() => {
          clearPendingRestart();
          perfLog('hero_video.end', {
            sourceIndex,
            playlistLength: playlist.length,
          });

          if (playlist.length > 1) {
            setSourceIndex(index => (index + 1) % playlist.length);
          }
        }}
        onPlaybackStalled={() => {
          perfLog('hero_video.stalled', {
            sourceIndex,
          });

          clearPendingRestart();
          stalledRestartTimeoutRef.current = setTimeout(() => {
            stalledRestartTimeoutRef.current = null;
            const idleMs = Date.now() - lastTickRef.current;
            if (paused || bufferingRef.current || idleMs <= 1500) {
              return;
            }

            perfLog('hero_video.stalled_restart', {
              sourceIndex,
              idleMs,
            });
            restart('stalled');
          }, 1200);
        }}
        onError={event => {
          clearPendingRestart();
          perfLog('hero_video.error', {
            sourceIndex,
            error: event?.nativeEvent?.error,
          });

          if (event?.nativeEvent?.error) {
            restart('error');
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
