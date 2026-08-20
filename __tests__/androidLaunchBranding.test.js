const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('Android launch branding', () => {
  test('uses one OEM-safe native loader surface', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const styles = read('android/app/src/main/res/values/styles.xml');
    const stylesV35 = read('android/app/src/main/res/values-v35/styles.xml');
    const activity = read(
      'android/app/src/main/java/com/aicloudsolutions/cloud/MainActivity.kt',
    );
    const launchLoader = read(
      'android/app/src/main/res/drawable/launch_loader.xml',
    );
    const launchLoaderV31 = read(
      'android/app/src/main/res/drawable-v31/launch_loader_splash.xml',
    );
    const launchLoaderAnimator = read(
      'android/app/src/main/res/animator/launch_loader_rotation.xml',
    );
    const startupSplashPackage = read(
      'android/app/src/main/java/com/aicloudsolutions/cloud/StartupSplashPackage.kt',
    );
    const mainApplication = read(
      'android/app/src/main/java/com/aicloudsolutions/cloud/MainApplication.kt',
    );
    const app = read('App.js');
    const windowBackground = read(
      'android/app/src/main/res/drawable/launch_window_background.xml',
    );

    expect(manifest).toContain('android:theme="@style/SplashTheme"');
    expect(styles).toContain('<style name="SplashTheme" parent="Theme.SplashScreen">');
    expect(styles).toContain('<item name="windowSplashScreenBackground">@color/brand_background</item>');
    expect(styles).toContain('<item name="windowSplashScreenAnimatedIcon">@drawable/launch_loader_splash</item>');
    expect(styles).toContain('<item name="postSplashScreenTheme">@style/AppTheme</item>');
    expect(styles).toContain('<item name="android:windowSplashScreenBehavior">icon_preferred</item>');
    expect(styles).toContain('<item name="android:windowBackground">@drawable/launch_window_background</item>');
    expect(styles).toContain('<item name="android:windowTranslucentStatus">true</item>');
    expect(stylesV35).toContain('<item name="android:windowTranslucentStatus">true</item>');
    expect(styles).toContain('parent="Theme.AppCompat.NoActionBar"');
    expect(styles).toContain('<item name="android:forceDarkAllowed">false</item>');
    expect(activity).toContain('installSplashScreen()');
    expect(activity).not.toContain('setKeepOnScreenCondition');
    expect(activity).toContain('setOnExitAnimationListener');
    expect(activity).toContain('val splashOverlay = FrameLayout(this)');
    expect(activity).toContain('R.drawable.launch_loader_animated');
    expect(activity).toContain('(loaderView.drawable as? Animatable)?.also { it.start() }');
    expect(activity).toContain('StartupSplashState.runWhenReady');
    expect(activity).toContain('splashOverlay.postDelayed({ dismissSplash() }, SPLASH_FAIL_SAFE_MS)');
    expect(activity).toContain('.setDuration(140L)');
    expect(activity).toContain('(splashOverlay.parent as? ViewGroup)?.removeView(splashOverlay)');
    expect(launchLoader).toContain('android:fillColor="#0ABAB5"');
    expect(launchLoader).toContain('android:name="loader"');
    expect((launchLoader.match(/<path/g) || []).length).toBe(6);
    [
      'M144,133 a2,2 0,1 0 0,4 a2,2 0,1 0 0,-4',
      'M151,137 a2,2 0,1 0 0,4 a2,2 0,1 0 0,-4',
      'M151,145 a2,2 0,1 0 0,4 a2,2 0,1 0 0,-4',
      'M144,149 a2,2 0,1 0 0,4 a2,2 0,1 0 0,-4',
      'M137,145 a2,2 0,1 0 0,4 a2,2 0,1 0 0,-4',
      'M137,137 a2,2 0,1 0 0,4 a2,2 0,1 0 0,-4',
    ].forEach(pathData => expect(launchLoader).toContain(pathData));
    ['0.72', '0.5', '0.34', '0.2', '0.1'].forEach(opacity =>
      expect(launchLoader).toContain(`android:fillAlpha="${opacity}"`),
    );
    expect(launchLoaderV31).toContain('@drawable/launch_loader');
    expect(launchLoaderV31).toContain('@animator/launch_loader_rotation');
    expect(launchLoaderAnimator).toContain('android:valueTo="360"');
    expect(launchLoaderAnimator).toContain('android:duration="1000"');
    expect(launchLoaderAnimator).toContain('android:repeatCount="infinite"');
    expect(styles).toContain(
      '<item name="windowSplashScreenAnimationDuration">1000</item>',
    );
    expect(startupSplashPackage).toContain('SPLASH_FAIL_SAFE_MS = 10_000L');
    expect(startupSplashPackage).toContain('fun runWhenReady(listener: () -> Unit)');
    expect(startupSplashPackage).toContain('runOnUiQueueThread');
    expect(mainApplication).toContain('add(StartupSplashPackage())');
    expect(app).toContain('releaseNativeStartupSplash()');
    expect((app.match(/releaseNativeStartupSplash\(\);/g) || []).length).toBe(3);
    expect(windowBackground).toContain('@drawable/launch_loader');
    expect(styles).not.toContain('@drawable/launch_icon');
  });

  test('centers the React loader against the native full-display center', () => {
    const startupLoader = read('src/screens/StartupLoadingScreen.jsx');

    expect(startupLoader).toContain("StatusBar.currentHeight || 0");
    expect(startupLoader).toContain(
      '(screenHeight - windowHeight - statusBarHeight) / 2',
    );
    expect(startupLoader).not.toContain('(screenHeight - windowHeight) / 2');
  });
});
