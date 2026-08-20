import { Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

const QUICK_ACTION_ICON_PATHS = Object.freeze({
  studio:
    'M480-480ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h320v80H200v560h560v-320h80v320q0 33-23.5 56.5T760-120H200Zm40-160h480L570-480 450-320l-90-120-120 160Zm440-320v-80h-80v-80h80v-80h80v80h80v80h-80v80h-80Z',
  layers:
    'M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Zm481-424-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z',
  photo:
    'M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM160-120q-33 0-56.5-23.5T80-200v-480q0-33 23.5-56.5T160-760h126l74-80h240l74 80h126q33 0 56.5 23.5T880-680v480q0 33-23.5 56.5T800-120H160Zm0-80h640v-480H638l-73-80H395l-73 80H160v480Zm320-240Z',
  mic:
    'M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm0-240Zm-40 520v-123q-104-14-172-93t-68-184h80q0 83 58.5 141.5T480-320q83 0 141.5-58.5T680-520h80q0 105-68 184t-172 93v123h-80Zm40-360q17 0 28.5-11.5T520-520v-240q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760v240q0 17 11.5 28.5T480-480Z',
  assistants:
    'M411-480q-28 0-46-21t-13-49l12-72q8-43 40.5-70.5T480-720q44 0 76.5 27.5T597-622l12 72q5 28-13 49t-46 21H411Zm24-80h91l-8-49q-2-14-13-22.5t-25-8.5q-14 0-24.5 8.5T443-609l-8 49ZM124-441q-23 1-39.5-9T63-481q-2-9-1-18t5-17q0 1-1-4-2-2-10-24-2-12 3-23t13-19l2-2q2-19 15.5-32t33.5-13q3 0 19 4l3-1q5-5 13-7.5t17-2.5q11 0 19.5 3.5T208-626q1 0 1.5.5t1.5.5q14 1 24.5 8.5T251-596q2 7 1.5 13.5T250-570q0 1 1 4 7 7 11 15.5t4 17.5q0 4-6 21-1 2 0 4l2 16q0 21-17.5 36T202-441h-78Zm676 1q-33 0-56.5-23.5T720-520q0-12 3.5-22.5T733-563l-28-25q-10-8-3.5-20t18.5-12h80q33 0 56.5 23.5T880-540v20q0 33-23.5 56.5T800-440ZM0-240v-63q0-44 44.5-70.5T160-400q13 0 25 .5t23 2.5q-14 20-21 43t-7 49v65H0Zm240 0v-65q0-65 66.5-105T480-450q108 0 174 40t66 105v65H240Zm560-160q72 0 116 26.5t44 70.5v63H780v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5Zm-320 30q-57 0-102 15t-53 35h311q-9-20-53.5-35T480-370Zm0 50Zm1-280Z',
});

const QuickActionIcon = memo(({ name, color }) => (
  <Svg
    width={36}
    height={36}
    viewBox="-240 -1200 1440 1440"
    style={styles.icon}
    pointerEvents="none"
  >
    <Path d={QUICK_ACTION_ICON_PATHS[name]} fill={color} />
  </Svg>
));

const SuggestionCards = ({
  onSuggestionPress,
  imagePickerActive = false,
}) => {
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
    <ScrollView
      horizontal
      style={styles.container}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {(Array.isArray(items) ? items : []).map(suggestion => {
        const disabled = imagePickerActive && suggestion.id === 'open-camera';
        return (
          <Pressable
            key={suggestion.id}
            style={({ pressed }) => [
              styles.chip,
              disabled && styles.chipDisabled,
              pressed && !disabled && styles.chipPressed,
            ]}
            onPress={() => handlePress(suggestion)}
            disabled={disabled}
          >
            <QuickActionIcon
              name={suggestion.icon}
              color={suggestion.color || '#75FBFD'}
            />
            <Text style={styles.chipLabel}>{suggestion.title}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    marginHorizontal: 8,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
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
  icon: {
    marginRight: 6,
  },
  chipLabel: {
    color: '#F9FAFB',
    fontSize: 14,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.35,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipPressed: {
    opacity: 0.85,
  },
});

export default memo(
  SuggestionCards,
  (prev, next) =>
    prev.imagePickerActive === next.imagePickerActive &&
    prev.onSuggestionPress === next.onSuggestionPress,
);
