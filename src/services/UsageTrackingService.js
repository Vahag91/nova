import AsyncStorage from '@react-native-async-storage/async-storage';

const USAGE_KEYS = {
  FIRST_LAUNCH_DATE: '@firstLaunchDate',
  MESSAGE_COUNT: '@totalMessageCount',
  LAST_RATE_CHECK: '@lastRateCheckDate',
};

class UsageTrackingService {
  // Initialize first launch date (call once on app start)
  static async initializeFirstLaunch() {
    try {
      const existing = await AsyncStorage.getItem(USAGE_KEYS.FIRST_LAUNCH_DATE);
      if (!existing) {
        const now = new Date().toISOString();
        await AsyncStorage.setItem(USAGE_KEYS.FIRST_LAUNCH_DATE, now);
      }
    } catch (error) {
      // Handle error silently
    }
  }

  // Get first launch date
  static async getFirstLaunchDate() {
    try {
      const dateStr = await AsyncStorage.getItem(USAGE_KEYS.FIRST_LAUNCH_DATE);
      return dateStr ? new Date(dateStr) : null;
    } catch (error) {
      return null;
    }
  }

  // Get days since first launch
  static async getDaysSinceFirstLaunch() {
    try {
      const firstLaunch = await this.getFirstLaunchDate();
      if (!firstLaunch) return 0;
      const now = new Date();
      const diffTime = Math.abs(now - firstLaunch);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      return 0;
    }
  }

  // Increment message count (call after successful message send)
  static async incrementMessageCount() {
    try {
      const current = await AsyncStorage.getItem(USAGE_KEYS.MESSAGE_COUNT);
      const count = current ? parseInt(current, 10) : 0;
      await AsyncStorage.setItem(USAGE_KEYS.MESSAGE_COUNT, String(count + 1));
      return count + 1;
    } catch (error) {
      return 0;
    }
  }

  // Get total message count
  static async getMessageCount() {
    try {
      const count = await AsyncStorage.getItem(USAGE_KEYS.MESSAGE_COUNT);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  // Check if we should show rate prompt based on usage
  // Requirements:
  // - At least MIN_MESSAGES messages sent
  // - At least MIN_DAYS days since first launch
  static async shouldShowRateBasedOnUsage({
    minMessages = 5,
    minDays = 2,
  } = {}) {
    try {
      const [messageCount, daysSinceLaunch] = await Promise.all([
        this.getMessageCount(),
        this.getDaysSinceFirstLaunch(),
      ]);

      const hasEnoughMessages = messageCount >= minMessages;
      const hasEnoughDays = daysSinceLaunch >= minDays;

      return {
        shouldShow: hasEnoughMessages && hasEnoughDays,
        messageCount,
        daysSinceLaunch,
        reasons: {
          enoughMessages: hasEnoughMessages,
          enoughDays: hasEnoughDays,
        },
      };
    } catch (error) {
      return {
        shouldShow: false,
        messageCount: 0,
        daysSinceLaunch: 0,
        reasons: {
          enoughMessages: false,
          enoughDays: false,
        },
      };
    }
  }

  // Reset usage data (for testing)
  static async resetUsageData() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(USAGE_KEYS.FIRST_LAUNCH_DATE),
        AsyncStorage.removeItem(USAGE_KEYS.MESSAGE_COUNT),
        AsyncStorage.removeItem(USAGE_KEYS.LAST_RATE_CHECK),
      ]);
    } catch (error) {
      // Handle error silently
    }
  }

  // Get usage statistics
  static async getUsageStats() {
    try {
      const [messageCount, daysSinceLaunch, firstLaunchDate] = await Promise.all([
        this.getMessageCount(),
        this.getDaysSinceFirstLaunch(),
        this.getFirstLaunchDate(),
      ]);

      return {
        messageCount,
        daysSinceLaunch,
        firstLaunchDate,
      };
    } catch (error) {
      return {
        messageCount: 0,
        daysSinceLaunch: 0,
        firstLaunchDate: null,
      };
    }
  }
}

export default UsageTrackingService;

