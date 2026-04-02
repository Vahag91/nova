import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';
import InAppReview from 'react-native-in-app-review';
import UsageTrackingService from './UsageTrackingService';

const RATE_KEYS = {
  LAST_PROMPT: '@lastRatePromptDate',
  HAS_RATED: '@hasRatedApp', // Track if user clicked "Rate Now" (we assume they rated)
};

// Store IDs
const IOS_APP_ID = '6753916530';
const ANDROID_APP_ID = 'com.aicloudsolutions.chatcloud';

const IOS_DEEP_LINK = `itms-apps://itunes.apple.com/app/id${IOS_APP_ID}?action=write-review`;
const IOS_WEB_FALLBACK = `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`;
const PLAY_STORE_LINK = `market://details?id=${ANDROID_APP_ID}`;
const PLAY_STORE_WEB_FALLBACK = `https://play.google.com/store/apps/details?id=${ANDROID_APP_ID}`;

class RateUsService {
  // Simple check: Can we show the rate prompt?
  // Checks:
  // 1. Has user already rated? (if yes, never show again)
  // 2. Has it been at least 12 hours since last prompt?
  static async canShowRatePrompt() {
    try {
      // First check: Has user already rated?
      const hasRated = await AsyncStorage.getItem(RATE_KEYS.HAS_RATED);
      if (hasRated === 'true') {
        return { canShow: false, reason: 'already_rated' };
      }

      // Second check: Has it been at least 12 hours since last prompt?
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

  // Check if we should show the rate prompt (with usage requirements)
  // Combines:
  // 1. Has user already rated? (if yes, never show again)
  // 2. Has it been at least 12 hours since last prompt?
  // 3. Usage check (enough messages + days since first launch)
  static async shouldShowRatePrompt({
    minMessages = 5,
    minDays = 2,
  } = {}) {
    try {
      // First check: Can we show at all?
      const basicCheck = await this.canShowRatePrompt();
      if (!basicCheck.canShow) {
        return basicCheck;
      }

      // Second check: Has user used the app enough?
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

  // Show the rate prompt (native system modal only)
  static async showRatePrompt() {
    try {
      // Mark as shown (12 hour cooldown)
      await this.markPromptShown();
      
      // Check if InAppReview is available
      const isAvailable = await InAppReview.isAvailable();
      
      if (isAvailable) {
        // Show native in-app review dialog
        await InAppReview.RequestInAppReview();
      } else {
        // Fallback: open store directly
        await this.openStoreForReview();
      }
    } catch (error) {
      // Fallback to store
      await this.openStoreForReview();
    }
  }

  // Mark that we showed the prompt (user declined with "Maybe Later")
  static async markPromptShown() {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(RATE_KEYS.LAST_PROMPT, now);
    } catch (error) {
      // Handle error silently
    }
  }

  // Mark that user has rated (clicked "Rate Now")
  // This prevents showing the prompt again
  static async markAsRated() {
    try {
      await AsyncStorage.setItem(RATE_KEYS.HAS_RATED, 'true');
      // Also mark prompt as shown today
      await this.markPromptShown();
    } catch (error) {
      // Handle error silently
    }
  }

  // Check if user has already rated
  static async hasRated() {
    try {
      const hasRated = await AsyncStorage.getItem(RATE_KEYS.HAS_RATED);
      return hasRated === 'true';
    } catch (error) {
      return false;
    }
  }

  // Open store for review (fallback)
  static async openStoreForReview() {
    try {
      if (Platform.OS === 'ios') {
        // iOS: Try deep link first, then web fallback
        try {
          await Linking.openURL(IOS_DEEP_LINK);
        } catch (deepLinkError) {
          await Linking.openURL(IOS_WEB_FALLBACK);
        }
      } else if (ANDROID_APP_ID) {
        try {
          await Linking.openURL(PLAY_STORE_LINK);
        } catch (playStoreError) {
          await Linking.openURL(PLAY_STORE_WEB_FALLBACK);
        }
      }
      
      await this.markPromptShown();
    } catch (error) {
      // Handle error silently
    }
  }

}

export default RateUsService;

