const fs = require('fs');
const path = require('path');

describe('Android system bar background', () => {
  test('uses a black AppTheme window background behind inset system bars', () => {
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

    expect(stylesXml).toMatch(
      /<item\s+name="android:windowBackground">\s*#000000\s*<\/item>/,
    );
  });
});
