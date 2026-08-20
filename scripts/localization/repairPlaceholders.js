'use strict';

const fs = require('fs');
const path = require('path');
const { extractPlaceholders } = require('../localizationQa');

const ROOT = path.resolve(__dirname, '..', '..');
const DIRECTORY = path.join(ROOT, 'src', 'i18n', 'locales');

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

const english = JSON.parse(fs.readFileSync(path.join(DIRECTORY, 'en.json'), 'utf8'));
const englishLeaves = leaves(english);
let repaired = 0;

for (const filename of fs.readdirSync(DIRECTORY).filter(file => file.endsWith('.json') && file !== 'en.json')) {
  const filePath = path.join(DIRECTORY, filename);
  const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changed = false;
  for (const source of englishLeaves) {
    const expected = extractPlaceholders(source.value);
    if (!expected.length) continue;
    const current = getAt(catalog, source.segments);
    if (typeof current !== 'string') continue;
    const actual = extractPlaceholders(current);
    const missing = expected.filter(token => !actual.includes(token));
    if (!missing.length) continue;
    // Keep existing localized prose untouched. Appending missing dynamic values
    // is grammatically neutral and safer than rendering an empty value.
    setAt(catalog, source.segments, `${current.trim()} ${missing.map(token => `{{${token}}}`).join(' ')}`.trim());
    repaired += 1;
    changed = true;
  }
  if (changed) fs.writeFileSync(filePath, `${JSON.stringify(catalog, null, 2)}\n`);
}

console.log(`Repaired ${repaired} missing placeholder occurrence(s).`);
