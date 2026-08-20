#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { extractPlaceholders, parseCatalogFile } = require('../localizationQa');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const PENDING_DIR = path.join(ROOT, 'translations', 'manual', 'pending');
const REFERENCE_DIR = path.join(ROOT, 'translations', 'manual', 'reference');

function readJson(filePath) {
  const result = parseCatalogFile(filePath);
  if (result.error) throw new Error(`${filePath}: ${result.error}`);
  return result.parsed;
}

function setAtPath(object, segments, value) {
  let current = object;
  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    const nextIsIndex = /^\d+$/.test(segments[index + 1] || '');
    if (isLast) {
      current[segment] = value;
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      current[segment] = nextIsIndex ? [] : {};
    }
    current = current[segment];
  });
}

function collectStringLeaves(value, pathSegments = [], output = []) {
  if (typeof value === 'string') {
    output.push({ path: pathSegments, value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectStringLeaves(item, [...pathSegments, String(index)], output),
    );
    return output;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) =>
      collectStringLeaves(item, [...pathSegments, key], output),
    );
  }
  return output;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const localeIndex = process.argv.indexOf('--locale');
  const requestedLocale =
    localeIndex >= 0 ? String(process.argv[localeIndex + 1] || '').trim() : '';
  if (localeIndex >= 0 && !requestedLocale) {
    throw new Error('Pass a locale after --locale, for example: --locale nl');
  }
  const english = readJson(path.join(LOCALES_DIR, 'en.json'));
  const englishMessages = collectStringLeaves(english);
  const pendingFiles = fs.readdirSync(PENDING_DIR)
    .filter(file => file.endsWith('.json'))
    .filter(file => !requestedLocale || file === `${requestedLocale}.json`);
  if (requestedLocale && pendingFiles.length === 0) {
    throw new Error(`No pending translation file exists for ${requestedLocale}.`);
  }
  const failures = [];
  const ready = [];

  for (const filename of pendingFiles) {
    const locale = filename.slice(0, -5);
    const pending = readJson(path.join(PENDING_DIR, filename));
    const reference = readJson(path.join(REFERENCE_DIR, `${locale}.en.json`));
    const pendingMessages = new Map(
      collectStringLeaves(pending).map(item => [JSON.stringify(item.path), item]),
    );
    const referenceMessages = collectStringLeaves(reference);
    for (const referenceItem of referenceMessages) {
      const key = referenceItem.path.join('.');
      const translated = pendingMessages.get(JSON.stringify(referenceItem.path))?.value;
      if (typeof translated !== 'string' || !translated.trim()) {
        failures.push(`${locale}:${key} is empty`);
        continue;
      }
      const expected = extractPlaceholders(referenceItem.value).join('|');
      const actual = extractPlaceholders(translated).join('|');
      if (expected !== actual) failures.push(`${locale}:${key} has different placeholders`);
    }
    if (!failures.some(item => item.startsWith(`${locale}:`))) ready.push(locale);
  }

  if (failures.length) {
    throw new Error(`Manual translations are incomplete:\n${failures.slice(0, 80).join('\n')}${failures.length > 80 ? `\n... ${failures.length - 80} more` : ''}`);
  }

  for (const locale of ready) {
    const currentPath = path.join(LOCALES_DIR, `${locale}.json`);
    const current = fs.existsSync(currentPath) ? readJson(currentPath) : {};
    const merged = structuredClone(english);
    const currentMessages = new Map(
      collectStringLeaves(current).map(item => [JSON.stringify(item.path), item.value]),
    );
    const pendingMessages = new Map(
      collectStringLeaves(readJson(path.join(PENDING_DIR, `${locale}.json`))).map(item => [JSON.stringify(item.path), item.value]),
    );
    for (const englishItem of englishMessages) {
      const key = JSON.stringify(englishItem.path);
      const value = pendingMessages.get(key) || currentMessages.get(key);
      if (typeof value === 'string') setAtPath(merged, englishItem.path, value);
    }
    if (!dryRun) fs.writeFileSync(currentPath, `${JSON.stringify(merged, null, 2)}\n`);
  }

  console.log(`${dryRun ? 'Validated' : 'Applied'} ${ready.length} locale file(s).`);
}

main();
