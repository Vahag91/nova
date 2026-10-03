const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const en = JSON.parse(read('src/i18n/locales/en.json'));
const flat = (object, prefix = '') =>
  Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? flat(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
const workspaceKeys = new Set(flat(en.workspace));

// Every literal key passed to the workspace copy helper must exist in the
// catalog; otherwise its English fallback ships to every language.
const SOURCES = {
  'src/screens/SourceWorkspace.jsx': /\bc\(\s*'([A-Za-z0-9_.]+)'/g,
  'src/components/workspace/WorkspaceShortcuts.jsx': /\bc\(\s*'([A-Za-z0-9_.]+)'/g,
  'src/components/chat/TestInput.jsx': /\bc\(\s*'([A-Za-z0-9_.]+)'/g,
  'src/navigation/AndroidNavigationMenu.jsx': /\bc\(\s*'([A-Za-z0-9_.]+)'/g,
  'src/navigation/DrawerNavigator.js': /\bc\(\s*'([A-Za-z0-9_.]+)'/g,
  'src/screens/Chat.js': /\bvideoCopy\(\s*'([A-Za-z0-9_.]+)'/g,
  'src/lib/documentCoverage.js': /\bcopy\(\s*'([A-Za-z0-9_.]+)'/g,
};

test.each(Object.entries(SOURCES))('%s uses only catalogued workspace keys', (file, pattern) => {
  const keys = [...read(file).matchAll(pattern)].map(match => match[1]);
  expect(keys.length).toBeGreaterThan(0);
  expect(keys.filter(key => !workspaceKeys.has(key))).toEqual([]);
});

test('every error code shown by the workspace or chat video flow has catalog copy', () => {
  const codes = (file, name) => {
    const block = read(file).match(new RegExp(`${name} = \\{([\\s\\S]*?)\\n\\};`))[1];
    return [...block.matchAll(/^\s+([A-Z_]+):/gm)].map(match => match[1]);
  };
  expect(codes('src/screens/SourceWorkspace.jsx', 'const errors').filter(code => !(code in en.workspace.errors))).toEqual([]);
  expect(codes('src/lib/videoChat.js', 'export const videoErrors').filter(code => !(code in en.workspace.videoErrors))).toEqual([]);
});

test('shared summaries use translated headings', () => {
  const { SUMMARY_LABELS, summaryLabels, summaryMarkdown } = require('../src/lib/workspace');
  expect(Object.keys(SUMMARY_LABELS).every(key => `markdown.${key}` && key in en.workspace.markdown)).toBe(true);
  const labels = summaryLabels((key, fallback) => `[${key}] ${fallback}`);
  const markdown = summaryMarkdown({ title: '', overview: 'O', keyPoints: ['A'], sections: [], actions: ['B'], evidence: [], limitations: ['C'] }, labels);
  expect(markdown).toContain('# [markdown.summary] Summary');
  expect(markdown).toContain('## [markdown.keyTakeaways] Key takeaways');
  expect(markdown).toContain('## [markdown.actionItems] Action items');
  expect(markdown).toContain('## [markdown.coverageNotes] Coverage notes');
});

test('the workspace hook reads from the main catalog namespace', () => {
  const hook = read('src/i18n/useWorkspaceTranslation.js');
  expect(hook).toContain('t(`workspace.${key}`');
  expect(read('src/i18n/index.js')).not.toContain('workspace/en.json');
});

test('built-in model taglines are translatable keys, not English literals', () => {
  const { DEFAULT_CHAT_MODELS } = require('../src/config/models');
  for (const model of Object.values(DEFAULT_CHAT_MODELS)) {
    expect(model.display.description).toBeUndefined();
    expect(en.modelDescriptions[model.display.descriptionKey]).toBeTruthy();
  }
});
