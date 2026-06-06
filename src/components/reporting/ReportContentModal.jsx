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
import { submitAiContentReport } from '../../api/reportContent';

const REASON_OPTIONS = [
  { key: 'sexual', label: 'Sexual or nudity content' },
  { key: 'violence_self_harm', label: 'Violence or self-harm' },
  { key: 'hate_harassment', label: 'Hate or harassment' },
  { key: 'child_safety', label: 'Child safety concern' },
  { key: 'scam_deceptive', label: 'Scam or deceptive content' },
  { key: 'other', label: 'Other' },
];

const SUBMIT_ERROR = 'Could not submit report. Please try again.';

export default function ReportContentModal({
  visible,
  report,
  privateDisclosure = false,
  onClose,
  onSubmitted,
}) {
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
      setError('Please choose a reason before submitting.');
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
    } catch (submissionError) {
      setError(submissionError?.message || SUBMIT_ERROR);
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
              <Text style={styles.title}>Thanks. Your report was submitted.</Text>
              <Text style={styles.subtitle}>
                We will use reports to improve content safety.
              </Text>
              <Pressable
                onPress={handleClose}
                style={[styles.button, styles.submitButton]}
                accessibilityRole="button"
              >
                <Text style={styles.submitText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Report AI content</Text>
              <Text style={styles.subtitle}>
                Tell us what is wrong with this generated content.
              </Text>
              {privateDisclosure ? (
                <Text style={styles.disclosure}>
                  Submitting sends this reported content for safety review.
                </Text>
              ) : null}

              <ScrollView
                style={styles.optionsScroll}
                contentContainerStyle={styles.options}
              >
                {REASON_OPTIONS.map(option => {
                  const selected = option.key === reason;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => {
                        setReason(option.key);
                        setError('');
                      }}
                      style={[styles.reason, selected && styles.reasonSelected]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={styles.reasonLabel}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {!!error && <Text style={styles.error}>{error || SUBMIT_ERROR}</Text>}

              <View style={styles.buttons}>
                <Pressable
                  onPress={handleClose}
                  style={[styles.button, styles.cancelButton]}
                  disabled={submitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
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
                    <Text style={styles.submitText}>Submit Report</Text>
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
    backgroundColor: '#15151C',
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
    color: '#F7C46C',
    backgroundColor: 'rgba(247,196,108,0.12)',
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
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  reasonSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139,92,246,0.16)',
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
    borderColor: '#A78BFA',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#A78BFA',
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
    backgroundColor: '#8B5CF6',
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
