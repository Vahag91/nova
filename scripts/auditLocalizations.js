#!/usr/bin/env node
'use strict';

const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const { auditLocaleDirectory, formatAuditReport } = require('./localizationQa');

function parseArgs(argv) {
  const options = {
    json: false,
    strictIdentical: false,
    localesDir: path.resolve(__dirname, '../src/i18n/locales'),
    registry: path.resolve(__dirname, '../src/i18n/localeRegistry.js'),
    allowlistPath: path.resolve(__dirname, './i18n-identical-allowlist.json'),
    maxIssues: 200,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--strict-identical') options.strictIdentical = true;
    else if (argument === '--locales-dir')
      options.localesDir = path.resolve(argv[++index]);
    else if (argument === '--registry')
      options.registry = path.resolve(argv[++index]);
    else if (argument === '--allowlist')
      options.allowlistPath = path.resolve(argv[++index]);
    else if (argument === '--max-issues')
      options.maxIssues = Number(argv[++index]);
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function requireProjectModule(filePath) {
  const transformed = babel.transformFileSync(filePath, {
    babelrc: false,
    configFile: false,
    sourceMaps: false,
    presets: [
      [
        require.resolve('@babel/preset-env'),
        { targets: { node: 'current' }, modules: 'commonjs' },
      ],
    ],
  });
  const loaded = new Module(filePath, module);
  loaded.filename = filePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(filePath));
  loaded._compile(transformed.code, filePath);
  return loaded.exports;
}

function toArray(value, exportName) {
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  throw new Error(
    `${exportName} must be an array or Set in localeRegistry.js.`,
  );
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/auditLocalizations.js [options]',
      '',
      'Options:',
      '  --strict-identical     Fail on non-allowlisted values copied from English',
      '  --json                 Print the complete machine-readable result',
      '  --max-issues NUMBER    Maximum issues in the text report (default: 200)',
      '  --locales-dir PATH     Override src/i18n/locales',
      '  --registry PATH        Override src/i18n/localeRegistry.js',
      '  --allowlist PATH       Override identical-English allowlist',
      '  -h, --help             Show this help',
      '',
    ].join('\n'),
  );
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }

  const registry = requireProjectModule(options.registry);
  const targetLocales = toArray(
    registry.SUPPORTED_LOCALES,
    'SUPPORTED_LOCALES',
  );
  const rtlLanguages = toArray(registry.RTL_LANGUAGES, 'RTL_LANGUAGES');
  const result = auditLocaleDirectory({
    localesDir: options.localesDir,
    targetLocales,
    rtlLanguages,
    allowlistPath: options.allowlistPath,
    strictIdentical: options.strictIdentical,
  });

  process.stdout.write(
    `${
      options.json
        ? JSON.stringify(result, null, 2)
        : formatAuditReport(result, { maxIssues: options.maxIssues })
    }\n`,
  );
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(
      `Localization QA could not run: ${error.stack || error.message}\n`,
    );
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs, requireProjectModule, toArray };
