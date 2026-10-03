import React from 'react';
import renderer, { act } from 'react-test-renderer';
const mockScrollTo = jest.fn();
let mockFocused = true;
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  const React = require('react');
  return { AccessibilityInfo: rn.AccessibilityInfo, AppState: rn.AppState, I18nManager: rn.I18nManager, Text: rn.Text, StyleSheet: rn.StyleSheet, ScrollView: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return React.createElement('Row', props, props.children);
  }) };
});
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key, options) => options.defaultValue }) }));
jest.mock('../src/i18n/useWorkspaceTranslation', () => ({ useWorkspaceTranslation: () => ({ c: (key, fallback) => fallback }) }));
jest.mock('../src/state/useSourceWorkspaceAvailability', () => ({ useSourceWorkspaceAvailability: () => true }));
jest.mock('../src/components/ui/PressableScale', () => 'Chip');
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Path: 'Path' }));
import { AccessibilityInfo, AppState } from 'react-native';
import SuggestionCards from '../src/components/chat/SuggestionCards';

test('suggestion row rotates, pauses on touch and off-screen, and keeps the requested actions', async () => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  let tree;
  const press = jest.fn();
  await act(async () => { tree = renderer.create(<SuggestionCards onSuggestionPress={press} />); });
  const chips = tree.root.findAllByType('Chip');
  expect(chips).toHaveLength(4);
  chips.forEach(chip => act(() => chip.props.onPress()));
  expect(press.mock.calls.map(call => call[0].id)).toEqual(['documents', 'video-summaries', 'open-camera', 'assistants']);
  const row = tree.root.findByType('Row');
  act(() => {
    row.props.onLayout({ nativeEvent: { layout: { width: 360 } } });
    row.props.onContentSizeChange(620);
    jest.advanceTimersByTime(4500);
  });
  expect(mockScrollTo).toHaveBeenCalledWith({ x: 234, animated: true });
  mockScrollTo.mockClear();
  act(() => { row.props.onTouchStart(); jest.advanceTimersByTime(9000); });
  expect(mockScrollTo).not.toHaveBeenCalled();
  mockFocused = false;
  act(() => tree.update(<SuggestionCards onSuggestionPress={() => {}} />));
  act(() => jest.advanceTimersByTime(18000));
  expect(mockScrollTo).not.toHaveBeenCalled();
  act(() => tree.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

