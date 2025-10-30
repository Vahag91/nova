import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import SvgIcon from '../components/SvgIcon';
import { useImagesStore } from '../state/useImagesStore';
import { normalizeImageUri } from '../lib/imageUtils';
import { createSbWithDevice, fetchBalanceByDevice } from '../lib/supabaseDevice';
import { ensureDeviceId } from '../lib/deviceId';
import ImageViewer from '../components/image-studio/ImageViewer';
import LinearGradient from 'react-native-linear-gradient';

const CARD_ASPECT = 16 / 9;

export default function StudioHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Coin balance
  const [coins, setCoins] = useState(null);
  const [coinsLoading, setCoinsLoading] = useState(false);
  const coinsClientRef = useRef(null);
  const deviceIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const id = await ensureDeviceId();
        deviceIdRef.current = id;
        const sb = createSbWithDevice(id);
        coinsClientRef.current = sb;
        setCoinsLoading(true);
        const bal = await fetchBalanceByDevice(sb, id);
        if (mounted) setCoins(bal);
      } catch (e) {
        if (mounted) setCoins(null);
      } finally {
        if (mounted) setCoinsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Recent images from jobs store
  const jobs = useImagesStore(s => s.jobs);
  const images = useMemo(() => {
    const done = (jobs || []).filter(j => j?.status === 'done');
    const result = done.flatMap((j, jdx) => (j.images || []).map((img, idx) => {
      const normalizedUrl = normalizeImageUri(img?.url);
      const uniqueId = img?.id ? `${j.id}:${img.id}` : `${j.id || 'job'}:${jdx}:${idx}`;
      return normalizedUrl ? {
        id: uniqueId,
        jobId: j.id,
        url: normalizedUrl,
        prompt: j.prompt,
        size: j.size || '1024x1024',
        model: j.model,
      } : null;
    })).filter(Boolean);
    return result;
  }, [jobs]);

  // Gallery items: show all generated images; if none, show 12 placeholders
  const galleryItems = useMemo(() => {
    if (images && images.length > 0) return images;
    const sampleUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAjRrGSQFCi5mPBdzF3JJuAt9QYTX6gyLnnkka81WYPawmAaDKIeGJeoPOKC5ymFP6wIhgGGZVoVc-7WqRqRNxrSlzmUyy9t7Q8y6ebprl24e7hdgmJb3p0nC1lv7Le4SUTfHA6TYedMiI0XfLJOPLHZic7K_WubvCWDCFVBsd1ar4yeot5S0oD6Qds9kENx8pDEMIo80PyVzYPLqARrNR0Fl3mzrpFLDGXjM8wpxBCnHRn-nlNz8TsazzgPdS_YoiDYFH_AgTfGns';
    return Array.from({ length: 12 }).map((_, i) => ({ id: `sample-${i}`, url: sampleUrl }));
  }, [images]);

  // Viewer
  const [viewer, setViewer] = useState({ open: false, uri: '' });

  const openCreate = useCallback(() => {
    navigation.navigate('CreateImage');
  }, [navigation]);

  const openEdit = useCallback(() => {
    navigation.navigate('EditImage');
  }, [navigation]);

  const renderTile = useCallback(({ item }) => {
    const size = (Dimensions.get('window').width - 4 * 12) / 3; // 3 cols, 12 padding/gap
    return (
      <Pressable
        onPress={() => setViewer({ open: true, uri: item.url })}
        style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A1A1D' }}
      >
        <ImageBackground source={{ uri: item.url }} style={{ flex: 1 }} resizeMode="cover" />
      </Pressable>
    );
  }, []);

  // Dynamic styles
  const headerStyle = React.useMemo(
    () => [styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }],
    [insets.top]
  );
  const listContentStyle = React.useMemo(
    () => [styles.listContent, { paddingBottom: Math.max(insets.bottom, 24) }],
    [insets.bottom]
  );
  const tileSize = React.useMemo(() => (Dimensions.get('window').width - 4 * 12) / 3, []);
  const tileDynamicStyle = React.useMemo(() => ({ width: tileSize, height: tileSize }), [tileSize]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={headerStyle}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.toggleDrawer?.()}
            style={styles.headerBackBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
          >
            <SvgIcon name="menu" size={22} color="#FFFFFF" />
          </Pressable>
          <View pointerEvents="none" style={styles.headerCenterAbs}>
            <Text style={styles.headerTitle}>Studio</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('CoinStore')} style={styles.balancePill} hitSlop={8}>
            <Text style={styles.balanceText}>{coinsLoading ? '…' : `◈ ${coins ?? '—'}`}</Text>
          </Pressable>
        </View>
      </View>

      {/* Body */}
      <FlatList
        contentContainerStyle={listContentStyle}
        ListHeaderComponent={
          <View style={styles.headerGroup}>
            {/* Create Card */}
            <View style={styles.card}>
              <ImageBackground
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-XK95pOLT3s1Iw3iXY2Pxm6JUU1YFayAsX4mfcrudaLGfOlGdOpA6qZ07Pcz0bkV8BPM8hMRbM9b8MFwsEWL94VxmhQieasdG_ySE5koYRA3fq1ZHEztxO7ROIpdc6gEvJNukMahpveSr_QabORA0hi18hnDEQsPVNTzQhRA3eKC-5dOOSOFU-TtonfkNQdb1FEJbnuy4ywe848HkQNDF0sDPxjDR5lAPt5lsjqcXMpCatHSKi1VvTwaNy_hPn-tG6MmNNcfihI_T' }}
                style={styles.absoluteFill}
                resizeMode="cover"
                imageStyle={styles.cardBg}
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.05)"]}
                locations={[0, 0.4, 1]}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.cardOverlay}
              />
              <View style={styles.cardContent}>
                <View style={styles.labelPill}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardIconWrap}><SvgIcon name="quill" size={22} color="#FFFFFF" /></View>
                    <View style={styles.cardTextCol}>
                      <Text style={styles.cardTitle}>Create from Text</Text>
                      <Text style={styles.cardSubtitle}>Type a description</Text>
                    </View>
                  </View>
                </View>
                <Pressable onPress={openCreate} style={[styles.primaryBtn]} hitSlop={6}>
                  <Text style={styles.primaryBtnText}>Describe & Generate (2 ◈)</Text>
                </Pressable>
              </View>
            </View>

            {/* Edit Card */}
            <View style={styles.card}>
              <ImageBackground
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDilC2rDw4UyF9DZ0AduIlFILbuyRQZaYwYn6CAUYGQr3wX1dSefDL_sMXpdoHMlz0GU3xRzT7DRNdqBGhZ-N9hSjEDVRl5JzWY9GqZJFLrGfu-js0GnD-1gGyKqviePvzACPt7vGz6gL2LZxFOEfz6mDxPR2S6jq_VBMfzFzxv_mg-Um637W8zwOtNIiYY7lTSWoYo_7WyETvy-6XTqA2GpvAH1OpRRyj14Nv1NX_INxfHSo0q4-PH7Iid2H7j4reA2QV7Q0eWXn-Q' }}
                style={styles.absoluteFill}
                resizeMode="cover"
                imageStyle={styles.cardBg}
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.05)"]}
                locations={[0, 0.4, 1]}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.cardOverlay}
              />
              <View style={styles.cardContent}>
                <View style={styles.labelPill}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardIconWrap}><SvgIcon name="photo" size={22} color="#FFFFFF" /></View>
                    <View style={styles.cardTextCol}>
                      <Text style={styles.cardTitle}>Edit a Photo</Text>
                      <Text style={styles.cardSubtitle}>Upload & edit</Text>
                    </View>
                  </View>
                </View>
                <Pressable onPress={openEdit} style={[styles.secondaryBtn]} hitSlop={6}>
                  <Text style={styles.secondaryBtnText}>Choose Photo</Text>
                </Pressable>
              </View>
            </View>

            {/* Gallery header */}
            <Text style={styles.sectionHeader}>Gallery</Text>
          </View>
        }
        data={galleryItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setViewer({ open: true, uri: item.url, id: item.id, jobId: item.jobId })}
            style={[styles.tile, tileDynamicStyle]}
          >
            <ImageBackground source={{ uri: item.url }} style={styles.flex1} resizeMode="cover" />
          </Pressable>
        )}
        numColumns={3}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={null}
        showsVerticalScrollIndicator={false}
      />

      {/* Image viewer modal */}
      <ImageViewer
        visible={viewer.open}
        imageUri={viewer.uri}
        imageId={viewer.id}
        jobId={viewer.jobId}
        onClose={() => setViewer({ open: false, uri: '', id: null, jobId: null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  absoluteFill: { ...StyleSheet.absoluteFillObject },
  flex1: { flex: 1 },
  header: {
    paddingVertical: 22,
    backgroundColor: 'rgba(11,11,14,0.92)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, position: 'relative' },
  headerBackBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenterAbs: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  balancePill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17171C',
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  balanceText: { color: '#7C5CFF', fontSize: 14, fontWeight: '800' },

  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#17171C',
    aspectRatio: CARD_ASPECT,
  },
  cardBg: { transform: [{ scale: 1.02 }] },
  cardOverlay: { ...StyleSheet.absoluteFillObject },
  cardContent: { flex: 1, justifyContent: 'flex-end', padding: 16, gap: 10 },
  labelPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  cardTextCol: { maxWidth: '82%' },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cardSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 1 },

  primaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C5CFF' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  sectionHeader: { marginTop: 8, marginBottom: 8, color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  emptyText: { color: 'rgba(255,255,255,0.65)', paddingVertical: 24 },
  listContent: { padding: 12 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  headerGroup: { gap: 12 },
  tile: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A1A1D' },
});
