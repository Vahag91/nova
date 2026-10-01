export const ONE_TIME_OFFER_PAYWALL_ENABLED = false;

// Set to false to return to the original PaywallScreen implementation.
export const PIXEL_PAYWALL_ENABLED = true;

// Image Studio (generation + editing) is switched off for the Play relaunch.
// Every entry point, paywall mention, and API call is gated on this flag.
export const IMAGE_STUDIO_ENABLED = false;

// Daily coins / streaks / quests only existed to buy Image Studio credits, so
// the whole rewards surface goes dark with it (sidebar item, screen, check-in
// modal, notification priming, and scheduled reminders).
export const REWARDS_ENABLED = false;
