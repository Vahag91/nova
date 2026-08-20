const fs = require('fs');
const path = require('path');
const {
  ANDROID_LOCALE_TAGS,
} = require('../src/i18n/localeRegistry');

const projectRoot = path.join(__dirname, '..');
const localeConfigPath = path.join(
  projectRoot,
  'android',
  'app',
  'src',
  'main',
  'res',
  'xml',
  'locale_config.xml',
);
const manifestPath = path.join(
  projectRoot,
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml',
);

test('Android per-app language config matches the canonical registry', () => {
  const xml = fs.readFileSync(localeConfigPath, 'utf8');
  const declaredTags = [...xml.matchAll(/android:name="([^"]+)"/g)].map(
    match => match[1],
  );

  expect(declaredTags).toEqual(ANDROID_LOCALE_TAGS);
  expect(new Set(declaredTags).size).toBe(95);

  const manifest = fs.readFileSync(manifestPath, 'utf8');
  expect(manifest).toContain('android:localeConfig="@xml/locale_config"');
  expect(manifest).toContain('android:supportsRtl="true"');
});

