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
const allowlist = require('../i18n-identical-allowlist.json');

const ROOT = path.resolve(__dirname, '..', '..');
const DIRECTORY = path.join(ROOT, 'src', 'i18n', 'locales');

function leaves(value, segments = [], result = []) {
  if (typeof value === 'string') result.push({ segments, value });
  else if (Array.isArray(value)) value.forEach((item, index) => leaves(item, [...segments, String(index)], result));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => leaves(item, [...segments, key], result));
  return result;
}
function getAt(value, segments) { return segments.reduce((node, key) => node && Object.prototype.hasOwnProperty.call(node, key) ? node[key] : undefined, value); }
function setAt(value, segments, next) { let node = value; segments.forEach((key, index) => { if (index === segments.length - 1) node[key] = next; else node = node[key]; }); }
function chunk(entries, max = 3200) { const output=[]; let current=[]; let size=0; for (const entry of entries) { const next=entry.protectedText.length+60; if(current.length&&size+next>max){output.push(current);current=[];size=0;} current.push(entry);size+=next;} if(current.length)output.push(current); return output; }

async function translate(entries, locale) {
  const source = entries.map((entry, index) => `991234567${String(index).padStart(4, '0')}\n${entry.protectedText} ||| mobile app user-interface text`).join('\n');
  const response = normalizeDecimalDigits(await requestTranslation(source, locale));
  const markers = [...response.matchAll(/991234567(\d{4})/g)];
  if (markers.length !== entries.length) {
    if (entries.length === 1) {
      const raw = await requestTranslation(`${entries[0].protectedText} ||| mobile app user-interface text`, locale);
      return [restoreText(raw.split('|||')[0], entries[0].replacements)];
    }
    const middle = Math.ceil(entries.length / 2);
    return [...(await translate(entries.slice(0, middle), locale)), ...(await translate(entries.slice(middle), locale))];
  }
  return entries.map((entry, index) => {
    const start = markers[index].index + markers[index][0].length;
    const end = markers[index + 1]?.index ?? response.length;
    return restoreText(response.slice(start, end).split('|||')[0], entry.replacements);
  });
}

async function main() {
  const targetMap = { ...EXISTING_TARGETS, ...TARGETS };
  const english = JSON.parse(fs.readFileSync(path.join(DIRECTORY, 'en.json'), 'utf8'));
  const source = leaves(english);
  const global = new Set(allowlist.global || []);
  for (const [locale, target] of Object.entries(targetMap)) {
    if (locale === 'rm' || !fs.existsSync(path.join(DIRECTORY, `${locale}.json`))) continue;
    const catalogPath = path.join(DIRECTORY, `${locale}.json`);
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const allowed = new Set([...global, ...(allowlist.locales?.[locale] || [])]);
    const entries = source.filter(item => getAt(catalog, item.segments) === item.value && !allowed.has(item.segments.join('.')) && /\p{Letter}/u.test(item.value)).map(item => ({ ...item, ...protectText(item.value) }));
    if (!entries.length) continue;
    let done=0;
    for (const batch of chunk(entries)) {
      const results = await translate(batch, target);
      batch.forEach((entry, index) => setAt(catalog, entry.segments, results[index] || entry.value));
      done += batch.length;
    }
    fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    console.log(`${locale}: contextualized ${done} values`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
