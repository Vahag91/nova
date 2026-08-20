/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const {
  EXISTING_TARGETS,
  TARGETS,
  flattenStrings,
  getAtPath,
  makeBatches,
  normalizeDecimalDigits,
  protectText,
  requestTranslationDirection,
  restoreText,
} = require('./generateLocaleDrafts');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const REPORT_DIR = path.join(ROOT, 'tmp', 'localization-review');

const normalize = value => String(value)
  .toLocaleLowerCase('en-US')
  .replace(/\{\{[^{}]+\}\}/g, ' variable ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function bigrams(value) {
  const normalized = ` ${normalize(value)} `;
  const result = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }
  return result;
}

function diceSimilarity(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  a.forEach(value => {
    if (b.has(value)) intersection += 1;
  });
  return (2 * intersection) / (a.size + b.size);
}

async function translateBatchToEnglish(batch, sourceLanguage) {
  const prepared = batch.map(entry => ({ ...entry, ...protectText(entry.value) }));
  const source = prepared
    .map((entry, index) => `991234567${String(index).padStart(4, '0')}\n${entry.protectedText}`)
    .join('\n');
  const translated = await requestTranslationDirection(
    source,
    sourceLanguage,
    'en',
  );
  const marker = /991234567(\d{4})/g;
  const normalizedTranslation = normalizeDecimalDigits(translated);
  const matches = [...normalizedTranslation.matchAll(marker)];
  if (matches.length !== batch.length) {
    throw new Error(
      `Back-translation marker mismatch: expected ${batch.length}, got ${matches.length}`,
    );
  }
  return prepared.map((entry, index) => {
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? normalizedTranslation.length;
    return restoreText(normalizedTranslation.slice(start, end), entry.replacements);
  });
}

async function reviewLocale(locale, sourceLanguage, english) {
  const localePath = path.join(LOCALES_DIR, `${locale}.json`);
  const translated = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  const sourceEntries = flattenStrings(english);
  const localeEntries = sourceEntries.map(entry => {
    const translatedValue = getAtPath(translated, entry.path);
    if (typeof translatedValue !== 'string') {
      throw new Error(`${locale} is missing ${entry.path.join('.')}`);
    }
    return {
      ...entry,
      value: translatedValue,
      protectedText: translatedValue,
    };
  });
  const batches = makeBatches(localeEntries, 3400);
  const reviews = [];

  for (const batch of batches) {
    const backtranslations = await translateBatchToEnglish(batch, sourceLanguage);
    batch.forEach((entry, index) => {
      const englishValue = getAtPath(english, entry.path);
      const translatedValue = entry.value;
      const backtranslation = backtranslations[index];
      reviews.push({
        key: entry.path.join('.'),
        english: englishValue,
        translation: translatedValue,
        backtranslation,
        similarity: Number(diceSimilarity(englishValue, backtranslation).toFixed(3)),
      });
    });
    console.log(`${locale}: reviewed ${reviews.length}/${localeEntries.length}`);
  }

  const report = {
    locale,
    reviewed: reviews.length,
    flagged: reviews.filter(item => item.similarity < 0.42).length,
    items: reviews.sort((a, b) => a.similarity - b.similarity),
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORT_DIR, `${locale}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

async function main() {
  const targetMap = { ...EXISTING_TARGETS, ...TARGETS };
  const requested = process.argv.slice(2);
  if (requested.length === 0) {
    throw new Error('Pass one or more locale bundle names to review.');
  }
  const english = JSON.parse(
    fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'),
  );
  for (const locale of requested) {
    const sourceLanguage = targetMap[locale];
    if (!sourceLanguage) throw new Error(`Unknown locale ${locale}`);
    await reviewLocale(locale, sourceLanguage, english);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
