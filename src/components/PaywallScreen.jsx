// SubscriptionScreen.js
import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    ScrollView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import SvgIcon from './SvgIcon';
// Custom SVG Icons
const CloseIcon = ({ color = '#FFFFFF', size = 24 }) => (
    <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
        <Path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
    </Svg>
);

const PerplexityIcon = ({ color = '#EA33F7', size = 24 }) => (
    <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
        <Path d="M240-40q-50 0-85-35t-35-85q0-50 35-85t85-35q14 0 26 3t23 8l57-71q-28-31-39-70t-5-78l-81-27q-17 25-43 40t-58 15q-50 0-85-35T0-580q0-50 35-85t85-35q50 0 85 35t35 85v8l81 28q20-36 53.5-61t75.5-32v-87q-39-11-64.5-42.5T360-840q0-50 35-85t85-35q50 0 85 35t35 85q0 42-26 73.5T510-724v87q42 7 75.5 32t53.5 61l81-28v-8q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-32 0-58.5-15T739-515l-81 27q6 39-5 77.5T614-340l57 70q11-5 23-7.5t26-2.5q50 0 85 35t35 85q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-20 6.5-38.5T624-232l-57-71q-41 23-87.5 23T392-303l-56 71q11 15 17.5 33.5T360-160q0 50-35 85t-85 35ZM120-540q17 0 28.5-11.5T160-580q0-17-11.5-28.5T120-620q-17 0-28.5 11.5T80-580q0 17 11.5 28.5T120-540Zm120 420q17 0 28.5-11.5T280-160q0-17-11.5-28.5T240-200q-17 0-28.5 11.5T200-160q0 17 11.5 28.5T240-120Zm240-680q17 0 28.5-11.5T520-840q0-17-11.5-28.5T480-880q-17 0-28.5 11.5T440-840q0 17 11.5 28.5T480-800Zm0 440q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29Zm240 240q17 0 28.5-11.5T760-160q0-17-11.5-28.5T720-200q-17 0-28.5 11.5T680-160q0 17 11.5 28.5T720-120Zm120-420q17 0 28.5-11.5T880-580q0-17-11.5-28.5T840-620q-17 0-28.5 11.5T800-580q0 17 11.5 28.5T840-540ZM480-840ZM120-580Zm360 120Zm360-120ZM240-160Zm480 0Z" />
    </Svg>
);

const CreateImagesIcon = ({ color = '#75FB4C', size = 24 }) => (
    <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
        <Path d="M280-240v-480h80v480h-80ZM440-80v-800h80v800h-80ZM120-400v-160h80v160h-80Zm480 160v-480h80v480h-80Zm160-160v-160h80v160h-80Z" />
    </Svg>
);

const SearchWebIcon = ({ color = '#75FBFD', size = 24 }) => (
    <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
        <Path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-7-.5-14.5T799-507q-5 29-27 48t-52 19h-80q-33 0-56.5-23.5T560-520v-40H400v-80q0-33 23.5-56.5T480-720h40q0-23 12.5-40.5T563-789q-20-5-40.5-8t-42.5-3q-134 0-227 93t-93 227h200q66 0 113 47t47 113v40H400v110q20 5 39.5 7.5T480-160Z" />
    </Svg>
);

const CreateImagesVideosIcon = ({ color = '#F19E39', size = 24 }) => (
    <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
        <Path d="m176-120-56-56 301-302-181-45 198-123-17-234 179 151 216-88-87 217 151 178-234-16-124 198-45-181-301 301Zm24-520-80-80 80-80 80 80-80 80Zm355 197 48-79 93 7-60-71 35-86-86 35-71-59 7 92-79 49 90 22 23 90Zm165 323-80-80 80-80 80 80-80 80ZM569-570Z" />
    </Svg>
);

const StarLogoIcon = ({ color = '#D16D6A', size = 24 }) => (
    <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
        <Path d="M852-212 732-332l56-56 120 120-56 56ZM708-692l-56-56 120-120 56 56-120 120Zm-456 0L132-812l56-56 120 120-56 56ZM108-212l-56-56 120-120 56 56-120 120Zm246-75 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-361Z" />
    </Svg>
);

// Tailwind tokens → RN
const COLORS = {
    primary: '#007AFF',
    backgroundLight: '#FFFFFF',
    backgroundDark: '#000000',
    cardLight: '#F3F4F6',
    cardDark: '#1C1C1E',
    textLight: '#000000',
    textDark: '#FFFFFF',
    textSecondaryLight: '#6B7280',
    textSecondaryDark: '#8E8E93',
    green: '#34D399',
    purple: '#A78BFA',
    teal: '#2DD4BF',
    orange: '#FB923C',
    blue: '#60A5FA',
    indigo: '#818CF8',
};

function Chip({ icon, label, tint, style, customIcon }) {
    return (
        <View style={[styles.chip, style]}>
            {customIcon ? <View style={{ marginRight: 6 }}>{customIcon}</View> : (
                <SvgIcon name={icon} size={20} style={{ marginRight: 6 }} color={tint} />
            )}
            <Text style={styles.chipText}>{label}</Text>
        </View>
    );
}

export default function PaywallScreen({
    onClose,
    onRestore,
    onContinue,
    dark = true,
}) {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const [trialEnabled, setTrialEnabled] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState('yearly');

    const handleTrialToggle = (value) => {
        setTrialEnabled(value);
        setSelectedPlan(value ? 'weekly' : 'yearly');
    };
    const handleSelectPlan = (plan) => {
        setSelectedPlan(plan);
        setTrialEnabled(plan === 'weekly');
    };
    const handleClose = () => {
        if (onClose) onClose();
        else if (navigation && navigation.canGoBack()) navigation.goBack();
    };

    const theme = useMemo(
        () => ({
            bg: dark ? COLORS.backgroundDark : COLORS.backgroundLight,
            card: dark ? COLORS.cardDark : COLORS.cardLight,
            text: dark ? COLORS.textDark : COLORS.textLight,
            textSecondary: dark ? COLORS.textSecondaryDark : COLORS.textSecondaryLight,
        }),
        [dark]
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* GRADIENT BEHIND CONTENT (covers safe area + 384) */}
            <View pointerEvents="none" style={[styles.gradientBackdrop, { height: insets.top + 384 }]}>
                {/* Tailwind: bg-gradient-to-b from-blue-500/30 via-purple-500/20 to-transparent */}
                <LinearGradient
                    colors={['rgba(59,130,246,0.30)', 'rgba(168,85,247,0.20)', 'rgba(0,0,0,0)']}
                    locations={[0, 0.55, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.gradientPrimary}
                />
                {/* Soft “blur-ish” halo */}
                <LinearGradient
                    colors={['rgba(168,85,247,0.18)', 'rgba(0,0,0,0)']}
                    locations={[0, 1]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.gradientSecondary}
                />
            </View>

            <View style={styles.root}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header + “orbiting chips” cluster */}
                    <View style={styles.headerWithModels}>
                        <View style={styles.headerButtons}>
                            <TouchableOpacity
                                onPress={handleClose}
                                activeOpacity={0.9}
                                style={[styles.iconCircle, { backgroundColor: theme.card }]}
                            >
                                <CloseIcon color={COLORS.textDark} size={20} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={onRestore} activeOpacity={0.9} style={styles.restoreBtn}>
                                <Text style={styles.restoreText}>Restore</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.centerWrap}>
                            <View style={styles.chipsLayer}>
                                <Chip
                                    icon="gemini"
                                    label="Gemini"
                                    tint={COLORS.green}
                                    style={{ top: 18, left: '18%' }} />
                                <Chip
                                    icon="banana"
                                    label="Nano Banana"
                                    tint={COLORS.purple}
                                    style={{ top: 18, right: '6%' }}
                                    // customIcon={<PerplexityIcon color="#EA33F7" size={16} />} 
                                    />
                                <Chip
                                    icon="gpt"
                                    label="ChatGPT"
                                    tint={COLORS.teal}
                                    style={{ top: 62, left: '22%', marginLeft: -48 }} />
                                <Chip
                                    icon="claude"
                                    label="Claude"
                                    tint={COLORS.orange}
                                    style={{ top: 62, right: '26%', marginRight: -48 }}
                                />
                                <Chip
                                    icon="grok"
                                    label="Grok 4"
                                    tint={COLORS.blue}
                                    style={{ bottom: 18, left: '18%' }} />
                                <Chip
                                    icon="deepseek"
                                    label="DeepSeek"
                                    tint={COLORS.blue}
                                    style={{ bottom: 18, right: '12%' }} />
                            </View>

                            <View style={[styles.centerLogo, { backgroundColor: theme.card }]}>
                                <StarLogoIcon color="#FFFFFF" size={44} />
                            </View>
                        </View>
                    </View>

                    <Text style={[styles.title, { color: theme.text }]}>GPT-5, Grok 4, Veo 3</Text>

                    {/* Features */}
                    <View style={styles.features}>
                        <View style={styles.featureRow}>
                            <CreateImagesVideosIcon color="#F19E39" size={20} />
                            <Text style={[styles.featureText, { color: theme.text }]}>Create images and videos</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <SearchWebIcon color="#75FBFD" size={20} />
                            <Text style={[styles.featureText, { color: theme.text }]}>Search the web with AI</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <CreateImagesIcon color="#75FB4C" size={20} />
                            <Text style={[styles.featureText, { color: theme.text }]}>Talk naturally to AI</Text>
                        </View>
                    </View>

                    {/* Free trial toggle */}
                    <View style={[styles.cardRow, { backgroundColor: theme.card }]}>
                        <View>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Free trial</Text>
                            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>3-day free trial</Text>
                        </View>
                        <Switch
                            value={trialEnabled}
                            onValueChange={handleTrialToggle}
                            trackColor={{ false: '#4F4F4F', true: '#007AFF' }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="#4F4F4F"
                        />
                    </View>

                    {/* Yearly (Best offer) */}
                    <TouchableOpacity style={styles.bestOfferWrap} onPress={() => handleSelectPlan('yearly')} activeOpacity={0.8}>
                        <View style={[
                            styles.yearlyCard, 
                            { 
                                borderColor: selectedPlan === 'yearly' ? COLORS.primary : '#333',
                                backgroundColor: selectedPlan === 'yearly' ? 'rgba(0, 122, 255, 0.1)' : theme.card
                            }
                        ]}>
                            <View style={styles.badge}><Text style={styles.badgeText}>Best offer</Text></View>
                            <View style={styles.rowSpread}>
                                <View>
                                    <Text style={[styles.planTitle, { color: theme.text }]}>Yearly</Text>
                                    <Text style={[styles.planSub, { color: theme.textSecondary }]}>Only USD 69.99</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.planPrice, { color: theme.text }]}>$1,35</Text>
                                    <Text style={[styles.planSub, { color: theme.textSecondary }]}>per week</Text>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Weekly */}
                    <TouchableOpacity
                        style={[
                            styles.weeklyCard, 
                            { 
                                backgroundColor: selectedPlan === 'weekly' ? 'rgba(0, 122, 255, 0.1)' : theme.card, 
                                borderWidth: 2, 
                                borderColor: selectedPlan === 'weekly' ? COLORS.primary : '#333' 
                            }
                        ]}
                        onPress={() => handleSelectPlan('weekly')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.rowSpread}>
                            <View>
                                <Text style={[styles.planTitle, { color: theme.text }]}>Weekly</Text>
                                <Text style={[styles.planSub, { color: theme.textSecondary }]}>Cancel anytime</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.planPrice, { color: theme.text }]}>USD 7.99</Text>
                                <Text style={[styles.planSub, { color: theme.textSecondary }]}>per week</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </ScrollView>

                {/* Footer */}
                <View style={[styles.footer, { backgroundColor: theme.bg }]}>
                    <TouchableOpacity activeOpacity={0.9} style={styles.cta} onPress={onContinue}>
                        <Text style={styles.ctaText}>Continue</Text>
                    </TouchableOpacity>

                    <View style={styles.legalRow}>
                        <TouchableOpacity activeOpacity={0.8}><Text style={[styles.legalLink, { color: theme.textSecondary }]}>Terms</Text></TouchableOpacity>
                        <Text style={[styles.legalDivider, { color: theme.textSecondary }]}>|</Text>
                        <TouchableOpacity activeOpacity={0.8}><Text style={[styles.legalLink, { color: theme.textSecondary }]}>Privacy</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

const R = 12;

const styles = StyleSheet.create({
    container: { flex: 1 },
    root: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: Platform.select({ ios: 8, android: 8 }),
        // IMPORTANT: keep transparent so the gradient behind is visible
        backgroundColor: 'transparent',
    },

    // Gradient behind content; sibling FIRST so content draws above it
    gradientBackdrop: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        // height set dynamically with insets + 384
    },
    gradientPrimary: {
        ...StyleSheet.absoluteFillObject,
    },
    gradientSecondary: {
        position: 'absolute',
        top: 24,
        left: 0,
        right: 0,
        height: 300,
        opacity: 0.9,
    },

    scroll: { backgroundColor: 'transparent' },
    scrollContent: { paddingBottom: 16 },

    headerWithModels: { marginBottom: 16 },
    headerButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 4,
    },
    iconCircle: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
    },
    restoreBtn: {
        paddingHorizontal: 16, paddingVertical: 6,
        borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary,
    },
    restoreText: { color: COLORS.primary, fontWeight: '500', fontSize: 13, fontFamily: 'Lato-Regular' },

    centerWrap: {
        height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    chipsLayer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center', alignItems: 'center',
    },
    chip: {
        position: 'absolute',
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: COLORS.cardDark,
    },
    chipText: { color: COLORS.textDark, fontSize: 14, fontWeight: '600', fontFamily: 'Lato-Bold' },
    centerLogo: {
        width: 80, height: 80, borderRadius: 40,
        alignItems: 'center', justifyContent: 'center',
    },

    title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 16, fontFamily: 'Lato-Bold' },

    features: { marginBottom: 26, gap: 10 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    featureText: { fontSize: 17, fontFamily: 'Lato-Regular' },

    cardRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderRadius: R, marginBottom: 12,
    },

    bestOfferWrap: { position: 'relative', marginBottom: 12 },
    yearlyCard: { borderWidth: 2, borderRadius: R, padding: 16 },
    badge: {
        position: 'absolute', top: -12, right: 16,
        backgroundColor: COLORS.primary, borderRadius: 999,
        paddingHorizontal: 12, paddingVertical: 4,
    },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.2, fontFamily: 'Lato-Bold' },

    rowSpread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    cardTitle: { fontSize: 16, fontWeight: '700', fontFamily: 'Lato-Bold' },
    cardSubtitle: { fontSize: 13, marginTop: 2, fontFamily: 'Lato-Regular' },

    planTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Lato-Bold' },
    planSub: { fontSize: 13, marginTop: 2, fontFamily: 'Lato-Regular' },
    planPrice: { fontSize: 18, fontWeight: '700', fontFamily: 'Lato-Bold' },

    weeklyCard: { borderRadius: R, padding: 16 },

    footer: { paddingTop: 10, paddingBottom: 14 },
    cta: {
        height: 52, backgroundColor: COLORS.primary,
        borderRadius: R, alignItems: 'center', justifyContent: 'center',
    },
    ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, fontFamily: 'Lato-Bold' },
    legalRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    legalLink: { fontSize: 12, textDecorationLine: 'underline', fontFamily: 'Lato-Regular' },
    legalDivider: { fontSize: 12, marginHorizontal: 8, fontFamily: 'Lato-Regular' },
});
