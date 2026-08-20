const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  auditLocaleDirectory,
  duplicateJsonKeys,
  extractPlaceholders,
  flattenMessages,
} = require('../scripts/localizationQa');

const temporaryDirectories = [];

function makeCatalogs(catalogs) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-cloud-i18n-'));
  temporaryDirectories.push(directory);
  for (const [locale, catalog] of Object.entries(catalogs)) {
    const contents =
      typeof catalog === 'string' ? catalog : JSON.stringify(catalog, null, 2);
    fs.writeFileSync(path.join(directory, `${locale}.json`), contents, 'utf8');
  }
  return directory;
}

function codes(result) {
  return result.issues.map(issue => issue.code);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('flattens nested catalogs and preserves repeated placeholder multiplicity', () => {
  expect(
    flattenMessages({ section: { title: 'Hello', nested: { cta: 'Go' } } })
      .messages,
  ).toEqual({ 'section.title': 'Hello', 'section.nested.cta': 'Go' });
  expect(
    extractPlaceholders('{{name}} sent {{count}} items to {{name}}'),
  ).toEqual(['count', 'name', 'name']);
});

test('detects duplicate JSON keys even though JSON.parse would overwrite them', () => {
  expect(duplicateJsonKeys('{"screen":{"title":"One","title":"Two"}}')).toEqual(
    ['screen.title'],
  );
});

test('accepts complete catalogs with matching placeholders, script, RTL, and allowlisted brands', () => {
  const localesDir = makeCatalogs({
    en: {
      greeting: 'Hello {{name}}',
      detail:
        'This localized sentence has enough content for a useful script check.',
      provider: 'OpenAI',
    },
    ar: {
      greeting: 'مرحبًا {{name}}',
      detail:
        'هذه جملة عربية مترجمة تحتوي على نص كافٍ للتحقق من استخدام النص العربي الصحيح.',
      provider: 'OpenAI',
    },
  });
  const result = auditLocaleDirectory({
    localesDir,
    targetLocales: ['en', 'ar'],
    rtlLanguages: ['ar'],
    allowlist: { global: ['provider'], locales: {} },
    minimumScriptLetters: 1,
  });

  expect(result.errors).toEqual([]);
  expect(result.warnings).toEqual([]);
  expect(result.scriptStats[0].ratio).toBeGreaterThan(0.8);
});

test('reports missing, obsolete, malformed-placeholder, and non-string entries', () => {
  const localesDir = makeCatalogs({
    en: { greeting: 'Hello {{name}}', nested: { title: 'Title' } },
    fr: {
      greeting: 'Bonjour {name}',
      obsolete: 'Ancien',
      count: 3,
      blank: '   ',
      corrupted: 'Texte \uFFFD',
    },
  });
  const result = auditLocaleDirectory({
    localesDir,
    targetLocales: ['en', 'fr'],
    rtlLanguages: [],
    allowlist: { global: [], locales: {} },
  });

  expect(codes(result)).toEqual(
    expect.arrayContaining([
      'NON_STRING_LEAF',
      'MISSING_TRANSLATION_KEY',
      'EXTRA_TRANSLATION_KEY',
      'PLACEHOLDER_MISMATCH',
      'EMPTY_TRANSLATION',
      'INVALID_TRANSLATION_CHARACTER',
    ]),
  );
  expect(result.ok).toBe(false);
});

test('reports target bundle gaps and locale files absent from the registry', () => {
  const localesDir = makeCatalogs({
    en: { title: 'Title' },
    zz: { title: 'Translation' },
  });
  const result = auditLocaleDirectory({
    localesDir,
    targetLocales: ['en', 'fr'],
    rtlLanguages: [],
    allowlist: { global: [], locales: {} },
  });

  expect(codes(result)).toEqual(
    expect.arrayContaining(['MISSING_LOCALE_FILE', 'UNEXPECTED_LOCALE_FILE']),
  );
});

test('keeps identical-English findings reviewable and makes strict mode enforce them', () => {
  const localesDir = makeCatalogs({
    en: { action: 'Continue', provider: 'OpenAI' },
    de: { action: 'Continue', provider: 'OpenAI' },
  });
  const common = {
    localesDir,
    targetLocales: ['en', 'de'],
    rtlLanguages: [],
    allowlist: { global: ['provider'], locales: {} },
  };

  const reviewResult = auditLocaleDirectory(common);
  expect(reviewResult.ok).toBe(true);
  expect(reviewResult.warnings).toEqual([
    expect.objectContaining({
      code: 'IDENTICAL_TO_ENGLISH',
      locale: 'de',
      key: 'action',
    }),
  ]);

  const strictResult = auditLocaleDirectory({
    ...common,
    strictIdentical: true,
  });
  expect(strictResult.ok).toBe(false);
  expect(strictResult.errors).toContainEqual(
    expect.objectContaining({
      code: 'IDENTICAL_TO_ENGLISH',
      locale: 'de',
      key: 'action',
    }),
  );
});

test('flags a catalog that is mostly identical to another language catalog', () => {
  const strings = {};
  for (let i = 0; i < 60; i++) strings[`key${i}`] = `English sentence ${i}`;
  const romanian = Object.fromEntries(
    Object.entries(strings).map(([k, v], i) => [k, `Propoziție românească ${i}`]),
  );
  const localesDir = makeCatalogs({
    en: strings,
    ro: romanian,
    rm: romanian, // wrong-language paste: Romanian delivered as Romansh
  });
  const result = auditLocaleDirectory({
    localesDir,
    targetLocales: ['en', 'ro', 'rm'],
    rtlLanguages: [],
    allowlist: { global: [], locales: {} },
  });

  expect(codes(result)).toEqual(
    expect.arrayContaining(['CROSS_LOCALE_DUPLICATE']),
  );
  expect(result.ok).toBe(false);
});

test('does not flag same-language regional variants for overlapping', () => {
  const strings = {};
  for (let i = 0; i < 60; i++) strings[`key${i}`] = `English sentence ${i}`;
  const spanish = Object.fromEntries(
    Object.entries(strings).map(([k, v], i) => [k, `Frase en español ${i}`]),
  );
  const localesDir = makeCatalogs({
    en: strings,
    es: spanish,
    'es-MX': spanish,
  });
  const result = auditLocaleDirectory({
    localesDir,
    targetLocales: ['en', 'es', 'es-MX'],
    rtlLanguages: [],
    allowlist: { global: [], locales: {} },
  });

  expect(codes(result)).not.toEqual(
    expect.arrayContaining(['CROSS_LOCALE_DUPLICATE']),
  );
});

test('rejects stale allowlist entries and impossible script or RTL classifications', () => {
  const localesDir = makeCatalogs({
    en: { detail: 'A sufficiently long English sentence used for validation.' },
    ur: {
      detail: 'This was accidentally left entirely in English and must fail.',
    },
  });
  const result = auditLocaleDirectory({
    localesDir,
    targetLocales: ['en', 'ur'],
    rtlLanguages: ['en'],
    allowlist: { global: ['removed.key'], locales: {} },
    minimumScriptLetters: 1,
  });

  expect(codes(result)).toEqual(
    expect.arrayContaining([
      'OBSOLETE_ALLOWLIST_KEY',
      'IMPLAUSIBLE_SCRIPT',
      'RTL_LANGUAGE_NOT_DECLARED',
      'LTR_LANGUAGE_DECLARED_RTL',
    ]),
  );
});
