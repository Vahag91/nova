const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const englishCatalog = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, 'src', 'i18n', 'locales', 'en.json'),
    'utf8',
  ),
);

function collectSourceFiles(entry, output = []) {
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    output.push(entry);
    return output;
  }

  for (const item of fs.readdirSync(entry, { withFileTypes: true })) {
    const itemPath = path.join(entry, item.name);
    if (item.isDirectory()) {
      collectSourceFiles(itemPath, output);
    } else if (/\.(?:js|jsx|ts|tsx)$/.test(item.name)) {
      output.push(itemPath);
    }
  }
  return output;
}

function hasCatalogPath(key) {
  let value = englishCatalog;
  for (const segment of key.split('.')) {
    if (
      value == null ||
      !Object.prototype.hasOwnProperty.call(value, segment)
    ) {
      return false;
    }
    value = value[segment];
  }
  return true;
}

describe('English translation catalog', () => {
  test('contains every statically referenced translation key', () => {
    const files = [
      path.join(repoRoot, 'App.js'),
      ...collectSourceFiles(path.join(repoRoot, 'src')),
    ];
    const missing = [];
    const callPattern =
      /(?:\b(?:t|tr)|\bi18n\.t)\(\s*(['"`])([^'"`${}]+)\1/g;

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = callPattern.exec(source))) {
        const key = match[2];
        if (!hasCatalogPath(key)) {
          const line = source.slice(0, match.index).split(/\r?\n/).length;
          missing.push(
            `${path.relative(repoRoot, file)}:${line} -> ${key}`,
          );
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
