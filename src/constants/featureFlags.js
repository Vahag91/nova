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

// Development preview. Release availability comes from the versioned backend
// readiness contract, and remains false on missing/incompatible responses.
export const SOURCE_WORKSPACE_ENABLED = typeof __DEV__ !== 'undefined' && __DEV__;

// Product policy switch for the Documents / Video workspaces. Owner decision on
// 2026-10-03: new analyses and "Ask about this" require Premium, matching the
// chat composer's file upload, through the same pending-action/paywall flow.
// Saved briefs stay readable for everyone. Set to false to reopen the
// workspaces to free users.
export const SOURCE_WORKSPACE_REQUIRES_PREMIUM = true;
