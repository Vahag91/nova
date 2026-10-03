import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { submitAiContentReport } from '../../api/reportContent';

const REASON_OPTIONS = [
  'sexual',
  'violence_self_harm',
  'hate_harassment',
  'child_safety',
  'scam_deceptive',
  'other',
];

export default function ReportContentModal({
  visible,
  report,
  privateDisclosure = false,
  onClose,
  onSubmitted,
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setSubmitting(false);
    setError('');
    setSubmitted(false);
  }, [visible, report]);

  const handleSubmit = async () => {
    if (!reason) {
      setError(t('reportContent.errors.reasonRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitAiContentReport({
        ...(report || {}),
        reason,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch {
      setError(t('reportContent.errors.submit'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose?.();
  };

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.sheet}>
          {submitted ? (
            <View style={styles.confirmation}>
              <Text style={styles.title}>{t('reportContent.success.title')}</Text>
              <Text style={styles.subtitle}>
                {t('reportContent.success.subtitle')}
              </Text>
              <Pressable
                onPress={handleClose}
                style={[styles.button, styles.submitButton]}
                accessibilityRole="button"
              >
                <Text style={styles.submitText}>{t('reportContent.actions.done')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{t('reportContent.title')}</Text>
              <Text style={styles.subtitle}>
                {t('reportContent.subtitle')}
              </Text>
              {privateDisclosure ? (
                <Text style={styles.disclosure}>
                  {t('reportContent.privateDisclosure')}
                </Text>
              ) : null}

              <ScrollView
                style={styles.optionsScroll}
                contentContainerStyle={styles.options}
              >
                {REASON_OPTIONS.map(option => {
                  const selected = option === reason;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setReason(option);
                        setError('');
                      }}
                      style={[styles.reason, selected && styles.reasonSelected]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={styles.reasonLabel}>
                        {t(`reportContent.reasons.${option}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.buttons}>
                <Pressable
                  onPress={handleClose}
                  style={[styles.button, styles.cancelButton]}
                  disabled={submitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  style={[
                    styles.button,
                    styles.submitButton,
                    submitting && styles.disabledButton,
                  ]}
                  disabled={submitting}
                  accessibilityRole="button"
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>
                      {t('reportContent.actions.submit')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    backgroundColor: '#2D2D31',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 22,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  disclosure: {
    color: '#A6A6AB',
    backgroundColor: '#232326',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  optionsScroll: {
    maxHeight: 278,
  },
  options: {
    gap: 8,
  },
  reason: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: '#232326',
  },
  reasonSelected: {
    borderColor: '#F05A28',
    backgroundColor: '#39393E',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.46)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#F05A28',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F05A28',
  },
  reasonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  error: {
    color: '#FF8F8F',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#F05A28',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.7,
  },
  confirmation: {
    paddingTop: 10,
    paddingBottom: 6,
  },
});
