import React, { memo } from 'react';
import { View, Text, ScrollView } from 'react-native';

const ModelGuidance = memo(({ model, mode }) => {
  const getGuidance = (modelKey, currentMode) => {
    const guidance = {
      'runware-flux-dev': {
        title: 'FLUX.1 dev (Default)',
        description: 'Best all-rounder; use for most text2img and img2img.',
        settings: {
          text2img: 'Steps 28–30, CFG 9',
          img2img: 'Steps 28–30, CFG 9, Strength ~0.85'
        },
        tips: [
          'Great for creative and artistic images',
          'Handles complex prompts well',
          'Good balance of quality and speed'
        ]
      },
      'runware-flux-canny': {
        title: 'FLUX.1 Canny',
        description: 'Preserves structure from an edge map. If user supplies a normal photo, it\'ll still work, just looser.',
        settings: {
          text2img: 'Not recommended for text2img',
          img2img: 'Steps 22–28, CFG 7–9, Strength 0.65–0.85'
        },
        tips: [
          'Best with edge maps or structured images',
          'Maintains composition and structure',
          'Good for architectural or geometric subjects'
        ]
      },
      'runware-sdxl-civitai': {
        title: 'SDXL (Civitai)',
        description: 'Best for photoreal images and nuanced styles at 1024².',
        settings: {
          text2img: 'Steps ~30, CFG 7–8',
          img2img: 'Steps ~30, CFG 7–8, Strength 0.5–0.7'
        },
        tips: [
          'Excellent for photorealistic images',
          'Great for portraits and detailed scenes',
          'Best quality at 1024x1024 resolution'
        ]
      }
    };

    return guidance[modelKey] || null;
  };

  const modelInfo = getGuidance(model, mode);
  
  if (!modelInfo) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{modelInfo.title}</Text>
      <Text style={styles.description}>{modelInfo.description}</Text>
      
      <View style={styles.settingsContainer}>
        <Text style={styles.settingsTitle}>Recommended Settings:</Text>
        <Text style={styles.settingsText}>
          {mode === 'text2img' ? modelInfo.settings.text2img : modelInfo.settings.img2img}
        </Text>
      </View>

      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Tips:</Text>
        {modelInfo.tips.map((tip, index) => (
          <Text key={index} style={styles.tipText}>• {tip}</Text>
        ))}
      </View>
    </View>
  );
});

const styles = {
  container: {
    padding: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#B0B0B0',
    fontFamily: 'Lato-Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  settingsContainer: {
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00E0C7',
    fontFamily: 'Lato-Bold',
    marginBottom: 4,
  },
  settingsText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Lato-Regular',
  },
  tipsContainer: {
    backgroundColor: '#2A2A2A',
    padding: 12,
    borderRadius: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00E0C7',
    fontFamily: 'Lato-Bold',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    color: '#B0B0B0',
    fontFamily: 'Lato-Regular',
    lineHeight: 18,
    marginBottom: 2,
  },
};

export default ModelGuidance;
