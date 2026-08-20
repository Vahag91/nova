const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

describe('Android Play Console warning mitigations', () => {
  test('MainActivity does not set deprecated system bar colors directly', () => {
    const mainActivity = readRepoFile(
      'android',
      'app',
      'src',
      'main',
      'java',
      'com',
      'aicloudsolutions',
      'cloud',
      'MainActivity.kt',
    );

    expect(mainActivity).not.toMatch(/\bstatusBarColor\s*=/);
    expect(mainActivity).not.toMatch(/\bnavigationBarColor\s*=/);
    expect(mainActivity).not.toContain('android.graphics.Color');
  });

  test('uses one stable app-wide StatusBar instead of screen-level toggles', () => {
    const app = readRepoFile('App.js');
    expect(app).toContain('<StatusBar');
    expect(app).toContain('translucent');
    expect(app).toContain('backgroundColor="transparent"');

    const files = [
      path.join('src', 'screens', 'IntroductionAnimationScreen.jsx'),
      path.join('src', 'navigation', 'AndroidNavigationMenu.jsx'),
      path.join('src', 'components', 'onboarding', 'TopBackSkipView.jsx'),
    ];

    for (const file of files) {
      expect(readRepoFile(file)).not.toMatch(/\bStatusBar\b/);
    }
  });

  test('portrait lock is kept with Android 16 temporary resizability opt-out', () => {
    const manifest = readRepoFile(
      'android',
      'app',
      'src',
      'main',
      'AndroidManifest.xml',
    );

    expect(manifest).toContain('android:screenOrientation="portrait"');
    expect(manifest).toContain(
      'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY',
    );
  });

  test('Android 15+ theme avoids deprecated system bar color attributes', () => {
    const stylesV35 = readRepoFile(
      'android',
      'app',
      'src',
      'main',
      'res',
      'values-v35',
      'styles.xml',
    );

    expect(stylesV35).not.toContain('android:statusBarColor');
    expect(stylesV35).not.toContain('android:navigationBarColor');
  });
});
