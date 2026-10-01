/**
 * Micro-haptics for onboarding.
 *
 * Every call is best-effort: haptics are a garnish, so a device without a
 * motor - or a user who turned system feedback off - must never break the flow.
 */
import Haptic from 'react-native-haptic-feedback';

const OPTIONS = {
  enableVibrateFallback: false,
  // Respect the phone's own haptics setting rather than overriding it.
  ignoreAndroidSystemSettings: false,
};

export const HAPTIC = {
  // A step advanced or a primary button was pressed.
  advance: 'impactLight',
  // A goal was picked or dropped, or a setup step ticked over.
  select: 'selection',
  // The selection limit rejected the tap.
  reject: 'notificationWarning',
  // Setup finished.
  ready: 'notificationSuccess',
  // Handing off to the paywall.
  handoff: 'impactMedium',
};

export function haptic(type = HAPTIC.select) {
  try {
    Haptic.trigger(type, OPTIONS);
  } catch (error) {
    // Ignored on purpose - see the note above.
  }
}
