'use strict';

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const DEFAULT_REFERENCE_LOCALE = 'en';
const LETTER_RE = /\p{Letter}/u;
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_$][\w$.-]*)(?:\s*,[^{}]*)?\s*\}\}/gu;

// Languages whose normal Android/CLDR writing direction is right-to-left.
// Keep this wider than the current catalog so adding a locale cannot silently
// ship with the wrong layout direction.
const KNOWN_RTL_LANGUAGES = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'he',
  'ks',
  'nqo',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
]);

const LANGUAGE_ALIASES = Object.freeze({
  iw: 'he',
  in: 'id',
  ji: 'yi',
});

// Standard varieties that legitimately share large parts of their written
// form. Pairs inside one group are exempt from the wrong-language tripwire.
const RELATED_LANGUAGE_GROUPS = Object.freeze([
  Object.freeze(['bs', 'hr', 'sr']),
  Object.freeze(['id', 'ms']),
  Object.freeze(['da', 'nb']),
]);

function areRelatedLanguages(leftLanguage, rightLanguage) {
  return RELATED_LANGUAGE_GROUPS.some(
    group => group.includes(leftLanguage) && group.includes(rightLanguage),
  );
}

const SCRIPT_RULES = Object.freeze({
  ar: scriptRule(['Arabic']),
  fa: scriptRule(['Arabic']),
  ur: scriptRule(['Arabic']),
  ps: scriptRule(['Arabic']),
  sd: scriptRule(['Arabic']),
  ug: scriptRule(['Arabic']),
  he: scriptRule(['Hebrew']),
  yi: scriptRule(['Hebrew']),
  hi: scriptRule(['Devanagari']),
  mr: scriptRule(['Devanagari']),
  ne: scriptRule(['Devanagari']),
  bn: scriptRule(['Bengali']),
  as: scriptRule(['Bengali']),
  pa: scriptRule(['Gurmukhi']),
  gu: scriptRule(['Gujarati']),
  or: scriptRule(['Oriya']),
  ta: scriptRule(['Tamil']),
  te: scriptRule(['Telugu']),
  kn: scriptRule(['Kannada']),
  ml: scriptRule(['Malayalam']),
  si: scriptRule(['Sinhala']),
  th: scriptRule(['Thai']),
  lo: scriptRule(['Lao']),
  km: scriptRule(['Khmer']),
  my: scriptRule(['Myanmar']),
  am: scriptRule(['Ethiopic']),
  hy: scriptRule(['Armenian']),
  ka: scriptRule(['Georgian']),
  el: scriptRule(['Greek']),
  be: scriptRule(['Cyrillic']),
  bg: scriptRule(['Cyrillic']),
  kk: scriptRule(['Cyrillic']),
  ky: scriptRule(['Cyrillic']),
  mk: scriptRule(['Cyrillic']),
  mn: scriptRule(['Cyrillic']),
  ru: scriptRule(['Cyrillic']),
  sr: scriptRule(['Cyrillic']),
  uk: scriptRule(['Cyrillic']),
  zh: scriptRule(['Han'], 0.35),
  ja: scriptRule(['Han', 'Hiragana', 'Katakana'], 0.3),
  ko: scriptRule(['Hangul', 'Han'], 0.35),
});

function scriptRule(scripts, minimumRatio = 0.4) {
  const source = scripts
    .map(script => `\\p{Script_Extensions=${script}}`)
    .join('|');
  return Object.freeze({
    scripts: Object.freeze([...scripts]),
    minimumRatio,
    characterPattern: new RegExp(`^(?:${source})$`, 'u'),
  });
}

function normalizeLanguage(locale) {
  const raw = String(locale || '')
    .trim()
    .replace(/_/g, '-')
    .split('-')[0]
    .toLowerCase();
  return LANGUAGE_ALIASES[raw] || raw;
}

function normalizeLocale(locale) {
  return String(locale || '')
    .trim()
    .replace(/_/g, '-');
}

function extractPlaceholders(value) {
  if (typeof value !== 'string') return [];
  const placeholders = [];
  for (const match of value.matchAll(PLACEHOLDER_RE))
    placeholders.push(match[1]);
  return placeholders.sort();
}

function hasInvalidTranslationCharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint === 0xfffd ||
      codePoint <= 0x08 ||
      codePoint === 0x0b ||
      codePoint === 0x0c ||
      (codePoint >= 0x0e && codePoint <= 0x1f) ||
      codePoint === 0x7f
    ) {
      return true;
    }
  }
  return false;
}

function flattenMessages(input) {
  const messages = Object.create(null);
  const invalidLeaves = [];
  const collisions = [];

  function visit(value, keyPath) {
    if (typeof value === 'string') {
      if (Object.prototype.hasOwnProperty.call(messages, keyPath))
        collisions.push(keyPath);
      messages[keyPath] = value;
      return;
    }

    // String arrays are valid catalogs entries: the app reads them with
    // i18next's `returnObjects: true` (e.g. starter prompt chips). Items are
    // flattened to indexed keys so length and content parity are enforced.
    if (Array.isArray(value)) {
      if (value.length === 0)
        invalidLeaves.push({ key: keyPath, type: 'empty array' });
      value.forEach((child, index) =>
        visit(child, keyPath ? `${keyPath}.${index}` : String(index)),
      );
      return;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0)
        invalidLeaves.push({ key: keyPath, type: 'empty object' });
      for (const [key, child] of entries) {
        visit(child, keyPath ? `${keyPath}.${key}` : key);
      }
      return;
    }

    invalidLeaves.push({
      key: keyPath || '<root>',
      type: Array.isArray(value)
        ? 'array'
        : value === null
        ? 'null'
        : typeof value,
    });
  }

  visit(input, '');
  return { messages, invalidLeaves, collisions };
}

function duplicateJsonKeys(raw, filename = 'catalog.json') {
  let ast;
  try {
    ast = babel.parseSync(`const __catalog = ${raw};`, {
      filename,
      babelrc: false,
      configFile: false,
      parserOpts: { sourceType: 'script' },
    });
  } catch (_) {
    // JSON.parse reports the canonical syntax error. Avoid a second noisy error.
    return [];
  }

  const declaration = ast?.program?.body?.[0]?.declarations?.[0]?.init;
  const duplicates = [];

  function propertyName(property) {
    if (!property || property.computed) return null;
    if (property.key?.type === 'StringLiteral') return property.key.value;
    if (property.key?.type === 'Identifier') return property.key.name;
    return null;
  }

  function visit(node, keyPath) {
    if (!node || node.type !== 'ObjectExpression') return;
    const seen = new Set();
    for (const property of node.properties) {
      if (property.type !== 'ObjectProperty') continue;
      const key = propertyName(property);
      if (key === null) continue;
      const childPath = keyPath ? `${keyPath}.${key}` : key;
      if (seen.has(key)) duplicates.push(childPath);
      seen.add(key);
      visit(property.value, childPath);
    }
  }

  visit(declaration, '');
  return duplicates;
}

function parseCatalogFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    return { error: `Cannot read file: ${error.message}` };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { error: `Invalid JSON: ${error.message}` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'Catalog root must be a JSON object.' };
  }

  const flattened = flattenMessages(parsed);
  return {
    raw,
    parsed,
    ...flattened,
    duplicateKeys: duplicateJsonKeys(raw, filePath),
  };
}

function loadIdenticalAllowlist(allowlistPath) {
  if (!allowlistPath) return { global: [], locales: {} };
  const parsed = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  return {
    global: Array.isArray(parsed.global) ? parsed.global : [],
    locales:
      parsed.locales && typeof parsed.locales === 'object'
        ? parsed.locales
        : {},
  };
}

function isIdenticalAllowed(allowlist, locale, key) {
  return (
    allowlist.global.includes(key) ||
    (allowlist.locales[locale] || []).includes(key)
  );
}

function makeIssue(severity, code, details = {}) {
  return { severity, code, ...details };
}

function validateAllowlist(allowlist, canonicalMessages, targetLocales) {
  const issues = [];
  const canonicalKeys = new Set(Object.keys(canonicalMessages));
  const targetSet = new Set(targetLocales);

  for (const key of allowlist.global) {
    if (!canonicalKeys.has(key)) {
      issues.push(
        makeIssue('error', 'OBSOLETE_ALLOWLIST_KEY', {
          key,
          message: `Global identical-English allowlist key does not exist: ${key}`,
        }),
      );
    }
  }

  for (const [locale, keys] of Object.entries(allowlist.locales)) {
    if (!targetSet.has(locale)) {
      issues.push(
        makeIssue('error', 'OBSOLETE_ALLOWLIST_LOCALE', {
          locale,
          message: `Identical-English allowlist locale is not supported: ${locale}`,
        }),
      );
    }
    if (!Array.isArray(keys)) {
      issues.push(
        makeIssue('error', 'INVALID_ALLOWLIST_ENTRY', {
          locale,
          message: `Allowlist entry for ${locale} must be an array.`,
        }),
      );
      continue;
    }
    for (const key of keys) {
      if (!canonicalKeys.has(key)) {
        issues.push(
          makeIssue('error', 'OBSOLETE_ALLOWLIST_KEY', {
            locale,
            key,
            message: `Identical-English allowlist key does not exist: ${locale}:${key}`,
          }),
        );
      }
    }
  }

  return issues;
}

function calculateScriptStats(locale, messages, canonicalMessages, allowlist) {
  // Explicit Latin-script variants (currently Serbian) must not be measured
  // against the base language's non-Latin default script.
  if (/(?:^|-)Latn(?:-|$)/i.test(normalizeLocale(locale))) return null;
  const language = normalizeLanguage(locale);
  const rule = SCRIPT_RULES[language];
  if (!rule) return null;

  let totalLetters = 0;
  let expectedLetters = 0;

  for (const [key, originalValue] of Object.entries(messages)) {
    if (
      originalValue === canonicalMessages[key] &&
      isIdenticalAllowed(allowlist, locale, key)
    )
      continue;
    const value = originalValue
      .replace(PLACEHOLDER_RE, '')
      .replace(/https?:\/\/\S+/giu, '')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, '');

    for (const character of value) {
      if (!LETTER_RE.test(character)) continue;
      totalLetters += 1;
      if (rule.characterPattern.test(character)) expectedLetters += 1;
    }
  }

  return {
    locale,
    language,
    scripts: rule.scripts,
    totalLetters,
    expectedLetters,
    ratio: totalLetters === 0 ? 0 : expectedLetters / totalLetters,
    minimumRatio: rule.minimumRatio,
  };
}

function auditLocaleDirectory(options = {}) {
  const localesDir = path.resolve(
    options.localesDir || path.join(process.cwd(), 'src/i18n/locales'),
  );
  const referenceLocale = options.referenceLocale || DEFAULT_REFERENCE_LOCALE;
  const allowlist =
    options.allowlist || loadIdenticalAllowlist(options.allowlistPath);
  const strictIdentical = Boolean(options.strictIdentical);
  const minimumScriptLetters = Number.isFinite(options.minimumScriptLetters)
    ? options.minimumScriptLetters
    : 80;
  const declaredRtlLanguages = new Set(
    (options.rtlLanguages || []).map(normalizeLanguage),
  );

  const files = fs.existsSync(localesDir)
    ? fs
        .readdirSync(localesDir)
        .filter(file => file.endsWith('.json'))
        .sort()
    : [];
  const fileLocales = files.map(file => path.basename(file, '.json'));
  const targetLocales = [
    ...new Set(
      (options.targetLocales && options.targetLocales.length
        ? options.targetLocales
        : fileLocales
      ).map(normalizeLocale),
    ),
  ].sort();

  const issues = [];
  const catalogs = Object.create(null);

  if (!fs.existsSync(localesDir)) {
    issues.push(
      makeIssue('error', 'LOCALES_DIRECTORY_MISSING', {
        file: localesDir,
        message: `Locales directory does not exist: ${localesDir}`,
      }),
    );
  }

  const targetSet = new Set(targetLocales);
  const fileSet = new Set(fileLocales);
  for (const locale of targetLocales) {
    if (!fileSet.has(locale)) {
      issues.push(
        makeIssue('error', 'MISSING_LOCALE_FILE', {
          locale,
          file: path.join(localesDir, `${locale}.json`),
          message: `Missing required locale bundle: ${locale}.json`,
        }),
      );
    }
  }
  for (const locale of fileLocales) {
    if (!targetSet.has(locale)) {
      issues.push(
        makeIssue('error', 'UNEXPECTED_LOCALE_FILE', {
          locale,
          file: path.join(localesDir, `${locale}.json`),
          message: `Locale bundle is not declared by the locale registry: ${locale}.json`,
        }),
      );
    }
  }

  for (const file of files) {
    const locale = path.basename(file, '.json');
    const filePath = path.join(localesDir, file);
    const catalog = parseCatalogFile(filePath);
    catalogs[locale] = catalog;
    if (catalog.error) {
      issues.push(
        makeIssue('error', 'INVALID_CATALOG', {
          locale,
          file: filePath,
          message: catalog.error,
        }),
      );
      continue;
    }
    for (const key of catalog.duplicateKeys) {
      issues.push(
        makeIssue('error', 'DUPLICATE_JSON_KEY', {
          locale,
          file: filePath,
          key,
          message: `Duplicate JSON key: ${key}`,
        }),
      );
    }
    for (const leaf of catalog.invalidLeaves) {
      issues.push(
        makeIssue('error', 'NON_STRING_LEAF', {
          locale,
          file: filePath,
          key: leaf.key,
          message: `Translation leaves must be strings; ${leaf.key} is ${leaf.type}.`,
        }),
      );
    }
    for (const key of catalog.collisions) {
      issues.push(
        makeIssue('error', 'FLATTENED_KEY_COLLISION', {
          locale,
          file: filePath,
          key,
          message: `Nested translation keys collide at path: ${key}`,
        }),
      );
    }
    for (const [key, value] of Object.entries(catalog.messages)) {
      if (value.trim().length === 0) {
        issues.push(
          makeIssue('error', 'EMPTY_TRANSLATION', {
            locale,
            file: filePath,
            key,
            message: `Translation value must not be empty: ${locale}:${key}`,
          }),
        );
      }
      if (hasInvalidTranslationCharacter(value)) {
        issues.push(
          makeIssue('error', 'INVALID_TRANSLATION_CHARACTER', {
            locale,
            file: filePath,
            key,
            message: `Translation contains a replacement or control character: ${locale}:${key}`,
          }),
        );
      }
    }
  }

  const canonical = catalogs[referenceLocale];
  if (!canonical || canonical.error) {
    issues.push(
      makeIssue('error', 'REFERENCE_CATALOG_MISSING', {
        locale: referenceLocale,
        message: `Cannot validate locale parity without a valid ${referenceLocale}.json catalog.`,
      }),
    );
    return finalizeAudit({
      localesDir,
      targetLocales,
      referenceLocale,
      catalogs,
      issues,
      scriptStats: [],
    });
  }

  const canonicalMessages = canonical.messages;
  const canonicalKeys = Object.keys(canonicalMessages).sort();
  const canonicalKeySet = new Set(canonicalKeys);
  issues.push(
    ...validateAllowlist(allowlist, canonicalMessages, targetLocales),
  );

  const scriptStats = [];
  for (const locale of targetLocales) {
    if (locale === referenceLocale) continue;
    const catalog = catalogs[locale];
    if (!catalog || catalog.error) continue;
    const translatedKeys = Object.keys(catalog.messages).sort();
    const translatedKeySet = new Set(translatedKeys);

    for (const key of canonicalKeys) {
      if (!translatedKeySet.has(key)) {
        issues.push(
          makeIssue('error', 'MISSING_TRANSLATION_KEY', {
            locale,
            key,
            file: path.join(localesDir, `${locale}.json`),
            message: `${locale}.json is missing key: ${key}`,
          }),
        );
      }
    }
    for (const key of translatedKeys) {
      if (!canonicalKeySet.has(key)) {
        issues.push(
          makeIssue('error', 'EXTRA_TRANSLATION_KEY', {
            locale,
            key,
            file: path.join(localesDir, `${locale}.json`),
            message: `${locale}.json contains obsolete/unknown key: ${key}`,
          }),
        );
      }
    }

    for (const key of canonicalKeys) {
      const translatedValue = catalog.messages[key];
      if (typeof translatedValue !== 'string') continue;
      const expectedPlaceholders = extractPlaceholders(canonicalMessages[key]);
      const actualPlaceholders = extractPlaceholders(translatedValue);
      if (
        JSON.stringify(expectedPlaceholders) !==
        JSON.stringify(actualPlaceholders)
      ) {
        issues.push(
          makeIssue('error', 'PLACEHOLDER_MISMATCH', {
            locale,
            key,
            expected: expectedPlaceholders,
            actual: actualPlaceholders,
            message: `${locale}:${key} placeholders differ (expected ${
              expectedPlaceholders.join(', ') || 'none'
            }; got ${actualPlaceholders.join(', ') || 'none'}).`,
          }),
        );
      }

      if (
        translatedValue === canonicalMessages[key] &&
        LETTER_RE.test(translatedValue) &&
        !isIdenticalAllowed(allowlist, locale, key)
      ) {
        issues.push(
          makeIssue(
            strictIdentical ? 'error' : 'warning',
            'IDENTICAL_TO_ENGLISH',
            {
              locale,
              key,
              message: `${locale}:${key} is identical to English and is not allowlisted.`,
            },
          ),
        );
      }
    }

    const stats = calculateScriptStats(
      locale,
      catalog.messages,
      canonicalMessages,
      allowlist,
    );
    if (stats) {
      scriptStats.push(stats);
      if (
        stats.totalLetters >= minimumScriptLetters &&
        stats.ratio < stats.minimumRatio
      ) {
        issues.push(
          makeIssue('error', 'IMPLAUSIBLE_SCRIPT', {
            locale,
            expectedScripts: stats.scripts,
            ratio: stats.ratio,
            minimumRatio: stats.minimumRatio,
            message: `${locale}.json uses ${stats.scripts.join(
              '/',
            )} for only ${(stats.ratio * 100).toFixed(
              1,
            )}% of letters; expected at least ${(
              stats.minimumRatio * 100
            ).toFixed(0)}%.`,
          }),
        );
      }
    }
  }

  // A catalog that is mostly identical to another *language's* catalog means
  // the wrong language was pasted (e.g. Romanian delivered as Romansh). Same-
  // language regional variants (es/es-MX, fa/fa-AF, zh-*) legitimately overlap
  // and are exempt via their shared base language.
  const duplicateThreshold = Number.isFinite(options.crossLocaleDuplicateRatio)
    ? options.crossLocaleDuplicateRatio
    : 0.4;
  const comparableLocales = targetLocales.filter(locale => {
    const catalog = catalogs[locale];
    return locale !== referenceLocale && catalog && !catalog.error;
  });
  for (let i = 0; i < comparableLocales.length; i++) {
    for (let j = i + 1; j < comparableLocales.length; j++) {
      const left = comparableLocales[i];
      const right = comparableLocales[j];
      const leftLanguage = normalizeLanguage(left);
      const rightLanguage = normalizeLanguage(right);
      if (leftLanguage === rightLanguage) continue;
      if (areRelatedLanguages(leftLanguage, rightLanguage)) continue;
      const leftMessages = catalogs[left].messages;
      const rightMessages = catalogs[right].messages;
      let compared = 0;
      let identical = 0;
      for (const key of canonicalKeys) {
        const leftValue = leftMessages[key];
        const rightValue = rightMessages[key];
        if (typeof leftValue !== 'string' || typeof rightValue !== 'string')
          continue;
        // English-identical values are reported separately; brand terms and
        // digits-only values carry no language signal.
        if (!LETTER_RE.test(leftValue)) continue;
        if (leftValue === canonicalMessages[key]) continue;
        compared += 1;
        if (leftValue === rightValue) identical += 1;
      }
      if (compared >= 50 && identical / compared >= duplicateThreshold) {
        issues.push(
          makeIssue('error', 'CROSS_LOCALE_DUPLICATE', {
            locale: left,
            otherLocale: right,
            ratio: identical / compared,
            message: `${left}.json and ${right}.json are ${(
              (identical / compared) *
              100
            ).toFixed(1)}% identical; one of them is probably the wrong language.`,
          }),
        );
      }
    }
  }

  const supportedLanguages = new Set(targetLocales.map(normalizeLanguage));
  for (const language of supportedLanguages) {
    const expectedRtl = KNOWN_RTL_LANGUAGES.has(language);
    const declaredRtl = declaredRtlLanguages.has(language);
    if (expectedRtl && !declaredRtl) {
      issues.push(
        makeIssue('error', 'RTL_LANGUAGE_NOT_DECLARED', {
          locale: language,
          message: `Supported RTL language is absent from RTL_LANGUAGES: ${language}`,
        }),
      );
    }
  }
  for (const language of declaredRtlLanguages) {
    if (!supportedLanguages.has(language)) {
      issues.push(
        makeIssue('error', 'UNSUPPORTED_RTL_LANGUAGE', {
          locale: language,
          message: `RTL_LANGUAGES contains an unsupported language: ${language}`,
        }),
      );
    } else if (!KNOWN_RTL_LANGUAGES.has(language)) {
      issues.push(
        makeIssue('error', 'LTR_LANGUAGE_DECLARED_RTL', {
          locale: language,
          message: `LTR language is incorrectly classified as RTL: ${language}`,
        }),
      );
    }
  }

  return finalizeAudit({
    localesDir,
    targetLocales,
    referenceLocale,
    catalogs,
    issues,
    scriptStats,
  });
}

function finalizeAudit({
  localesDir,
  targetLocales,
  referenceLocale,
  catalogs,
  issues,
  scriptStats,
}) {
  issues.sort((left, right) => {
    const severity =
      left.severity === right.severity ? 0 : left.severity === 'error' ? -1 : 1;
    if (severity) return severity;
    return `${left.code}|${left.locale || ''}|${left.key || ''}`.localeCompare(
      `${right.code}|${right.locale || ''}|${right.key || ''}`,
    );
  });
  const errors = issues.filter(issue => issue.severity === 'error');
  const warnings = issues.filter(issue => issue.severity === 'warning');
  const issueCounts = Object.fromEntries(
    [...new Set(issues.map(issue => issue.code))]
      .sort()
      .map(code => [code, issues.filter(issue => issue.code === code).length]),
  );
  return {
    ok: errors.length === 0,
    localesDir,
    referenceLocale,
    targetLocales,
    checkedLocaleCount: Object.values(catalogs).filter(
      catalog => catalog && !catalog.error,
    ).length,
    errors,
    warnings,
    issues,
    issueCounts,
    scriptStats,
  };
}

function formatAuditReport(result, options = {}) {
  const maxIssues = Number.isFinite(options.maxIssues)
    ? options.maxIssues
    : 200;
  const reportIssueCounts = Object.fromEntries(
    [...new Set(result.issues.map(issue => issue.code))]
      .sort()
      .map(code => [
        code,
        result.issues.filter(issue => issue.code === code).length,
      ]),
  );
  const lines = [
    `Localization QA: ${result.ok ? 'PASS' : 'FAIL'}`,
    `Catalogs: ${result.checkedLocaleCount}/${result.targetLocales.length} | Errors: ${result.errors.length} | Review warnings: ${result.warnings.length}`,
  ];
  if (Object.keys(reportIssueCounts).length > 0) {
    lines.push(
      `Issue counts: ${Object.entries(reportIssueCounts)
        .map(([code, count]) => `${code}=${count}`)
        .join(', ')}`,
    );
  }

  const shown = result.issues.slice(0, maxIssues);
  for (const issue of shown) {
    const location = [issue.locale, issue.key].filter(Boolean).join(':');
    lines.push(
      `[${issue.severity.toUpperCase()}] ${issue.code}${
        location ? ` (${location})` : ''
      }: ${issue.message}`,
    );
  }
  if (result.issues.length > shown.length) {
    lines.push(
      `... ${
        result.issues.length - shown.length
      } more issue(s); use --json for the complete report.`,
    );
  }
  return lines.join('\n');
}

module.exports = {
  DEFAULT_REFERENCE_LOCALE,
  KNOWN_RTL_LANGUAGES,
  SCRIPT_RULES,
  auditLocaleDirectory,
  calculateScriptStats,
  duplicateJsonKeys,
  extractPlaceholders,
  flattenMessages,
  formatAuditReport,
  hasInvalidTranslationCharacter,
  loadIdenticalAllowlist,
  normalizeLanguage,
  parseCatalogFile,
};
