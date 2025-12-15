import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  runOnJS 
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors } from '../../styles/colors';
import SvgIcon from '../SvgIcon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

export const QuestCompletedModal = ({ visible, quest, onClose }) => {
  const { t } = useTranslation();
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    } else {
      opacity.value = 0;
      scale.value = 0.8;
    }
  }, [visible]);

  const handleClose = () => {
    opacity.value = withTiming(0, { duration: 150 });
    scale.value = withTiming(0.9, { duration: 150 }, (finished) => {
      if (finished && onClose) {
        runOnJS(onClose)();
      }
    });
  };

  const animatedBackdrop = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible || !quest) return null;

  // Get localized quest title
  const getQuestTranslationKey = (questId) => {
    const keyMap = {
      'daily-login': 'dailyLogin',
      'share-facebook': 'shareFacebook',
      'share-twitter': 'shareTwitter',
      'share-instagram': 'shareInstagram',
      'share-experience': 'shareExperience',
    };
    return keyMap[questId] || questId;
  };

  const translationKey = getQuestTranslationKey(quest.id);
  const localizedTitle = t(`rewards.quests.${translationKey}.title`, { defaultValue: quest.title || t('rewards.modals.questCompleted.title') });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Modern Backdrop with Blur Effect */}
        <AnimatedPressable 
          style={[styles.backdrop, animatedBackdrop]} 
          onPress={handleClose} 
        />

        {/* Card */}
        <AnimatedView style={[styles.card, animatedCard]}>
          
          {/* Checkmark Icon */}
          <View style={styles.iconCircle}>
            <SvgIcon name="check" size={24} color="#FFF" />
          </View>

          {/* Title */}
          <Text style={styles.title}>{localizedTitle}</Text>

          {/* Description */}
          <Text style={styles.description}>
            {t('rewards.modals.questCompleted.description')}
          </Text>

          {/* Points - Simple */}
          <View style={styles.pointsRow}>
            <SvgIcon name="coin" size={16} color="#FFD700" />
            <Text style={styles.pointsText}>
              {(() => {
                const template = t('rewards.modals.questCompleted.points');
                // Replace {{points}} with actual value
                return template.replace('{{points}}', String(quest.points || 0));
              })()}
            </Text>
          </View>

          {/* Button */}
          <Pressable 
            style={({ pressed }) => [
              styles.button, 
              pressed && styles.buttonPressed
            ]}
            onPress={handleClose}
          >
            <Text style={styles.buttonText}>{t('rewards.modals.questCompleted.close')}</Text>
          </Pressable>

        </AnimatedView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  card: {
    width: '85%',
    maxWidth: 300,
    backgroundColor: '#1A1A1A',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  
  // Icon
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Text
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    fontFamily: 'Lato-Regular',
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 12,
  },

  // Points
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
    color: '#FFD700',
  },

  // Button
  button: {
    width: '100%',
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
    color: '#000000',
  },
});
