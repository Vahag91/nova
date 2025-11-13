import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import RateUsService from '../services/RateUsService';
import { colors } from '../styles/colors';

const { width } = Dimensions.get('window');

const RateUsModal = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);

  const handleRateNow = async () => {
    try {
      setSubmitted(true);
      // Mark as rated BEFORE showing prompt (user intent to rate)
      await RateUsService.markAsRated();
      // Then show the native review dialog or open store
      await RateUsService.showRatePrompt();
      onClose();
    } catch (error) {
      onClose();
    } finally {
      setSubmitted(false);
    }
  };

  const handleMaybeLater = async () => {
    try {
      // Mark that we showed the prompt today
      await RateUsService.markPromptShown();
      onClose();
    } catch (error) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Ionicons name="star" size={35} color="#FFD700" />
            <Text style={styles.title}>{t('rateUs.title')}</Text>
            <Text style={styles.subtitle}>
              {t('rateUs.subtitle')}
            </Text>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleRateNow}
              disabled={submitted}
            >
              {submitted ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {t('rateUs.rateNow')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleMaybeLater}
            >
              <Text style={styles.secondaryButtonText}>
                {t('rateUs.maybeLater')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    borderRadius: 15,
    padding: 15,
    margin: 20,
    width: width - 40,
    maxWidth: 310,
    alignItems: 'center',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 7,
    marginBottom: 3,
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    color: colors.textSecondary,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});

export default RateUsModal;

