#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const { parseCatalogFile } = require('../localizationQa');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const WORK_DIR = path.join(ROOT, 'translations', 'manual');
const PENDING_DIR = path.join(WORK_DIR, 'pending');
const REFERENCE_DIR = path.join(WORK_DIR, 'reference');
const REGISTRY_PATH = path.join(ROOT, 'src', 'i18n', 'localeRegistry.js');

function loadRegistry() {
  const transformed = babel.transformFileSync(REGISTRY_PATH, {
    babelrc: false,
    configFile: false,
    sourceMaps: false,
    presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' }, modules: 'commonjs' }]],
  });
  const loaded = new Module(REGISTRY_PATH, module);
  loaded.filename = REGISTRY_PATH;
  loaded.paths = Module._nodeModulePaths(path.dirname(REGISTRY_PATH));
  loaded._compile(transformed.code, REGISTRY_PATH);
  return loaded.exports;
}

function readJson(filePath) {
  const result = parseCatalogFile(filePath);
  if (result.error) throw new Error(`${filePath}: ${result.error}`);
  return result.parsed;
}

function getAtPath(object, segments) {
  let current = object;
  for (const segment of segments) {
    if (!current || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
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

function mergeNonEmptyValues(template, existing) {
  const output = structuredClone(template);
  const values = collectStringLeaves(existing);
  for (const { path: keyPath, value } of values) {
    if (typeof value !== 'string' || !value.trim()) continue;
    setAtPath(output, keyPath, value);
  }
  return output;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeReadme() {
  const readmePath = path.join(WORK_DIR, 'README.md');
  const content = `# Manual translation handoff\n\nEach locale in \`pending/\` contains **only the messages that still need translation**.\n\n1. Open \`reference/<locale>.en.json\` for the matching English source text.\n2. Replace every empty string in \`pending/<locale>.json\` with the translation.\n3. Do not rename, remove, or add keys; preserve placeholders such as \`{{name}}\`, URLs, and product/model names.\n4. When a locale file has no empty values, run \`npm run i18n:apply-manual\`. The command validates placeholders, merges the text into the actual app catalog, and removes obsolete keys.\n\nExisting translated values in \`src/i18n/locales/\` are intentionally left untouched until their matching pending file is complete.\n`;
  fs.mkdirSync(WORK_DIR, { recursive: true });
  fs.writeFileSync(readmePath, content);
}

function main() {
  const registry = loadRegistry();
  const targetLocales = registry.SUPPORTED_LOCALES;
  const english = readJson(path.join(LOCALES_DIR, 'en.json'));
  const englishMessages = collectStringLeaves(english);
  const manifest = { generatedAt: new Date().toISOString(), englishMessageCount: englishMessages.length, locales: {} };

  writeReadme();
  writeJson(path.join(REFERENCE_DIR, 'en.json'), english);

  for (const locale of targetLocales) {
    if (locale === 'en') continue;
    const localePath = path.join(LOCALES_DIR, `${locale}.json`);
    const translated = fs.existsSync(localePath) ? readJson(localePath) : {};
    const translatedMessages = collectStringLeaves(translated);
    const translatedPathSet = new Set(translatedMessages.map(item => JSON.stringify(item.path)));
    const englishPathSet = new Set(englishMessages.map(item => JSON.stringify(item.path)));
    const missing = englishMessages.filter(item => !translatedPathSet.has(JSON.stringify(item.path)));
    const extra = translatedMessages.filter(item => !englishPathSet.has(JSON.stringify(item.path)));
    if (missing.length === 0 && extra.length === 0) continue;

    const reference = {};
    const emptyTarget = {};
    for (const item of missing) {
      setAtPath(reference, item.path, item.value);
      setAtPath(emptyTarget, item.path, '');
    }

    const pendingPath = path.join(PENDING_DIR, `${locale}.json`);
    const pending = fs.existsSync(pendingPath) ? readJson(pendingPath) : {};
    writeJson(path.join(REFERENCE_DIR, `${locale}.en.json`), reference);
    writeJson(pendingPath, mergeNonEmptyValues(emptyTarget, pending));
    manifest.locales[locale] = { missingMessages: missing.length, obsoleteKeys: extra.length };
  }

  writeJson(path.join(WORK_DIR, 'manifest.json'), manifest);
  console.log(`Prepared ${Object.keys(manifest.locales).length} manual translation files in ${WORK_DIR}`);
}

main();
