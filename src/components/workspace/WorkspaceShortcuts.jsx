import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SvgIcon from '../SvgIcon';
import { useWorkspaceTranslation } from '../../i18n/useWorkspaceTranslation';
import { useSourceWorkspaceAvailability } from '../../state/useSourceWorkspaceAvailability';

export default function WorkspaceShortcuts({ navigation, documents = [] }) {
  const { c } = useWorkspaceTranslation();
  const documentsEnabled = useSourceWorkspaceAvailability('document');
  const videosEnabled = useSourceWorkspaceAvailability('video');
  return (
    <View style={styles.row}>
      {documentsEnabled && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            styles.documents,
            pressed && styles.pressed,
          ]}
          onPress={() =>
            navigation.navigate('Documents', {
              seedDocuments: documents,
              seedId: String(Date.now()),
            })
          }
        >
          <SvgIcon name="workspace-document" size={22} color="#E9C99E" />
          <Text style={styles.text}>{c('documents', 'Documents')}</Text>
        </Pressable>
      )}
      {videosEnabled && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            styles.video,
            pressed && styles.pressed,
          ]}
          onPress={() => navigation.navigate('VideoSummaries')}
        >
          <SvgIcon name="workspace-video" size={22} color="#D1BDEB" />
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
    paddingHorizontal: 12,
    gap: 12,
    paddingVertical: 4,
  },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#0E0E0F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexShrink: 1,
  },
  documents: { backgroundColor: '#29241F', borderColor: '#4A3D2D' },
  video: { backgroundColor: '#28222E', borderColor: '#473650' },
  art: { width: 28, height: 32 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.8 },
  text: {
    color: '#F9FAFB',
    fontSize: 14,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.35,
    flexShrink: 1,
  },
});
