import React, { memo, useState, useRef } from 'react';
import { Image, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

export const MarkdownImage = memo(({ uri, alt }) => {
  const { t } = useTranslation();
  const screenW = Dimensions.get('window').width; 
  const H_PAD = 32;
  const IMAGE_MAX_W = 300;
  const lockedWRef = useRef(Math.min(screenW - H_PAD * 2, IMAGE_MAX_W));
  const [ratio, setRatio] = useState(16 / 9);

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={alt || t('chat.image')}
      resizeMode="contain"
      onLoad={(e) => {
        const s = e?.nativeEvent?.source;
        if (s?.width && s?.height) setRatio(s.width / s.height);
      }}
      style={{
        width: lockedWRef.current,
        aspectRatio: ratio,
        alignSelf: 'flex-start',
        borderRadius: 12,
        marginTop: 8,
        marginBottom: 8,
        backgroundColor: '#252525',
      }}
    />
  );
}, (prev, next) => prev.uri === next.uri);
