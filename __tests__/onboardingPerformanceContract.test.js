const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('onboarding performance and handoff contract', () => {
  const intro = read('src/screens/IntroductionAnimationScreen.jsx');
  const centerButton = read('src/components/onboarding/CenterNextButton.jsx');
  const nextButton = read('src/components/onboarding/NextButtonArrow.jsx');
  const app = read('App.js');
  const paywall = read('src/components/PremiumPaywallScreen.jsx');

  test('keeps transition frames off the JavaScript thread', () => {
    expect(intro).toContain('useNativeDriver: true');
    expect(intro).toContain('SCREEN_TRANSITION_MS = 900');
    expect(intro).toContain('Easing.bezier(0.4, 0.0, 0.2, 1.0)');
    expect(intro).not.toContain('.addListener(');
    expect(centerButton).not.toContain('.addListener(');
    expect(nextButton).not.toContain('.addListener(');
    expect(intro).toContain('renderToHardwareTextureAndroid={isAnimating}');
  });

  test('detaches animations and commits a static handoff before navigation', () => {
    expect(intro).toContain('animationController.current.stopAnimation');
    expect(intro).toContain('animationController.current.removeAllListeners');
    expect(intro).toContain('setIsCompleting(true)');
    expect(intro).not.toContain('if (isCompleting)');
    expect(app).toContain('<DeferredStandalonePremiumPaywallScreen');
    expect(app).toContain('!initialPaywallPresented');
  });

  test('hands off without blocking on a detached paywall hero preloader', () => {
    expect(app).not.toContain('styles.firstLaunchHero');
    expect(app).not.toContain('styles.paywallImagePreload');
    expect(app).not.toContain('handlePaywallHeroReady');
    expect(paywall).toContain('const HERO_IMAGE =');
    expect(paywall).toContain('source={HERO_IMAGE}');
    expect(paywall).toContain('cloud-ai-intelligence-hero-v2-optimized.jpg');
    expect(paywall).toContain('resizeMethod="resize"');
    expect(paywall).toContain('useState(USE_TIMELINE_PAYWALL)');
    expect(app).toContain('setInitialPaywallVisible(true)');
    expect(paywall).toContain("accent: '#0ABAB5'");
    expect(intro).toContain("backgroundColor: '#0A0A0A'");
    expect(app).toContain('styles.fullscreenOverlay');
  });

  test('keeps the branded launch overlay until onboarding has painted', () => {
    expect(app).toContain('styles.startupOverlay');
    expect(app).toContain('startupContentReady &&');
    expect(app).toContain('onLayout={handleStartupContentLayout}');
    expect(app).toContain('startupContentFrameRef.current = requestAnimationFrame');
    expect(app).toContain('&&\n    initialSurfaceReady;');
    expect(app).not.toContain('startupFallbackElapsed');
    expect(app).toContain('Animated.timing(startupOverlayOpacity');
    expect(app).toContain('onCatch={handleFatalRenderError}');
    expect(read('src/components/GlobalErrorBoundary.jsx')).toContain(
      'this.props.onCatch?.(error, info)',
    );
    expect(app).toContain('useNativeDriver: true');
    expect(intro).toContain('onLoad={() => setInitialBackgroundReady(true)}');
    expect(intro).toContain('const initialSceneReady =');
    expect(intro).toContain('criticalSceneReady && secondaryScenesMounted && secondaryImagesReady');
    expect(intro).toContain('secondaryImagesReadyRef.current.size >= 5');
    expect(intro).toContain('setInitialBackgroundReady(true)');
    expect(intro).toContain('setSecondaryImagesReady(true)');
    expect(intro).toContain('onError={() => setInitialBackgroundReady(true)}');
    expect(read('src/components/onboarding/SplashView.jsx')).toContain(
      'onError={onCriticalImageReady}',
    );
  });

  test('loads navigation lazily and defers background work until the destination is ready', () => {
    const subscription = read('src/context/SubscriptionContext.js');

    expect(app).toContain('deferNetworkWork={!subscriptionNetworkReady}');
    expect(app).toContain(
      'const subscriptionNetworkReady =\n    firstLaunch === true ||',
    );
    expect(app).toContain('prefetchDuringOnboarding={firstLaunch === true}');
    expect(subscription).toContain('if (!prefetchDuringOnboarding)');
    expect(subscription.indexOf('fetchOfferings().catch')).toBeLessThan(
      subscription.indexOf('const info = await Purchases.getCustomerInfo()'),
    );
    expect(app).toContain('initialPaywallRequested ||');
    expect(app).toContain("initialLaunchScreen === 'PaywallScreen' ||");
    expect(intro).toContain('onSubscriptionWarmup?.()');
    expect(intro).toContain('InteractionManager.runAfterInteractions');
    expect(app).toContain('shouldMountMainApp ? (');
    expect(app).not.toContain("import DrawerNavigator from './src/navigation/DrawerNavigator'");
    expect(app).toContain("require('./src/navigation/DrawerNavigator').default");
    expect(app).toContain('<DeferredDrawerNavigator');
    expect(app).toContain(
      'firstLaunch === false || initialPaywallPresented',
    );
    expect(read('src/navigation/DrawerNavigator.js')).toContain(
      'paywallIsCoveringStartup',
    );
    expect(app).toContain('if (!shouldStartBackgroundTasks) return undefined;');
    expect(app).toContain(
      'mainAppReady && (firstLaunch === false || initialPaywallPresented)',
    );
    expect(intro).not.toContain('onMainAppWarmup');
    expect(intro).not.toContain('RateUsService');
    expect(app).toContain("require('./src/services/RateUsService').default");
    expect(app).toContain('onboardingCompletedThisSessionRef.current = true');
    expect(read('src/navigation/DrawerNavigator.js')).toContain(
      'getComponent={getChatScreen}',
    );
  });

  test('reports the first stable destination and hydrates visual storage once', () => {
    const drawer = read('src/navigation/DrawerNavigator.js');
    const chat = read('src/screens/Chat.js');
    const threads = read('src/state/useThreadsStore.js');
    const settings = read('src/state/useSettingsStore.js');

    expect(drawer).toContain('reportScreenReady: reportInitialScreenReady');
    expect(chat).toContain('reportScreenReady?.()');
    expect(chat).toContain('settingsHydrated &&');
    expect(chat).toContain('entitlementCacheReady &&');
    expect(threads).toContain('let hydrationPromise = null');
    expect(threads).toContain('if (hydrationPromise) return hydrationPromise');
    expect(threads).toContain('let threadBodiesHydrationPromise = null');
    expect(threads).toContain('Storage.loadThreadBodies(snapshotIndex)');
    expect(threads).toContain('Missing/corrupt bodies are omitted');
    expect(read('src/lib/storage.js')).toContain('async loadThreadBodies(threadIndex)');
    expect(settings).toContain('let settingsHydrationPromise = null');
    expect(settings).toContain(
      'if (settingsHydrationPromise) return settingsHydrationPromise',
    );
    expect(app).toContain("label: 'hydrateSettings'");
  });

  test('shows startup helpers without waiting for navigation interactions', () => {
    const chat = read('src/screens/Chat.js');
    const delayedPath = chat.indexOf('helperRevealTimeoutRef.current = setTimeout');
    const fastPath = chat.lastIndexOf(
      'if (!startupReadyReportedRef.current) {',
      delayedPath,
    );

    expect(fastPath).toBeGreaterThan(-1);
    expect(delayedPath).toBeGreaterThan(fastPath);
    const initialBranch = chat.slice(fastPath, delayedPath);
    expect(initialBranch).toContain('setHelpersVisible(true)');
    expect(chat).toContain(
      'const [helpersVisible, setHelpersVisible] = useState(true)',
    );
    expect(chat).not.toContain('STARTUP_SUGGESTION_STAGE_COUNT');
    expect(chat).not.toContain('visibleCount={suggestionStage}');
    expect(initialBranch).not.toContain('InteractionManager.runAfterInteractions');
  });

  test('keeps the startup suggestion row lightweight and commits it once', () => {
    const suggestions = read('src/components/chat/SuggestionCards.jsx');

    expect(suggestions).toContain("import Svg, { Path } from 'react-native-svg'");
    expect(suggestions).toContain('QUICK_ACTION_ICON_PATHS');
    expect(suggestions).toContain('<Pressable');
    expect(suggestions).not.toContain("import SvgIcon from '../SvgIcon'");
    expect(suggestions).not.toContain('visibleCount');
  });

  test('keeps React work off keyboard animation frames', () => {
    const chat = read('src/screens/Chat.js');
    const input = read('src/components/chat/TestInput.jsx');
    const willShowStart = chat.indexOf('const handleKeyboardWillShow = () => {');
    const didShowStart = chat.indexOf('const handleKeyboardDidShow = () => {');
    const willShowHandler = chat.slice(willShowStart, didShowStart);

    expect(willShowStart).toBeGreaterThan(-1);
    expect(didShowStart).toBeGreaterThan(willShowStart);
    expect(willShowHandler).not.toContain('setKeyboardVisible');
    expect(willShowHandler).not.toContain('setHelpersVisible');
    expect(chat.slice(didShowStart, chat.indexOf('const handleKeyboardDidHide')))
      .not.toContain('setHelpersVisible(false)');
    expect(willShowHandler).toContain('bannerMediaRef.current?.pause?.()');
    expect(chat).toContain('bannerMediaRef.current?.pause?.()');
    expect(chat).toContain('if (keyboardVisible) {');
    expect(chat).toContain('useReanimatedKeyboardAnimation()');
    expect(input).not.toContain('useWindowDimensions');
    expect(input).toContain("Dimensions.get('window')");
    expect(input).toContain('if (!renderMenu) return undefined');
  });

  test('keeps the banner layout ready while deferring its native video player', () => {
    const chat = read('src/screens/Chat.js');
    const banner = read('src/components/chat/AssistantsBanner.jsx');

    expect(chat).toContain('playVideo={decorativeMediaReady && !keyboardVisible}');
    expect(chat).toContain('STARTUP_DECORATIVE_MEDIA_DELAY_MS = 240');
    expect(banner).toContain('playVideo = true');
    expect(banner).toMatch(/playVideo\s*\?\s*\(\s*<HeroVideo/);
    expect(banner).toContain("backgroundColor: '#0B1020'");
  });

  test('does not construct hidden Chat overlays or the closed model list at startup', () => {
    const chat = read('src/screens/Chat.js');
    const modelSelector = read('src/components/ModelSelector.jsx');
    const drawer = read('src/navigation/DrawerNavigator.js');

    expect(chat).toContain('showVoiceOverlay || keepVoiceOverlayMounted ? (');
    expect(modelSelector).toContain('if (!open)');
    expect(modelSelector).toContain('{open ? (');
    expect(drawer).toContain('() => isAssistantChat');
  });
});

describe('dark launch experience contract', () => {
  test('uses one small loader across the native and React launch surfaces', () => {
    const launchScreen = read('src/screens/StartupLoadingScreen.jsx');
    const app = read('App.js');
    const styles = read('android/app/src/main/res/values/styles.xml');

    expect(launchScreen).toContain('Animated.loop');
    expect(launchScreen).toContain('isInteraction: false');
    expect(launchScreen).toContain('DOT_STYLES');
    expect(launchScreen).toContain('width: 24');
    expect(launchScreen).not.toContain('ActivityIndicator');
    expect(launchScreen).toContain("LOADER_COLOR = '#0ABAB5'");
    expect(launchScreen).not.toContain('girlIcon.webp');
    expect(launchScreen).not.toContain('MINIMUM_VISIBLE_MS');
    expect(launchScreen).toContain('requestAnimationFrame');
    expect(app).toContain('startupPresentationComplete &&');
    expect(styles).toContain('parent="Theme.AppCompat.NoActionBar"');
    expect(styles).toContain('<item name="android:forceDarkAllowed">false</item>');
    expect(styles).toContain(
      '<item name="windowSplashScreenAnimatedIcon">@drawable/launch_loader_splash</item>',
    );
  });
});
