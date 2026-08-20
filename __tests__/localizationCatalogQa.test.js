const path = require('path');

const {
  SUPPORTED_LOCALES,
  RTL_LANGUAGES,
} = require('../src/i18n/localeRegistry');
const {
  auditLocaleDirectory,
  formatAuditReport,
} = require('../scripts/localizationQa');

let result;

beforeAll(() => {
  result = auditLocaleDirectory({
    localesDir: path.resolve(__dirname, '../src/i18n/locales'),
    targetLocales: SUPPORTED_LOCALES,
    rtlLanguages: RTL_LANGUAGES,
    allowlistPath: path.resolve(
      __dirname,
      '../scripts/i18n-identical-allowlist.json',
    ),
  });
});

test('every registered locale has valid JSON and exact English key/placeholder parity', () => {
  if (result.errors.length > 0) {
    throw new Error(
      formatAuditReport(
        { ...result, issues: result.errors },
        { maxIssues: 80 },
      ),
    );
  }
  expect(result.checkedLocaleCount).toBe(SUPPORTED_LOCALES.length);
});

test('all values copied from English are explicitly reviewed and allowlisted', () => {
  if (result.warnings.length > 0) {
    throw new Error(
      [
        'Unreviewed values are identical to English.',
        'Translate them or add only genuinely language-neutral terms to scripts/i18n-identical-allowlist.json.',
        formatAuditReport(
          { ...result, ok: false, errors: [], issues: result.warnings },
          { maxIssues: 80 },
        ),
      ].join('\n'),
    );
  }
  expect(result.warnings).toEqual([]);
});
