import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import InAppReview from 'react-native-in-app-review';
import UsageTrackingService from './UsageTrackingService';

const RATE_KEYS = {
  LAST_PROMPT: '@lastRatePromptDate',
  HAS_RATED: '@hasRatedApp',
};

const ANDROID_APP_ID = 'com.aicloudsolutions.cloud';
const PLAY_STORE_LINK = `market://details?id=${ANDROID_APP_ID}`;
const PLAY_STORE_WEB_FALLBACK = `https://play.google.com/store/apps/details?id=${ANDROID_APP_ID}`;

class RateUsService {
  static async canShowRatePrompt() {
    try {
      const hasRated = await AsyncStorage.getItem(RATE_KEYS.HAS_RATED);
      if (hasRated === 'true') {
        return { canShow: false, reason: 'already_rated' };
      }

      const lastPromptDate = await AsyncStorage.getItem(RATE_KEYS.LAST_PROMPT);
      if (lastPromptDate) {
        const lastDate = new Date(lastPromptDate);
        const now = new Date();
        const hoursSince = (now - lastDate) / (1000 * 60 * 60);
        if (hoursSince < 12) {
          return { canShow: false, reason: 'recently_shown', hoursSince: Math.round(hoursSince * 10) / 10 };
        }
      }

      return { canShow: true, reason: 'ready' };
    } catch (error) {
      return { canShow: false, reason: 'error', error: error.message };
    }
  }

  static async shouldShowRatePrompt({ minMessages = 5, minDays = 2 } = {}) {
    try {
      const basicCheck = await this.canShowRatePrompt();
      if (!basicCheck.canShow) {
        return basicCheck;
      }

      const usageCheck = await UsageTrackingService.shouldShowRateBasedOnUsage({
        minMessages,
        minDays,
      });

      if (!usageCheck.shouldShow) {
        return {
          shouldShow: false,
          reason: 'insufficient_usage',
          details: usageCheck,
        };
      }

      return {
        shouldShow: true,
        reason: 'ready',
        usage: usageCheck,
      };
    } catch (error) {
      return { shouldShow: false, reason: 'error', error: error.message };
    }
  }

  static async showRatePrompt() {
    try {
      await this.markPromptShown();
      const isAvailable = await InAppReview.isAvailable();
      if (isAvailable) {
        await InAppReview.RequestInAppReview();
      } else {
        await this.openStoreForReview();
      }
    } catch (error) {
      await this.openStoreForReview();
    }
  }

  static async markPromptShown() {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(RATE_KEYS.LAST_PROMPT, now);
    } catch (error) {}
  }

  static async markAsRated() {
    try {
      await AsyncStorage.setItem(RATE_KEYS.HAS_RATED, 'true');
      await this.markPromptShown();
    } catch (error) {}
  }

  static async hasRated() {
    try {
      const hasRated = await AsyncStorage.getItem(RATE_KEYS.HAS_RATED);
      return hasRated === 'true';
    } catch (error) {
      return false;
    }
  }

  static async openStoreForReview() {
    try {
      if (ANDROID_APP_ID) {
        try {
          await Linking.openURL(PLAY_STORE_LINK);
        } catch (playStoreError) {
          await Linking.openURL(PLAY_STORE_WEB_FALLBACK);
        }
      }

      await this.markPromptShown();
    } catch (error) {}
  }
}

export default RateUsService;
