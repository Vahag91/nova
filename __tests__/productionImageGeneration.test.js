import fs from 'fs';
import path from 'path';

const readSource = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const clientApiSource = readSource('src/api/runware.js');
const imageStoreSource = readSource('src/state/useImagesStore.js');
const subscriptionSource = readSource('src/context/SubscriptionContext.js');
const edgeFunctionSource = readSource('supabase/functions/images-runware/index.ts');

describe('production image generation surface', () => {
  test('does not ship temporary image or reviewer diagnostic logs', () => {
    expect(clientApiSource).not.toContain('imageGenerationClientLog');
    expect(imageStoreSource).not.toContain('imageGenerationClientLog');
    expect(subscriptionSource).not.toContain('[reviewer-premium]');
    expect(edgeFunctionSource).not.toContain('logImageGenerationEvent');
  });

  test('does not include the server-side test billing bypass', () => {
    expect(edgeFunctionSource).not.toContain('IMAGE_TEST_MODE');
    expect(edgeFunctionSource).not.toContain('bypassCoinCharge');
    expect(edgeFunctionSource).not.toContain('testing:');
  });
});
