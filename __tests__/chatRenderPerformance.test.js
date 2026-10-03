import React from 'react';
import renderer, { act } from 'react-test-renderer';
const mockRenders = jest.fn();
const mockMarkdown = jest.fn();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: k => k }) }));
jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, FadeOutDown: animation };
});
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }));
jest.mock('../src/components/chat/DaySeparator', () => () => null);
jest.mock('../src/components/chat/MessageBubble', () => {
  const React = require('react');
  return React.memo(props => { mockRenders(props.message.id); return React.createElement('Bubble', props); });
});
jest.mock('../src/components/chat/MarkdownContent', () => props => { mockMarkdown(props.text); return null; });
import MessageList from '../src/components/chat/MessageList';
import StreamingText from '../src/components/chat/StreamingText';
import { appendStream, clearStream } from '../src/lib/streamingBuffer';

describe('chat render budget', () => {
  beforeEach(() => { jest.useFakeTimers(); mockRenders.mockClear(); mockMarkdown.mockClear(); });
  afterEach(() => { jest.useRealTimers(); });
  test('stream updates do not render older messages; report prompt updates with edits', () => {
    const user = { id: 'u', role: 'user', content: 'original', createdAt: 1 };
    const old = { id: 'a', role: 'assistant', content: 'saved', createdAt: 2 };
    const tail = { id: 'b', role: 'assistant', content: 'partial', createdAt: 3 };
    const props = { messages: [user, old, tail], streaming: true, streamingMessageId: 'b', threadKey: 't', onReport: jest.fn(), onRetryFromHere: jest.fn() };
    let tree;
    act(() => { tree = renderer.create(<MessageList {...props} />); });
    mockRenders.mockClear();
    act(() => { tree.update(<MessageList {...props} />); });
    expect(mockRenders).not.toHaveBeenCalled();
    act(() => { tree.update(<MessageList {...props} messages={[user, old, { ...tail, content: 'more' }]} />); });
    expect(mockRenders.mock.calls.map(c => c[0])).toEqual(['b']);
    act(() => { tree.update(<MessageList {...props} messages={[{ ...user, content: 'edited' }, old, tail]} />); });
    const saved = tree.root.findAllByType('Bubble').find(n => n.props.message.id === 'a');
    expect(saved.props.reportPrompt).toBe('edited');
    act(() => tree.unmount());
  });
  test('streaming batches Markdown updates and drains without losing text', () => {
    const text = 'A short response with **formatted text**.';
    appendStream('budget', text);
    let tree;
    act(() => { tree = renderer.create(<StreamingText messageId="budget" streaming />); });
    mockMarkdown.mockClear();
    for (let i = 0; i < 10; i++) act(() => jest.advanceTimersByTime(10));
    expect(mockMarkdown.mock.calls.length).toBeLessThanOrEqual(2);
    expect(mockMarkdown.mock.calls.length).toBeGreaterThan(0);
    act(() => { tree.update(<StreamingText messageId="budget" base={text} streaming={false} />); });
    for (let i = 0; i < 10; i++) act(() => jest.advanceTimersByTime(50));
    expect(mockMarkdown.mock.calls.at(-1)[0]).toBe(text);
    act(() => tree.unmount());
    clearStream('budget');
  });
});
