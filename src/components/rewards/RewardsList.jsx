import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../styles/colors';
import SvgIcon from '../SvgIcon';
import { useRewardsStore } from '../../state/useRewardsStore';
import { useImagesStore } from '../../state/useImagesStore';
import { redeemReward } from '../../lib/rewardsSupabase';
import { ensureDeviceId } from '../../lib/deviceId';
import { createSbWithDevice, fetchBalanceByDevice } from '../../lib/supabaseDevice';
import { RewardSuccessModal } from './RewardSuccessModal';
import { SecretBoxModal } from './SecretBoxModal';

export default function RewardsList() {
  const { t } = useTranslation();

  const AVAILABLE_REWARDS = [
    { id: 'image-credits-50', title: t('rewards.rewardsList.rewardTitles.imageCredits50'), description: '', cost: 500, credits: 50, icon: 'coin', iconBg: '#2A2A2A', iconColor: '#FBBF24' },
    { id: 'image-credits-200', title: t('rewards.rewardsList.rewardTitles.imageCredits200'), description: '', cost: 1500, credits: 200, icon: 'coin', iconBg: '#2A2A2A', iconColor: '#FBBF24' },
    { id: 'image-credits-600', title: t('rewards.rewardsList.rewardTitles.imageCredits600'), description: '', cost: 4000, credits: 600, icon: 'coin', iconBg: '#2A2A2A', iconColor: '#FBBF24' },
    { id: 'secret-box', title: t('rewards.rewardsList.rewardTitles.secretBox'), description: t('rewards.rewardsList.rewardDescriptions.secretBox'), cost: 10000, icon: 'diamond', iconBg: '#2A2A2A', iconColor: '#10B981',type: 'secret-box', },
  ];
  const rewardCoins = useRewardsStore(s => s.points);          // ✅ reward coins (local)

  const imageCredits = useImagesStore(s => s.coinsBalance);   // ✅ backend image credits
  const setImageCredits = useImagesStore(s => s.setCoinsBalance);

  const [redeemingId, setRedeemingId] = useState(null);
  const [modal, setModal] = useState(null); // { type: 'success' | 'error', reward?, credits?, error? }
  
  // NEW: Secret Box Specific State
  const [secretBoxState, setSecretBoxState] = useState({
    visible: false,
    isSpinning: false,
    finalResult: null, // { label: 'Lucky 1K', credits: 1000 }
  });

  // refresh ONLY backend image credits on focus
  const refreshImageCredits = useCallback(async () => {
    try {
      const deviceId = await ensureDeviceId();
      if (!deviceId) return;

      const sb = createSbWithDevice(deviceId);
      const bal = await fetchBalanceByDevice(sb, deviceId);

      if (typeof bal === 'number') {
        setImageCredits(bal);
      }
    } catch (err) {
      // Image credits refresh failed
    }
  }, [setImageCredits]);

  useFocusEffect(
    useCallback(() => {
      refreshImageCredits();
    }, [refreshImageCredits])
  );

  const handleRedeem = async (reward) => {
    if (redeemingId) {
      return;
    }
  
    const isSecretBox = reward?.id === 'secret-box';
  
    // "Coming soon" rewards (no credits AND not secret-box)
    if (!reward?.credits && !isSecretBox) {
      Alert.alert(t('rewards.rewardsList.alerts.comingSoonTitle'), t('rewards.rewardsList.alerts.comingSoonMessage'));
      return;
    }
  
    // must have enough reward coins
    if (rewardCoins < reward.cost) {
      Alert.alert(t('rewards.rewardsList.alerts.notEnoughCoinsTitle'), t('rewards.rewardsList.alerts.notEnoughCoinsMessage'));
      return;
    }
  
    setRedeemingId(reward.id);

    // --- CASE A: SECRET BOX FLOW ---
    if (isSecretBox) {
      // 1. Open Modal Immediately & Start Spinning
      setSecretBoxState({
        visible: true,
        isSpinning: true,
        finalResult: null
      });

      try {
        // 2. Call API
        const res = await redeemReward(reward.id, { cost: reward.cost });
        

        if (!res || res.ok !== true) {
          throw new Error(res?.message || res?.error || t('rewards.rewardsList.alerts.couldNotOpenBox'));
        }

        // 3. Update Local Balance
        const current = useRewardsStore.getState().points;
        useRewardsStore.getState().setPoints(Math.max(0, current - reward.cost));

        // ✅ update backend image credits from response (or refresh)
        if (typeof res?.balance === 'number') {
          setImageCredits(res.balance);
        } else {
          refreshImageCredits();
        }

        // 4. Update Result and Stop Spinning
        // Ensure we wait at least 2 seconds so the user sees the spin animation
        setTimeout(() => {
          setSecretBoxState(prev => ({
            ...prev,
            isSpinning: false, // This triggers the slow-down logic in modal
            finalResult: {
              credits: res.granted, // The actual credits won
              label: res.prizeLabel || res?.fullResponse?.prizeLabel || t('rewards.rewardsList.alerts.mysteryReward')
            }
          }));
        }, 2000); // Minimum spin time

      } catch (err) {
        // Handle Error (Close box, show error alert)
        setSecretBoxState({ visible: false, isSpinning: false, finalResult: null });
        Alert.alert(t('rewards.rewardsList.alerts.errorTitle'), t('rewards.rewardsList.alerts.couldNotOpenBox'));
      } finally {
        setRedeemingId(null);
      }
      return; 
    }

    // --- CASE B: REGULAR REWARD FLOW (Existing Code) ---
    try {
      // Edge function knows what to do based on rewardId
      const res = await redeemReward(reward.id, { cost: reward.cost });
  
      if (!res || res.ok !== true) {
        throw new Error(
          res?.message ||
            res?.error ||
            t('rewards.rewardsList.alerts.couldNotRedeem'),
        );
      }
  
      // ✅ spend reward coins locally AFTER server success
      const current = useRewardsStore.getState().points;
      const newBalance = Math.max(0, current - reward.cost);
      useRewardsStore.getState().setPoints(newBalance);
  
      // ✅ update backend image credits from response (or refresh)
      if (typeof res?.balance === 'number') {
        setImageCredits(res.balance);
      } else {
        refreshImageCredits();
      }
  
      // For normal rewards → reward.credits
      const granted = typeof res?.granted === 'number'
        ? res.granted
        : reward.credits;
  
      setModal({
        type: 'success',
        reward,
        credits: granted,
        isSecretBox: false,
        prizeLabel: null,
      });
    } catch (err) {
      setModal({
        type: 'error',
        error: err?.message || t('rewards.rewardsList.alerts.couldNotRedeem'),
      });
    } finally {
      setRedeemingId(null);
    }
  };


  const availableRewards = AVAILABLE_REWARDS.filter(r => rewardCoins >= r.cost);
  const lockedRewards = AVAILABLE_REWARDS.filter(r => rewardCoins < r.cost);

  const RewardCard = ({ reward, canAfford }) => {
    const disabled = !canAfford || !!redeemingId;
    const isRedeeming = redeemingId === reward.id;

    return (
      <Pressable
        onPress={() => !disabled && handleRedeem(reward)}
        disabled={disabled}
        android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
        style={({ pressed }) => [
          styles.card,
          !canAfford && styles.cardLocked,
          isRedeeming && styles.cardRedeeming,
          pressed && !disabled && styles.cardPressed,
        ]}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.iconContainer, { backgroundColor: reward.iconBg }]}>
            <SvgIcon name={reward.icon} size={22} color={reward.iconColor} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.rewardTitle} numberOfLines={1}>
              {reward.title}
            </Text>

            {reward.description ? (
              <Text style={styles.rewardSubtitle} numberOfLines={1}>
                {reward.description}
              </Text>
            ) : null}
          </View>
        </View>

        {isRedeeming ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color="#4F46E5" />
          </View>
        ) : (
          <View style={[styles.costBadge, !canAfford && styles.costBadgeLocked]}>
            <View style={styles.rewardDot} />
            <Text style={styles.costText}>{reward.cost.toLocaleString()}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TOP: show both balances so nobody confuses them */}
        <View style={styles.balancesRow}>
          <View style={styles.balancePill}>
            <SvgIcon name="coin" size={18} color="#FBBF24" />
            <Text style={styles.balanceLabel}>{t('rewards.balances.rewardCoins')}</Text>
            <Text style={styles.balanceValue}>{rewardCoins.toLocaleString()}</Text>
          </View>

          <View style={styles.balancePill}>
            <SvgIcon name="image-credits" size={18} color="#A78BFA" />
            <Text style={styles.balanceLabel}>{t('rewards.balances.imageCredits')}</Text>
            <Text style={styles.balanceValue}>
              {typeof imageCredits === 'number' ? imageCredits.toLocaleString() : '—'}
            </Text>
          </View>
        </View>

        {availableRewards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('rewards.sections.availableRewards')}</Text>
            <View style={styles.cardStack}>
              {availableRewards.map(r => (
                <RewardCard key={r.id} reward={r} canAfford />
              ))}
            </View>
          </View>
        )}

        {lockedRewards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('rewards.sections.needsMoreCoins')}</Text>
            <View style={styles.cardStack}>
              {lockedRewards.map(r => (
                <RewardCard key={r.id} reward={r} canAfford={false} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* EXISTING MODAL for Normal Rewards */}
      <RewardSuccessModal
        visible={!!modal}
        reward={modal?.type === 'success' ? modal.reward : null}
        credits={modal?.type === 'success' ? modal.credits : null}
        error={modal?.type === 'error' ? modal.error : null}
        isSecretBox={modal?.type === 'success' ? modal.isSecretBox : false}
        prizeLabel={modal?.type === 'success' ? modal.prizeLabel : null}
        onClose={() => setModal(null)}
      />

      {/* NEW MODAL for Secret Box */}
      <SecretBoxModal 
        visible={secretBoxState.visible}
        isSpinning={secretBoxState.isSpinning}
        finalResult={secretBoxState.finalResult}
        onClose={() => setSecretBoxState({ visible: false, isSpinning: false, finalResult: null })}
      />
    </View>
  );
}

const CARD_BG = '#121212';
const BORDER = '#2A2A2A';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 24,
  },

  
  balancesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
    marginTop: 26,  
  },
  balancePill: {
    flex: 1,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Lato-Regular',
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  section: { gap: 14 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
    color: '#FFFFFF',
    paddingLeft: 4,
  },
  cardStack: { gap: 14 },

  card: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 78,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    justifyContent: 'space-between',
  },
  cardLocked: { opacity: 0.55 },
  cardRedeeming: { opacity: 0.7 },
  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  textContainer: { flex: 1, justifyContent: 'center', minWidth: 0, gap: 1 },
  rewardTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Lato-Bold', color: '#E5E7EB' },
  rewardSubtitle: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', fontFamily: 'Lato-Regular' },

  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: BORDER,
    flexShrink: 0,
  },
  costBadgeLocked: { opacity: 0.7 },
  rewardDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FBBF24' },
  costText: { fontSize: 14, fontWeight: '800', fontFamily: 'Lato-Bold', color: '#FFFFFF' },
  loaderContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});
