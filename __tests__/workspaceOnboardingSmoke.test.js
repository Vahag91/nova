/**
 * Render smoke test for the workspace onboarding (v4).
 *
 * Walks the whole flow the way a first launch does and asserts the integration
 * guarantees App.js depends on: readiness is reported so the native splash can
 * be released, subscriptions warm up behind the flow, and it finishes without
 * presenting an offer of its own - the premium paywall is App's to show.
 *
 * Note on timing: a state update made inside a fake timer is flushed when the
 * surrounding act() block ends, so any timer that update schedules is only
 * registered afterwards. Anything downstream of a timer therefore needs a
 * second advance, which is what `settle` is for.
 */
import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

const mockTrigger = jest.fn();
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: (...args) => mockTrigger(...args) },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

jest.mock('react-native-linear-gradient', () => {
  const { View } = require('react-native');
  return View;
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => (options && options.defaultValue) || key,
  }),
}));

const WorkspaceOnboardingFlow =
  require('../src/components/onboarding/v4/WorkspaceOnboardingFlow').default;
const {
  WORKSPACE_AUTO_ADVANCE_MS,
  WORKSPACE_STEP_DURATION_MS,
  WORKSPACE_TRIAL_DELAY_MS,
  WORKSPACE_TRIAL_TRAVEL_MS,
} = require('../src/components/onboarding/v4/content');

const SETUP_STEPS = 4;
const TRIAL_READY_MS =
  SETUP_STEPS * WORKSPACE_STEP_DURATION_MS +
  WORKSPACE_TRIAL_DELAY_MS +
  WORKSPACE_TRIAL_TRAVEL_MS;

const textContent = tree =>
  tree.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(child => typeof child === 'string')
    .join(' | ');

const settle = (ms = 600) => {
  act(() => jest.advanceTimersByTime(ms));
  act(() => jest.advanceTimersByTime(400));
};

// react-test-renderer cannot match props with asymmetric matchers, so find the
// outermost node that actually carries a layout handler.
const triggerLayout = tree => {
  const [root] = tree.root.findAll(
    node => typeof node.props.onLayout === 'function',
  );
  if (!root) throw new Error('no onLayout handler rendered');
  act(() => {
    root.props.onLayout();
    jest.advanceTimersByTime(64);
  });
};

// Press the accessible control itself, not a wrapper that happens to forward an
// onPress prop of the same name.
const findControl = (tree, label) =>
  tree.root
    .findAll(
      node =>
        typeof node.props.onPress === 'function' &&
        typeof node.props.accessibilityRole === 'string',
    )
    .find(node => textContent({ root: node }).includes(label));

const press = (tree, label) => {
  const target = findControl(tree, label);
  if (!target) throw new Error(`no pressable labelled "${label}"`);
  act(() => target.props.onPress());
};

const pressAndSettle = (tree, label) => {
  press(tree, label);
  settle();
};

const mount = props => {
  let tree;
  act(() => {
    tree = renderer.create(
      <WorkspaceOnboardingFlow
        colorScheme="dark"
        onFinish={jest.fn()}
        {...props}
      />,
    );
  });
  triggerLayout(tree);
  return tree;
};

describe('workspace onboarding smoke test', () => {
  beforeEach(() => {
    mockTrigger.mockClear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  test('walks value demo -> goals -> setup and hands off without a paywall', () => {
    const onFinish = jest.fn();
    const onReady = jest.fn();
    const onGoalsSelected = jest.fn();

    const tree = mount({ onFinish, onReady, onGoalsSelected });

    expect(textContent(tree)).toContain('We Want You To Try');
    expect(textContent(tree)).toContain('Cloud AI');
    expect(onReady).toHaveBeenCalledTimes(1);

    // Step 2: goal selection, gated on at least one choice.
    pressAndSettle(tree, 'Try it for free');
    expect(textContent(tree)).toContain('What do you need help with?');
    expect(textContent(tree)).toContain('Continue');
    expect(findControl(tree, 'Continue')).toBeUndefined();
    press(tree, 'Work faster');
    expect(findControl(tree, 'Continue')).toBeDefined();
    pressAndSettle(tree, 'Continue');
    expect(onGoalsSelected).toHaveBeenCalledWith(['workFaster']);

    // Step 3: setup hands off automatically once the trial state settles.
    expect(textContent(tree)).toContain('Creating your AI assistant');
    settle(TRIAL_READY_MS + 100);
    expect(textContent(tree)).toContain('Your AI assistant is ready');

    // The wait is shown as work being done, not as one line of static text.
    const setupScreen = textContent(tree);
    expect(setupScreen).toContain('Preparing your assistant');
    expect(setupScreen).toContain('Finishing setup');
    expect(setupScreen).toContain('enabled');

    expect(findControl(tree, 'Continue')).toBeUndefined();
    settle(WORKSPACE_AUTO_ADVANCE_MS + 100);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(textContent(tree)).not.toContain('Restore');

    act(() => tree.unmount());
  });

  test('opens the paywall on its own once setup finishes', () => {
    const onFinish = jest.fn();
    const tree = mount({ onFinish });

    pressAndSettle(tree, 'Try it for free');
    press(tree, 'Work faster');
    pressAndSettle(tree, 'Continue');

    settle(TRIAL_READY_MS + 100);
    expect(onFinish).not.toHaveBeenCalled();

    // Nobody taps anything from here on.
    settle(WORKSPACE_AUTO_ADVANCE_MS + 100);
    expect(onFinish).toHaveBeenCalledTimes(1);

    // And the hand-off happens exactly once, tap or no tap.
    settle(2000);
    expect(onFinish).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  test('moves forward and back between steps, one at a time', () => {
    const tree = mount({});

    // Only one step is mounted at a time.
    expect(textContent(tree)).toContain('We Want You To Try');
    expect(textContent(tree)).toContain('Cloud AI');
    expect(textContent(tree)).not.toContain('What do you need help with?');

    pressAndSettle(tree, 'Try it for free');
    expect(textContent(tree)).toContain('What do you need help with?');
    expect(textContent(tree)).not.toContain('Do more with AI in seconds');

    pressAndSettle(tree, '‹');
    expect(textContent(tree)).toContain('We Want You To Try');
    expect(textContent(tree)).toContain('Cloud AI');
    expect(textContent(tree)).not.toContain('What do you need help with?');

    act(() => tree.unmount());
  });

  test('ignores taps arriving while a step change is in flight', () => {
    const tree = mount({});

    // Hold the handler so the second tap fires exactly what the first did, the
    // way a fast double tap reaches it before React has re-rendered the button.
    const handler = findControl(tree, 'Try it for free').props.onPress;
    act(() => handler());
    act(() => handler());
    settle();

    // A double tap must not skip past goal selection.
    expect(textContent(tree)).toContain('What do you need help with?');

    act(() => tree.unmount());
  });

  test('answers every interaction with a haptic', () => {
    const tree = mount({});
    const hapticTypes = () => mockTrigger.mock.calls.map(([type]) => type);

    pressAndSettle(tree, 'Try it for free');
    expect(hapticTypes()).toContain('impactLight');

    // Three picks fill the allowance; the fourth can only answer with a buzz.
    mockTrigger.mockClear();
    press(tree, 'Work faster');
    press(tree, 'Write better');
    press(tree, 'Understand documents');
    expect(hapticTypes()).toEqual(['selection', 'selection', 'selection']);

    mockTrigger.mockClear();
    press(tree, 'Learn anything');
    expect(hapticTypes()).toEqual(['notificationWarning']);
    expect(textContent(tree)).toContain('Continue');

    // Setup reports its own progress, then hands off automatically.
    mockTrigger.mockClear();
    pressAndSettle(tree, 'Continue');
    settle(TRIAL_READY_MS + 100);
    expect(hapticTypes()).toContain('notificationSuccess');

    settle(WORKSPACE_AUTO_ADVANCE_MS + 100);
    expect(hapticTypes()).toContain('impactMedium');

    act(() => tree.unmount());
  });

});
