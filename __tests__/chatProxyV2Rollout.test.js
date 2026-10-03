const fs = require('fs');
const path = require('path');

const {
  DEFAULT_CHAT_MODEL,
  DEFAULT_CHAT_MODELS,
  buildModelRegistry,
  normalizeChatModelKey,
} = require('../src/config/models');
const { FREE_MODEL } = require('../src/config/premium');
const { CHAT_PROXY_URL } = require('../src/config/endpoints');
const { MODELS: V2_MODELS } = require('../supabase/functions/chat-proxy-v2/registry');

const read = relativePath => fs.readFileSync(
  path.join(__dirname, '..', relativePath),
  'utf8',
);

describe('chat-proxy-v2 app rollout', () => {
  test('uses Luna as the app default and free model', () => {
    expect(DEFAULT_CHAT_MODEL).toBe('gpt-5.6-luna');
    expect(FREE_MODEL).toBe(DEFAULT_CHAT_MODEL);
    expect(CHAT_PROXY_URL.endsWith('/functions/v1/chat-proxy-v2')).toBe(true);
  });

  test('keeps the app model IDs aligned with the v2 backend allowlist', () => {
    expect(Object.keys(DEFAULT_CHAT_MODELS).sort())
      .toEqual(Object.keys(V2_MODELS).sort());
    expect(Object.values(V2_MODELS).every(
      model => model.upstreamModel === 'gpt-6-luna',
    )).toBe(true);
  });

  test('does not let the legacy models endpoint restore stale UI models', () => {
    const registry = buildModelRegistry({
      'gpt-5.4-nano': {
        provider: 'openai',
        kind: 'chat',
        display: { name: 'Old model' },
      },
      'gpt-5.6-sol': {
        provider: 'openai',
        kind: 'chat',
        display: { name: 'GPT-5.6 Sol' },
      },
    });

    expect(registry['gpt-5.4-nano']).toBeUndefined();
    expect(registry['gpt-5.6-sol'].display.descriptionKey).toBe('gpt56_sol');
    expect(Object.keys(registry).filter(key => registry[key]?.kind === 'chat'))
      .toEqual(Object.keys(DEFAULT_CHAT_MODELS));
  });

  test('migrates saved legacy selections to their current display IDs', () => {
    expect(normalizeChatModelKey('gpt-5.4-nano')).toBe('gpt-5.6-luna');
    expect(normalizeChatModelKey('claude-sonnet-4-20250514')).toBe('claude-sonnet-5');
    expect(normalizeChatModelKey('gemini-3-pro-preview')).toBe('gemini-3.1-pro-preview');
    expect(normalizeChatModelKey('unknown-model')).toBe(DEFAULT_CHAT_MODEL);
  });

  test('keeps web search on the selected v2-compatible model ID', () => {
    const chat = read('src/screens/Chat.js');
    expect(chat).toContain('const requestModelKey = resolvedActiveModel;');
    expect(chat).not.toContain("webSearchNext ? 'gpt-5.2'");
    expect(chat).toContain('allowWebSearch: webSearchNext');
  });
});
