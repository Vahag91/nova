const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Android Fabric crash regressions', () => {
  test('assistant selector does not use an unsupported dialog role', () => {
    const source = read('src/navigation/DrawerNavigator.js');
    expect(source).not.toContain('accessibilityRole="dialog"');
    expect(source).toContain('accessibilityViewIsModal');
  });

  test('assistant selector mounts deterministic, unclipped list rows', () => {
    const source = read('src/navigation/DrawerNavigator.js');
    expect(source).not.toContain('FadeInDown');
    expect(source).toContain('animationType="fade"');
    expect(source).toContain('removeClippedSubviews={false}');
    expect(source.indexOf('const currentPresetId')).toBeLessThan(
      source.indexOf('if (!currentPresetId)'),
    );
  });

  test('model selector avoids animated virtualized row mounting', () => {
    const source = read('src/components/ModelSelector.jsx');
    expect(source).not.toContain('entering=');
    expect(source).toContain('animationType="fade"');
    expect(source).toContain('removeClippedSubviews={false}');
    expect(source).toContain("it.type === 'row' ? it.key : it.id");
  });

  test('crash-prone Android lists keep clipping disabled', () => {
    const files = [
      'src/navigation/DrawerNavigator.js',
      'src/components/ModelSelector.jsx',
      'src/components/chat/MessageList.jsx',
      'src/screens/Assistants.jsx',
      'src/screens/CreateImage.jsx',
      'src/screens/EditImage.jsx',
      'src/screens/HistorySimple.jsx',
    ];

    files.forEach(file => {
      expect(read(file)).not.toMatch(/removeClippedSubviews(?:\s|>)/);
      expect(read(file)).toContain('removeClippedSubviews={false}');
    });
  });

  test('assistant text columns cannot receive a negative flex width', () => {
    const drawer = read('src/navigation/DrawerNavigator.js');
    const assistants = read('src/screens/Assistants.jsx');
    const models = read('src/components/ModelSelector.jsx');

    expect(drawer).toMatch(/sheetRowText:\s*\{[\s\S]*?minWidth:\s*0/);
    expect(assistants).toMatch(/cardBody:\s*\{[^}]*minWidth:\s*0/);
    expect(models).toMatch(/modelTextColumn:\s*\{[^}]*minWidth:\s*0/);
  });

  test('uses the Android draw-pass fix and the Worklets Babel plugin', () => {
    const pkg = JSON.parse(read('package.json'));
    const babel = read('babel.config.js');

    expect(pkg.dependencies['react-native-reanimated']).toBe('4.2.3');
    expect(pkg.dependencies['react-native-worklets']).toBe('0.7.0');
    expect(babel).toContain('react-native-worklets/plugin');
    expect(babel).not.toContain('react-native-reanimated/plugin');
  });
});
