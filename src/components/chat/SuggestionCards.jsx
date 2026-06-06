import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SvgIcon from '../SvgIcon';

const SuggestionCards = ({ onSuggestionPress }) => {
  const { t } = useTranslation();

  const safeTitle = (value, fallback) => {
    if (typeof value === 'string') return value;
    if (value == null) return fallback;
    try {
      return String(value);
    } catch {
      return fallback;
    }
  };

  const items = useMemo(() => {
    const list = [
      {
        id: 'create-images',
        icon: 'studio',
        title: safeTitle(
          t('chat.quickActions.createImages', { defaultValue: 'Create Images' }),
          'Create Images',
        ),
        color: '#00BCD4',
      },
      {
        id: 'edit-image',
        icon: 'layers',
        title: safeTitle(
          t('chat.quickActions.editImage', { defaultValue: 'Edit Image' }),
          'Edit Image',
        ),
        color: '#F19E39',
      },
      {
        id: 'open-camera',
        icon: 'photo',
        title: safeTitle(t('chat.camera', { defaultValue: 'Camera' }), 'Camera'),
        color: '#75FB4C',
      },
      {
        id: 'start-voice',
        icon: 'mic',
        title: safeTitle(
          t('chat.quickActions.startVoice', { defaultValue: 'Start Voice' }),
          'Start Voice',
        ),
        color: '#FF6B6B',
      },
      {
        id: 'assistants',
        icon: 'assistants',
        title: safeTitle(
          t('chat.quickActions.assistants', { defaultValue: 'Assistants' }),
          'Assistants',
        ),
        color: '#A78BFA',
      },
    ];

    return Array.isArray(list)
      ? list.filter(
          (item, index) =>
            item &&
            typeof item.icon === 'string' &&
            (typeof item.id === 'string' || (item.id = `sugg_${index}`)),
        )
      : [];
  }, [t]);

  const handlePress = suggestion => {
    if (!suggestion) return;
    try {
      typeof onSuggestionPress === 'function' && onSuggestionPress(suggestion);
    } catch {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.shell}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {(Array.isArray(items) ? items : []).map(suggestion => (
            <TouchableOpacity
              key={suggestion.id}
              style={styles.chip}
              activeOpacity={0.85}
              onPress={() => handlePress(suggestion)}
            >
              <View style={styles.iconWrap}>
                <SvgIcon
                  name={suggestion.icon}
                  size={24}
                  color={suggestion.color || '#75FBFD'}
                />
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
  container: {
    paddingBottom: 12,
  },
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
    backgroundColor: '#0E0E0F',
    borderRadius: 22,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  chipLabel: {
    color: '#F9FAFB',
    fontSize: 14,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.35,
  },
});

export default memo(SuggestionCards, () => true);
