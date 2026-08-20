const fs = require('fs');
const path = require('path');

describe('Android system bar background', () => {
  test('keeps the loader-backed dark window through the native-to-React handoff', () => {
    const stylesPath = path.join(
      __dirname,
      '..',
      'android',
      'app',
      'src',
      'main',
      'res',
      'values',
      'styles.xml',
    );
    const stylesXml = fs.readFileSync(stylesPath, 'utf8');

    expect(stylesXml).toContain(
      '<item name="android:windowBackground">@drawable/launch_window_background</item>',
    );
    expect(stylesXml).toContain(
      '<item name="android:colorBackground">@color/brand_background</item>',
    );
    expect(
      (stylesXml.match(/android:windowTranslucentStatus">true/g) || []),
    ).toHaveLength(2);
    expect(stylesXml).toContain(
      '<item name="android:statusBarColor">@android:color/transparent</item>',
    );
  });
});
