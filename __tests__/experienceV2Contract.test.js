import fs from 'fs';
import path from 'path';

const readSource = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const onboardingSource = readSource(
  'src/screens/IntroductionAnimationScreen.jsx',
);
const paywallSource = readSource('src/components/PremiumPaywallScreen.jsx');
const workspaceFlowSource = readSource(
  'src/components/onboarding/v4/WorkspaceOnboardingFlow.jsx',
);
const themeSource = readSource('src/components/onboarding/v4/theme.js');
const setupOrbSource = readSource('src/components/onboarding/v4/SetupOrb.jsx');
const valueDemoSource = readSource(
  'src/components/onboarding/v4/ValueDemoView.jsx',
);
const workspaceReadySource = readSource(
  'src/components/onboarding/v4/WorkspaceReadyView.jsx',
);

describe('onboarding and paywall experience contract', () => {
  test('keeps the workspace onboarding and timeline paywall active with rollback switches', () => {
    expect(onboardingSource).toContain(
      "export const ONBOARDING_EXPERIENCE_VERSION = 'v4'",
    );
    expect(paywallSource).toContain(
      "export const PAYWALL_EXPERIENCE_VERSION = 'v3'",
    );
  });

  test('preserves the original experiences in their legacy branches', () => {
    expect(onboardingSource).toContain('<SplashView');
    expect(onboardingSource).toContain('<RelaxView');
    expect(onboardingSource).toContain('<CareView');
    expect(onboardingSource).toContain('<IntentView');
    expect(onboardingSource).toContain('<OutcomeView');
    expect(onboardingSource).toContain('<ProofView');
    expect(onboardingSource).toContain('LegacyIntroductionAnimationScreen');
    expect(paywallSource).toContain('LEGACY_HERO_IMAGE');
    expect(paywallSource).toContain('Legacy paywall presentation preserved');
  });

  test('hands the workspace onboarding off to the existing premium paywall', () => {
    // The flow must end on the setup screen: the app owns paywall presentation,
    // so a second paywall inside onboarding would double-charge the user's
    // attention and bypass the close gate.
    expect(onboardingSource).toContain('<WorkspaceOnboardingFlow');
    expect(onboardingSource).toContain('onFinish={onComplete}');
    expect(workspaceFlowSource).toContain(
      "const STEPS = ['valueDemo', 'goals', 'workspace'];",
    );
    expect(workspaceFlowSource).not.toContain('Paywall');
  });

  test('gives the setup step something to watch while it waits', () => {
    expect(workspaceReadySource).toContain('<SetupOrb');
    expect(workspaceReadySource).toContain('<SetupChecklist');
    expect(setupOrbSource).toContain('{ perspective: PERSPECTIVE }');
    expect(setupOrbSource).toContain('{ rotateX: RING_TILT }');
    expect(setupOrbSource).toContain('rotateY: ring.swing');
    expect(setupOrbSource).toContain('rotateZ: rotate');
    expect(setupOrbSource).not.toContain('useNativeDriver: false');
  });

  test('reuses the original onboarding vertical slide and easing', () => {
    expect(workspaceFlowSource).toContain('const SCREEN_TRANSITION_MS = 900');
    expect(workspaceFlowSource).toContain(
      'Easing.bezier(0.4, 0, 0.2, 1)',
    );
    expect(workspaceFlowSource).toContain('outgoingStyle');
    expect(workspaceFlowSource).toContain('incomingStyle');
    expect(workspaceFlowSource).toContain('translateY: slide.interpolate');
    expect(workspaceFlowSource).toContain('useNativeDriver: true');
    expect(workspaceFlowSource).toContain('pendingIndex !== null');
  });

  test('anchors the footer so only the content moves', () => {
    // The dots and the button belong to the flow, outside the animated stage.
    expect(workspaceFlowSource).toContain('<PageDots');
    expect(workspaceFlowSource).toContain('<PrimaryButton');
    expect(valueDemoSource).not.toContain('PrimaryButton');
    expect(valueDemoSource).not.toContain('PageDots');
    expect(workspaceReadySource).not.toContain('PrimaryButton');
    expect(workspaceFlowSource).toContain(
      'if (index === 2 || pendingIndex === 2) return null;',
    );
  });

  test('opens the paywall once setup finishes, without waiting for a tap', () => {
    expect(workspaceFlowSource).toContain('WORKSPACE_AUTO_ADVANCE_MS');
    expect(workspaceFlowSource).toContain('haptic(HAPTIC.handoff)');
    expect(workspaceFlowSource).toContain('onTrialReady={setTrialReady}');
    expect(workspaceFlowSource).toContain('return null;');
    expect(workspaceFlowSource.indexOf('Animated.timing(handoff')).toBeLessThan(
      workspaceFlowSource.indexOf('onFinish?.();'),
    );
  });

  test('opens the paywall as a cross-fade from a dark onboarding surface', () => {
    // Onboarding stays mounted until the paywall reports onPresented, so the
    // entrance has to fade rather than snap - and both surfaces have to sit on
    // the same background or the swap shows as a flash.
    expect(onboardingSource).toContain('colorScheme="dark"');
    expect(themeSource).toContain("backdrop: isDark ? '#05070A'");
    expect(paywallSource).toContain(
      'opacity: surfaceVisible ? transitionProgress : 0',
    );
  });

  test('uses a serious three-color paywall with only essential purchase information', () => {
    expect(paywallSource).toContain("background: '#05070A'");
    expect(paywallSource).toContain("accent: '#F05A28'");
    expect(paywallSource).toContain("title: '#FFFFFF'");
    expect(paywallSource).toContain('<TimelinePlanCard');
    expect(paywallSource).toContain(
      'colors={[EDITORIAL.accent, EDITORIAL.accent]}',
    );
    expect(paywallSource).toContain('<BillingTimeline');
    expect(paywallSource).not.toContain('{renewalTerms}');
    expect(paywallSource).not.toContain('tone="violet"');
  });
});
