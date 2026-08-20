/**
 * @format
 */

import fs from 'fs';
import path from 'path';

test('keeps the production root providers and startup recovery surface', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');

  expect(source).toContain('<SafeAreaProvider>');
  expect(source).toContain('<SubscriptionProvider');
  expect(source).toContain('<GestureHandlerRootView');
  expect(source).toContain('<StartupLoadingScreen');
  expect(source).toContain('onCatch={handleFatalRenderError}');
});
