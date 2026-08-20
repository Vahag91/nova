/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  EXISTING_TARGETS,
  TARGETS,
  protectText,
  requestTranslation,
  restoreText,
  normalizeDecimalDigits,
} = require('./generateLocaleDrafts');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCALES = path.join(ROOT, 'src', 'i18n', 'locales');
const ALLOWLIST = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts', 'i18n-identical-allowlist.json'), 'utf8'),
);

function leaves(value, segments = [], output = []) {
  if (typeof value === 'string') output.push({ segments, value });
  else if (Array.isArray(value)) value.forEach((item, index) => leaves(item, [...segments, String(index)], output));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => leaves(item, [...segments, key], output));
  return output;
}

function getAt(object, segments) {
  return segments.reduce((value, segment) => value && Object.prototype.hasOwnProperty.call(value, segment) ? value[segment] : undefined, object);
}

function setAt(object, segments, value) {
  let cursor = object;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) cursor[segment] = value;
    else cursor = cursor[segment];
  });
}

function batches(entries, max = 3400) {
  const output = []; let current = []; let count = 0;
  for (const entry of entries) {
    const size = entry.protectedText.length + 22;
    if (current.length && count + size > max) { output.push(current); current = []; count = 0; }
    current.push(entry); count += size;
  }
  if (current.length) output.push(current);
  return output;
}

async function translateBatch(entries, language) {
  const source = entries.map((entry, index) => `991234567${String(index).padStart(4, '0')}\n${entry.protectedText}`).join('\n');
  const response = normalizeDecimalDigits(await requestTranslation(source, language));
  const markers = [...response.matchAll(/991234567(\d{4})/g)];
  if (markers.length !== entries.length) {
    if (entries.length === 1) return [restoreText(await requestTranslation(entries[0].protectedText, language), entries[0].replacements)];
    const middle = Math.ceil(entries.length / 2);
    return [
      ...(await translateBatch(entries.slice(0, middle), language)),
      ...(await translateBatch(entries.slice(middle), language)),
    ];
  }
  return entries.map((entry, index) => {
    const start = markers[index].index + markers[index][0].length;
    const end = markers[index + 1]?.index ?? response.length;
    return restoreText(response.slice(start, end), entry.replacements);
  });
}

async function main() {
  const requested = process.argv.slice(2);
  const targetMap = { ...EXISTING_TARGETS, ...TARGETS };
  const allLocales = Object.keys(targetMap).filter(locale => locale !== 'rm');
  const locales = requested.length ? requested : allLocales;
  const english = JSON.parse(fs.readFileSync(path.join(LOCALES, 'en.json'), 'utf8'));
  const englishLeaves = leaves(english);
  const global = new Set(ALLOWLIST.global || []);

  for (const locale of locales) {
    const targetLanguage = targetMap[locale];
    if (!targetLanguage) throw new Error(`Unsupported locale: ${locale}`);
    const localePath = path.join(LOCALES, `${locale}.json`);
    const catalog = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    const localAllowlist = new Set([...(ALLOWLIST.locales?.[locale] || []), ...global]);
    const candidates = englishLeaves
      .filter(({ segments, value }) => {
        const key = segments.join('.');
        return getAt(catalog, segments) === value && !localAllowlist.has(key) && /\p{Letter}/u.test(value);
      })
      .map(entry => ({ ...entry, ...protectText(entry.value) }));
    if (!candidates.length) continue;
    let completed = 0;
    for (const batch of batches(candidates)) {
      const translated = await translateBatch(batch, targetLanguage);
      batch.forEach((entry, index) => setAt(catalog, entry.segments, translated[index]));
      completed += batch.length;
    }
    fs.writeFileSync(localePath, `${JSON.stringify(catalog, null, 2)}\n`);
    console.log(`${locale}: reviewed ${completed} formerly-English values`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
