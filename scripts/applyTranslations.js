#!/usr/bin/env node
'use strict';

/**
 * Merges translated values into a locale catalog with full validation.
 *
 * Usage:
 *   node scripts/applyTranslations.js <locale> <translations.json>
 *   node scripts/applyTranslations.js --todo [locale...]
 *
 * The translations file maps flat dotted keys (exactly as produced by
 * `--todo`) to translated strings:
 *   { "oneTimeOffer.title": "...", "createImage.starterPrompts.items": ["..."] }
 *
 * `--todo` writes translation-todo/<locale>.json for every catalog that still
 * contains unreviewed English values, keyed by flat key with the English
 * source text as the value. Translate the values in place, then apply the
 * file back with the first form.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const TODO_DIR = path.join(ROOT, 'translation-todo');
const ALLOWLIST_PATH = path.join(__dirname, 'i18n-identical-allowlist.json');

const readJson = file =>
  JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));

const EN = readJson(path.join(LOCALES_DIR, 'en.json'));

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Flat keys never split object keys that themselves contain dots (model ids
// such as "gpt-5.4-nano"), so traversal is driven by the English structure.
function collectLeafPaths(node, prefix, out) {
  for (const [key, value] of Object.entries(node)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (isObj(value)) collectLeafPaths(value, flatKey, out);
    else out.push({ flatKey, segments: null });
  }
  return out;
}

function resolveSegments(flatKey) {
  // Resolve a flat key against the English structure, longest-prefix first,
  // so dotted object keys stay intact.
  const segments = [];
  let node = EN;
  let rest = flatKey;
  while (rest.length > 0) {
    if (!isObj(node)) return null;
    const keys = Object.keys(node).sort((a, b) => b.length - a.length);
    const match = keys.find(k => rest === k || rest.startsWith(k + '.'));
    if (!match) return null;
    segments.push(match);
    node = node[match];
    rest = rest === match ? '' : rest.slice(match.length + 1);
  }
  return segments;
}

function getBySegments(obj, segments) {
  return segments.reduce((n, s) => (n == null ? undefined : n[s]), obj);
}

function setBySegments(obj, segments, value) {
  let node = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    if (!isObj(node[segments[i]])) node[segments[i]] = {};
    node = node[segments[i]];
  }
  node[segments[segments.length - 1]] = value;
}

function orderLike(reference, target) {
  if (Array.isArray(target) || !isObj(target)) return target;
  const result = {};
  for (const key of Object.keys(reference || {})) {
    if (key in target) result[key] = orderLike(reference[key], target[key]);
  }
  return result;
}

const extractPlaceholders = value =>
  typeof value === 'string'
    ? (value.match(/\{\{\s*([\w$.-]+)/g) || [])
        .map(m => m.replace(/\{\{\s*/, ''))
        .sort()
        .join(',')
    : '';

function loadAllowlist() {
  try {
    const parsed = readJson(ALLOWLIST_PATH);
    return {
      global: parsed.global || [],
      locales: parsed.locales || {},
    };
  } catch (_) {
    return { global: [], locales: {} };
  }
}

function writeTodoFiles(requestedLocales) {
  const allowlist = loadAllowlist();
  const leafKeys = [];
  collectLeafPaths(EN, '', leafKeys);
  const locales = (requestedLocales.length
    ? requestedLocales
    : fs
        .readdirSync(LOCALES_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => path.basename(f, '.json'))
  ).filter(l => l !== 'en');

  if (!fs.existsSync(TODO_DIR)) fs.mkdirSync(TODO_DIR);
  const summary = [];
  for (const locale of locales) {
    const file = path.join(LOCALES_DIR, `${locale}.json`);
    if (!fs.existsSync(file)) continue;
    const data = readJson(file);
    const todo = {};
    for (const { flatKey } of leafKeys) {
      const segments = resolveSegments(flatKey);
      const enValue = getBySegments(EN, segments);
      const value = getBySegments(data, segments);
      const identical = Array.isArray(enValue)
        ? JSON.stringify(enValue) === JSON.stringify(value)
        : enValue === value;
      if (
        identical &&
        /\p{Letter}/u.test(String(enValue)) &&
        !allowlist.global.includes(flatKey) &&
        !(allowlist.locales[locale] || []).includes(flatKey)
      ) {
        todo[flatKey] = enValue;
      }
    }
    const todoFile = path.join(TODO_DIR, `${locale}.json`);
    if (Object.keys(todo).length > 0) {
      fs.writeFileSync(todoFile, JSON.stringify(todo, null, 2) + '\n', 'utf8');
      summary.push(`${locale}: ${Object.keys(todo).length} value(s) -> translation-todo/${locale}.json`);
    } else if (fs.existsSync(todoFile)) {
      fs.unlinkSync(todoFile);
    }
  }
  console.log(summary.join('\n') || 'No pending translations. All catalogs are reviewed.');
}

function applyTranslations(locale, translationsFile) {
  const catalogFile = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(catalogFile)) {
    console.error(`Unknown locale catalog: ${locale}`);
    process.exit(1);
  }
  const data = readJson(catalogFile);
  const translations = readJson(translationsFile);
  const errors = [];
  let applied = 0;

  for (const [flatKey, value] of Object.entries(translations)) {
    const segments = resolveSegments(flatKey);
    if (!segments) {
      errors.push(`Unknown key (not in en.json): ${flatKey}`);
      continue;
    }
    const enValue = getBySegments(EN, segments);
    if (Array.isArray(enValue)) {
      if (!Array.isArray(value) || value.length !== enValue.length || value.some(v => typeof v !== 'string' || !v.trim())) {
        errors.push(`${flatKey}: must be an array of ${enValue.length} non-empty strings`);
        continue;
      }
    } else {
      if (typeof value !== 'string' || !value.trim()) {
        errors.push(`${flatKey}: value must be a non-empty string`);
        continue;
      }
      if (extractPlaceholders(value) !== extractPlaceholders(enValue)) {
        errors.push(
          `${flatKey}: placeholder mismatch (expected ${extractPlaceholders(enValue) || 'none'}; got ${extractPlaceholders(value) || 'none'})`,
        );
        continue;
      }
    }
    setBySegments(data, segments, value);
    applied++;
  }

  if (errors.length > 0) {
    console.error(`REJECTED ${errors.length} value(s):`);
    for (const error of errors) console.error('  - ' + error);
  }
  fs.writeFileSync(
    catalogFile,
    JSON.stringify(orderLike(EN, data), null, 2) + '\n',
    'utf8',
  );
  console.log(`${locale}: applied ${applied}/${Object.keys(translations).length} value(s).`);
  console.log('Run `npx jest __tests__/localizationCatalogQa.test.js` to verify.');
  process.exit(errors.length > 0 ? 1 : 0);
}

const args = process.argv.slice(2);
if (args[0] === '--todo') {
  writeTodoFiles(args.slice(1));
} else if (args.length === 2) {
  applyTranslations(args[0], args[1]);
} else {
  console.error('Usage: node scripts/applyTranslations.js <locale> <translations.json>');
  console.error('       node scripts/applyTranslations.js --todo [locale...]');
  process.exit(1);
}
