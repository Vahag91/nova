import { View, Text, StyleSheet, Image } from 'react-native';
import { colors } from '../../styles/colors';
import { PRESETS } from '../../data/presets';
import { useTranslation } from 'react-i18next';

export default function AssistantHeader({ thread, showOnlyWhenEmpty = false }) {
  const { t } = useTranslation();
  const fallbackCopy = {
    title: t('chat.assistantHeader.unavailableTitle', { defaultValue: 'Assistant unavailable' }),
    description: t('chat.assistantHeader.unavailableDescription', { defaultValue: 'We couldn’t load this assistant. Please try again.' }),
  };

  // Source conversations use the summary and standard chat composer, not a preset persona.
  const hasMessages = thread?.messages?.some(m => m.role !== 'system');
  if (thread?.meta?.workspaceId || (showOnlyWhenEmpty && hasMessages)) return null;

  // Resolve assistant persona text (prefer thread.system, fallback to a system message)
  const systemText = thread?.system || thread?.messages?.find(m => m.role === 'system')?.content || '';
  if (!systemText) return null;

  // Find matching preset by system prompt
  const preset = PRESETS.find(p => p.system === systemText);
  if (!preset) {
    return (
      <View style={styles.wrapper}>
        <Image
          source={PRESETS[0].avatar} // Use first preset's avatar as fallback
          style={styles.assistantPhoto}
          resizeMode="cover"
        />
        <Text style={styles.title}>{fallbackCopy.title}</Text>
        <Text style={styles.description}>{fallbackCopy.description}</Text>
      </View>
    );
  }

  const titleText = preset.id
    ? t(`assistants.presets.${preset.id}.name`, { defaultValue: preset.name })
    : fallbackCopy.title;
  const descriptionText = preset.id
    ? t(`assistants.presets.${preset.id}.description`, { defaultValue: preset.description })
    : fallbackCopy.description;
  
  // Use the preset's avatar directly
  const assistantPhoto = preset.avatar;

  return (
    <View style={styles.wrapper}>
      {/* Assistant photo */}
      <Image
        source={assistantPhoto}
        style={styles.assistantPhoto}
        resizeMode="cover"
      />
      
      {/* Title */}
      <Text style={styles.title}>{titleText}</Text>
      
      {/* Description */}
      <Text style={styles.description}>{descriptionText}</Text>
      
      {/* Status indicator */}
      <View style={styles.statusRow}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{t('chat.assistantHeader.ready', { defaultValue: 'Ready to assist' })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  assistantPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.primary,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
