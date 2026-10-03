const fs = require('fs');
const path = require('path');

// An RTL string whose first strong character is Latin (a brand, a format list or a
// {{placeholder}} filled with Latin text) is laid out left-to-right by Android and
// scrambles the surrounding Arabic/Hebrew. Such strings must start with U+200F.
const RLM = '‏';
const strings = value =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
    ? value.flatMap(strings)
    : value && typeof value === 'object'
    ? Object.values(value).flatMap(strings)
    : [];

test.each(['ar', 'fa', 'fa-AF', 'ur', 'he'])('%s strings keep a right-to-left base direction', locale => {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src/i18n/locales', `${locale}.json`), 'utf8'));
  const offenders = strings(catalog).filter(value => {
    if (value.startsWith(RLM) || !/[֐-ࣿ]/.test(value)) return false;
    const first = value.replace(/\{\{[^}]*\}\}/g, 'A').match(/[A-Za-z֐-ࣿ]/);
    return first && /[A-Za-z]/.test(first[0]);
  });
  expect(offenders).toEqual([]);
});
