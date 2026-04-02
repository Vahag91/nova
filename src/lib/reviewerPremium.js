import AsyncStorage from '@react-native-async-storage/async-storage';

export const REVIEWER_PREMIUM_KEY = '@reviewerPremium';
export const REVIEWER_PREMIUM_COINS_GRANTED_KEY = '@reviewerPremiumCoinsGranted';

export async function getReviewerPremiumEnabled() {
  try {
    const raw = await AsyncStorage.getItem(REVIEWER_PREMIUM_KEY);
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}

export async function setReviewerPremiumEnabled(enabled) {
  try {
    await AsyncStorage.setItem(REVIEWER_PREMIUM_KEY, JSON.stringify(!!enabled));
  } catch {}
}

export async function getReviewerPremiumCoinsGranted() {
  try {
    const raw = await AsyncStorage.getItem(REVIEWER_PREMIUM_COINS_GRANTED_KEY);
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}

export async function setReviewerPremiumCoinsGranted(granted) {
  try {
    await AsyncStorage.setItem(
      REVIEWER_PREMIUM_COINS_GRANTED_KEY,
      JSON.stringify(!!granted)
    );
  } catch {}
}
