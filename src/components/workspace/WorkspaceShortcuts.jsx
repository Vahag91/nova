import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SvgIcon from '../SvgIcon';
import { useWorkspaceTranslation } from '../../i18n/useWorkspaceTranslation';
import { useSourceWorkspaceAvailability } from '../../state/useSourceWorkspaceAvailability';
import { graphite } from '../../styles/graphite';

export default function WorkspaceShortcuts({ navigation, documents = [] }) {
  const { c } = useWorkspaceTranslation();
  const documentsEnabled = useSourceWorkspaceAvailability('document');
  const videosEnabled = useSourceWorkspaceAvailability('video');
  return (
    <View style={styles.row}>
      {documentsEnabled && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={() =>
            navigation.navigate('Documents', {
              seedDocuments: documents,
              seedId: String(Date.now()),
            })
          }
        >
          <SvgIcon name="workspace-document" size={18} color={graphite.accent} />
          <Text style={styles.text}>{c('documents', 'Documents')}</Text>
        </Pressable>
      )}
      {videosEnabled && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={() => navigation.navigate('VideoSummaries')}
        >
          <SvgIcon name="workspace-video" size={18} color={graphite.accent} />
          <Text style={styles.text}>{c('videos', 'Video summaries')}</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  button: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: graphite.card,
    flexShrink: 1,
  },
  pressed: { backgroundColor: graphite.pressed },
  text: {
    color: graphite.text,
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
});
