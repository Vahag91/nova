import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Video, { ViewType } from 'react-native-video';
import { perfEnd, perfLog, perfStart } from '../../lib/perfTrace';

const DEFAULT_VIDEO = require('../../../assets/video/hero.mp4');
const WATCHDOG_INTERVAL_MS = 1000;
const WATCHDOG_IDLE_MS = 2500;

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
  const didMountRef = useRef(false);
  const isReadyRef = useRef(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [playerInstanceKey, setPlayerInstanceKey] = useState(0);

  const playlist = useMemo(() => {
    if (Array.isArray(sources) && sources.length) {
      return sources;
    }

    return [source || DEFAULT_VIDEO];
  }, [source, sources]);

  const usesLocalSource = useMemo(() => (
    playlist.every(item => {
      if (typeof item === 'number') {
        return true;
      }

      const uri = item?.uri;
      if (typeof uri !== 'string' || !uri.length) {
        return false;
      }

      return !/^https?:\/\//i.test(uri);
    })
  ), [playlist]);

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

  const restart = useCallback((reason = 'manual', { forceReload = false } = {}) => {
    const now = Date.now();
    if (paused || now - lastRestartAtRef.current < 4000) {
      return;
    }

    lastRestartAtRef.current = now;
    clearPendingRestart();
    perfLog('hero_video.restart', {
      sourceIndex,
      reason,
      forceReload,
    });
    isReadyRef.current = false;
    if (forceReload) {
      setPlayerInstanceKey(key => key + 1);
      bumpTick();
      return;
    }

    seekToStart();
  }, [bumpTick, clearPendingRestart, paused, seekToStart, sourceIndex]);

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
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    clearPendingRestart();
    bufferingRef.current = false;
    if (sourceIndex !== 0) {
      isReadyRef.current = false;
      setSourceIndex(0);
      bumpTick();
      return;
    }

    if (isReadyRef.current) {
      seekToStart();
      return;
    }

    bumpTick();
  }, [bumpTick, clearPendingRestart, restartKey, seekToStart, sourceIndex]);

  useEffect(() => {
    clearPendingRestart();
    bufferingRef.current = false;
    isReadyRef.current = false;
    setSourceIndex(0);
    bumpTick();
  }, [bumpTick, clearPendingRestart, playlist]);

  useEffect(() => {
    clearPendingRestart();
    bufferingRef.current = false;
    isReadyRef.current = false;
    bumpTick();
  }, [bumpTick, clearPendingRestart, sourceIndex]);

  useEffect(() => {
    if (paused) {
      return undefined;
    }

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastTickRef.current;
      if (!isReadyRef.current || bufferingRef.current || idleMs < WATCHDOG_IDLE_MS) {
        return;
      }

      perfLog('hero_video.watchdog_restart', {
        sourceIndex,
        idleMs,
      });
      restart('watchdog', { forceReload: true });
    }, WATCHDOG_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [paused, restart, sourceIndex]);

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
        key={`${playerInstanceKey}:${sourceIndex}`}
        ref={videoRef}
        source={playlist[sourceIndex] || playlist[0]}
        style={styles.video}
        resizeMode="cover"
        hideShutterView={Platform.OS === 'android'}
        repeat={playlist.length <= 1}
        muted
        paused={paused}
        viewType={Platform.OS === 'android' ? ViewType.TEXTURE : undefined}
        ignoreSilentSwitch="obey"
        playInBackground={false}
        playWhenInactive={false}
        progressUpdateInterval={1000}
        bufferConfig={usesLocalSource ? undefined : {
          minBufferMs: 2500,
          maxBufferMs: 10000,
          bufferForPlaybackMs: 250,
          bufferForPlaybackAfterRebufferMs: 500,
        }}
        onLoad={event => {
          clearPendingRestart();
          isReadyRef.current = true;
          bufferingRef.current = false;
          perfEnd('hero_video.load', {
            sourceIndex,
            duration: event?.duration,
          });
          bumpTick();
        }}
        onLoadStart={() => {
          clearPendingRestart();
          isReadyRef.current = false;
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
            isReadyRef.current = false;
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
            restart('stalled', { forceReload: true });
          }, 1200);
        }}
        onError={event => {
          clearPendingRestart();
          isReadyRef.current = false;
          perfLog('hero_video.error', {
            sourceIndex,
            error: event?.nativeEvent?.error,
          });

          if (event?.nativeEvent?.error) {
            restart('error', { forceReload: true });
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
