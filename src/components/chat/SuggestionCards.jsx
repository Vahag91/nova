import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SvgIcon from '../SvgIcon';

const SuggestionCards = ({ onSuggestionPress }) => {
  // Debuggers removed (focus on voice only)
  const { t } = useTranslation();

  const safeTitle = (v, fallback) => {
    if (typeof v === 'string') return v;
    if (v == null) return fallback;
    try { return String(v); } catch { return fallback; }
  };

  const items = useMemo(() => {
    const list = [
      {
        id: 'create-images',
        icon: 'studio',
        title: safeTitle(t('chat.quickActions.createImages', { defaultValue: 'Create Images' }), 'Create Images'),
      },
      {
        id: 'camera',
        icon: 'photo',
        title: safeTitle(t('chat.camera', { defaultValue: 'Camera' }), 'Camera'),
      },
      {
        id: 'edit-image',
        icon: 'layers',
        title: safeTitle(t('chat.quickActions.editImage', { defaultValue: 'Edit Image' }), 'Edit Image'),
      },
      {
        id: 'start-voice',
        icon: 'mic',
        title: safeTitle(t('chat.quickActions.startVoice', { defaultValue: 'Start Voice' }), 'Start Voice'),
      },
      {
        id: 'assistants',
        icon: 'assistants',
        title: safeTitle(t('chat.quickActions.assistants', { defaultValue: 'Assistants' }), 'Assistants'),
      },
    ];
    // Ensure it is an array of valid items
    return Array.isArray(list)
      ? list.filter((s, idx) => s && typeof s.icon === 'string' && (typeof s.id === 'string' || (s.id = `sugg_${idx}`)))
      : [];
  }, [t]);

  const handlePress = (suggestion) => {
    if (!suggestion) return;
    try { typeof onSuggestionPress === 'function' && onSuggestionPress(suggestion); } catch {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.shell}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {(Array.isArray(items) ? items : []).map((suggestion) => (
            <TouchableOpacity
              key={suggestion.id}
              style={styles.chip}
              activeOpacity={0.85}
              onPress={() => handlePress(suggestion)}
            >
              <View style={styles.iconWrap}>
                <SvgIcon name={suggestion.icon} size={24} color="#75FBFD" />
              </View>
              <Text style={styles.chipLabel}>{suggestion.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({

  shell: {
    borderRadius: 24,
    paddingVertical: 4,
    marginHorizontal: 8,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0e0e0fff',
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: 2,
    // minHeight: 70,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chipLabel: {
    color: '#F9FAFB',
    fontSize: 14,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.35,
  },
});

// Ignore function identity churn; re-render still occurs on i18n context changes
export default memo(SuggestionCards, () => true);
