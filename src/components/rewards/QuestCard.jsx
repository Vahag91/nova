import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import SvgIcon from '../SvgIcon';

const iconMap = {
  share: 'share',
  share_upload: 'share-upload',
  confirmation_number: 'confirmation-number',
  facebook: 'facebook',
  twitter: 'twitter',
  instagram: 'instagram',
  rate_review: 'rate-review',
  daily_login: 'daily-login',
};

// Background based on quest type
const getIconBgColor = (icon) => {
  const colorMap = {
    share: 'rgba(59, 130, 246, 0.1)',
    share_upload: 'rgba(14, 165, 233, 0.1)',
    confirmation_number: 'rgba(34, 197, 94, 0.1)',
    facebook: 'rgba(89, 133, 225, 0.1)', // #5985E1 with 10% opacity
    twitter: 'rgba(117, 251, 76, 0.1)', // #75FB4C with 10% opacity
    instagram: 'rgba(225, 48, 108, 0.1)', // Instagram purple with 10% opacity
    rate_review: 'rgba(223, 157, 155, 0.1)', // #DF9D9B with 10% opacity
    daily_login: 'rgba(206, 168, 188, 0.1)', // #CEA8BC with 10% opacity
  };
  return colorMap[icon] || 'rgba(59, 130, 246, 0.1)';
};

// Icon color based on quest type
const getIconColor = (icon) => {
  const colorMap = {
    share: '#3B82F6',
    share_upload: '#0EA5E9',
    confirmation_number: '#22C55E',
    facebook: '#5985E1',
    twitter: '#75FB4C',
    instagram: '#E1306C', // Instagram purple
    rate_review: '#DF9D9B',
    daily_login: '#CEA8BC',
  };
  return colorMap[icon] || '#3B82F6';
};

// Map quest IDs to icon names
const getIconFromQuestId = (questId) => {
  const idToIconMap = {
    'daily-login': 'daily_login',
    'share-facebook': 'facebook',
    'share-twitter': 'twitter',
    'share-instagram': 'instagram',
  };
  return idToIconMap[questId] || 'share';
};

export const QuestCard = ({ quest, onPress }) => {
  const { t } = useTranslation();
  
  if (!quest) return null;

  // Get icon from quest.id if quest.icon is not available
  const iconKey = quest.icon || getIconFromQuestId(quest.id);
  const iconBgColor = getIconBgColor(iconKey);
  const iconColor = getIconColor(iconKey);
  const iconName = iconMap[iconKey] || iconKey || 'star';

  // Get localized title and description
  const getQuestTranslationKey = (questId) => {
    const keyMap = {
      'daily-login': 'dailyLogin',
      'share-facebook': 'shareFacebook',
      'share-twitter': 'shareTwitter',
      'share-instagram': 'shareInstagram',
    };
    return keyMap[questId] || questId;
  };

  const translationKey = getQuestTranslationKey(quest.id);
  const localizedTitle = t(`rewards.quests.${translationKey}.title`, { defaultValue: quest.title });
  const localizedDescription = t(`rewards.quests.${translationKey}.description`, { defaultValue: quest.description });

  return (
    <Pressable
      onPress={() => onPress?.(quest)}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      {/* LEFT SIDE */}
      <View style={styles.cardLeft}>
        <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
          <SvgIcon name={iconName} size={22} color={iconColor} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.questTitle} numberOfLines={1}>
            {localizedTitle}
          </Text>
          <Text style={styles.questSubtitle} numberOfLines={1}>
            {localizedDescription}
          </Text>
        </View>
      </View>

      {/* RIGHT: POINTS */}
      <View style={styles.rewardBadge}>
        <View style={styles.rewardIconBg}>
          <View style={styles.rewardDot} />
        </View>
        <Text style={styles.rewardText}>+{quest.points}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#121212',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,

    borderWidth: 1,
    borderColor: '#2A2A2A',

    minHeight: 78,               // Slightly taller for breathing room
    columnGap: 10,
  },

  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,            // ensure text never overlaps icon
    flexShrink: 0,
  },

  textContainer: {
    flex: 1,
    minWidth: 0,                // allows flex shrink
    maxWidth: '100%',           // prevent overflow
    justifyContent: 'center',
  },

  questTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
    color: '#E5E7EB',
    maxWidth: '100%',
  },

  questSubtitle: {
    fontSize: 12,
    marginTop: 3,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Lato-Regular',
    maxWidth: '100%',
  },

  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginLeft: 12,
    flexShrink: 0,
  },

  rewardIconBg: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  rewardDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
  },

  rewardText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
    color: '#FFFFFF',
  },
});

export default QuestCard;
