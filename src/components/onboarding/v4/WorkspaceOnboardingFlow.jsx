/**
 * Workspace onboarding (v4): ValueDemo -> GoalSelection -> WorkspaceReady.
 *
 * The flow deliberately stops before any offer. Calling `onFinish` hands
 * control back to the app, which presents the existing premium paywall - this
 * component never renders a paywall of its own.
 *
 * The footer stays anchored while the flow mounts exactly one screen at a
 * time. That keeps image decoding and layout work off the navigation path.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GoalSelectionView from './GoalSelectionView';
import ValueDemoView from './ValueDemoView';
import WorkspaceReadyView from './WorkspaceReadyView';
import { PageDots, PrimaryButton } from './primitives';
import { WORKSPACE_AUTO_ADVANCE_MS, useOnboardingContent } from './content';
import { HAPTIC, haptic } from './haptics';
import { useOnboardingTheme } from './theme';

const STEPS = ['valueDemo', 'goals', 'workspace'];
const SCREEN_TRANSITION_MS = 900;
const SCREEN_TRANSITION_EASING = Easing.bezier(0.4, 0, 0.2, 1);
// The paywall fades in on top of this surface, so the flow keeps painting while
// it arrives - it only eases back to suggest depth, and never to black.
const HANDOFF_MS = 340;

// These are the app's existing assistant portraits. Keeping the requires in
// this module gives Metro a chance to resolve them during the first screen,
// before the goal list is pushed on-screen.
const DEFAULT_GOAL_IMAGES = {
  workFaster: require('../../../../assets/images/assistants/avatar_01_896x896_q45.webp'),
  writeBetter: require('../../../../assets/images/assistants/avatar_02_896x896_q45.webp'),
  understandDocuments: require('../../../../assets/images/assistants/assistant_techsupport_1024x1024_q45.webp'),
  learnAnything: require('../../../../assets/images/assistants/avatar_04_640x640_q28.webp'),
  createContent: require('../../../../assets/images/assistants/assistant_extra_1024x1024_q30.webp'),
  planBusiness: require('../../../../assets/images/assistants/avatar_06_896x896_q20.webp'),
  personalClarity: require('../../../../assets/images/assistants/avatar_05_896x896_q55.webp'),
  askBigQuestions: require('../../../../assets/images/assistants/avatar_09_896x896_q40.webp'),
};


export default function WorkspaceOnboardingFlow({
  colorScheme = 'dark',
  goalImages,
  onFinish,
  onGoalsSelected,
  onReady,
}) {
  const theme = useOnboardingTheme(colorScheme);
  const content = useOnboardingContent();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const [pendingIndex, setPendingIndex] = useState(null);
  const [stageHeight, setStageHeight] = useState(
    () => Dimensions.get('screen').height,
  );
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [trialReady, setTrialReady] = useState(false);

  const handoff = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const isMountedRef = useRef(true);
  const readyFrameRef = useRef(null);
  const readyReportedRef = useRef(false);
  const finishedRef = useRef(false);
  const indexRef = useRef(0);
  const transitionLockedRef = useRef(false);
  const transitionDirectionRef = useRef(1);
  const transitionFrameRef = useRef(null);
  const autoAdvanceTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (readyFrameRef.current !== null)
        cancelAnimationFrame(readyFrameRef.current);
      if (autoAdvanceTimerRef.current)
        clearTimeout(autoAdvanceTimerRef.current);
      if (transitionFrameRef.current !== null)
        cancelAnimationFrame(transitionFrameRef.current);
      slide.stopAnimation();
      handoff.stopAnimation();
    };
  }, [handoff, slide]);

  // The native splash stays up until the first onboarding frame is on screen,
  // so only report readiness once layout has survived two display frames.
  const handleLayout = useCallback(() => {
    if (readyReportedRef.current || readyFrameRef.current !== null) return;

    readyFrameRef.current = requestAnimationFrame(() => {
      readyFrameRef.current = requestAnimationFrame(() => {
        readyFrameRef.current = null;
        if (!isMountedRef.current || readyReportedRef.current) return;
        readyReportedRef.current = true;
        onReady?.();
      });
    });
  }, [onReady]);

  // Reuse the original onboarding's full-height vertical travel and easing.
  // At rest only one screen is mounted; the destination joins it only for the
  // duration of the native-driver slide.
  const go = useCallback(next => {
    if (transitionLockedRef.current || next === indexRef.current) return;
    transitionLockedRef.current = true;
    transitionDirectionRef.current = next > indexRef.current ? 1 : -1;
    slide.setValue(0);
    setPendingIndex(next);
  }, [slide]);

  useEffect(() => {
    if (pendingIndex === null) return undefined;

    transitionFrameRef.current = requestAnimationFrame(() => {
      transitionFrameRef.current = null;
      Animated.timing(slide, {
        toValue: 1,
        duration: SCREEN_TRANSITION_MS,
        easing: SCREEN_TRANSITION_EASING,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && isMountedRef.current) {
          indexRef.current = pendingIndex;
          setIndex(pendingIndex);
        }
        if (isMountedRef.current) setPendingIndex(null);
        transitionLockedRef.current = false;
      });
    });

    return () => {
      if (transitionFrameRef.current !== null) {
        cancelAnimationFrame(transitionFrameRef.current);
        transitionFrameRef.current = null;
      }
    };
  }, [pendingIndex, slide]);

  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    // Start the native-driver handoff before mounting the paywall. This keeps
    // the transition moving even while React prepares the paywall tree.
    Animated.timing(handoff, {
      toValue: 1,
      duration: HANDOFF_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
    onFinish?.();
  }, [handoff, onFinish]);

  // Setup finishes on its own, so the paywall opens after the trial status
  // settles without asking the user for another tap.
  useEffect(() => {
    if (!trialReady || finishedRef.current) return undefined;

    autoAdvanceTimerRef.current = setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      if (!isMountedRef.current || finishedRef.current) return;
      haptic(HAPTIC.handoff);
      handleFinish();
    }, WORKSPACE_AUTO_ADVANCE_MS);

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [handleFinish, trialReady]);

  const toggleGoal = useCallback(
    id => {
      setSelectedGoals(prev => {
        if (prev.includes(id)) {
          haptic(HAPTIC.select);
          return prev.filter(x => x !== id);
        }
        if (prev.length >= content.goals.maxSelection) {
          // Nothing changes, so the buzz is the only feedback the tap gets.
          haptic(HAPTIC.reject);
          return prev;
        }
        haptic(HAPTIC.select);
        return [...prev, id];
      });
    },
    [content.goals.maxSelection],
  );

  const handleGoalsContinue = useCallback(() => {
    onGoalsSelected?.(selectedGoals);
    go(2);
  }, [go, onGoalsSelected, selectedGoals]);

  const footer = useMemo(() => {
    // Hide the outgoing goal CTA as soon as screen three starts entering. The
    // footer is anchored outside the sliding stage, so waiting for `index` to
    // settle otherwise exposes the old Continue button for one transition.
    if (index === 2 || pendingIndex === 2) return null;
    if (index === 0) {
      return {
        label: content.common.tryItFree,
        disabled: false,
        onPress: () => go(1),
        hapticType: HAPTIC.advance,
      };
    }
    if (index === 1) {
      return {
        label: content.common.continue,
        disabled: selectedGoals.length === 0,
        onPress: handleGoalsContinue,
        hapticType: HAPTIC.advance,
      };
    }
    return null;
  }, [
    content.common.continue,
    content.common.tryItFree,
    go,
    handleGoalsContinue,
    index,
    pendingIndex,
    selectedGoals.length,
  ]);

  const resolvedGoalImages = useMemo(
    () => ({ ...DEFAULT_GOAL_IMAGES, ...goalImages }),
    [goalImages],
  );

  const renderStep = (stepIndex, active = true) => {
    if (stepIndex === 0) {
      return (
        <ValueDemoView
          content={content}
          theme={theme}
        />
      );
    }
    if (stepIndex === 1) {
      return (
        <GoalSelectionView
          content={content}
          goalImages={resolvedGoalImages}
          onBack={() => go(0)}
          onToggle={toggleGoal}
          selected={selectedGoals}
          theme={theme}
        />
      );
    }
    return (
      <WorkspaceReadyView
        active={active}
        content={content}
        onTrialReady={setTrialReady}
        theme={theme}
      />
    );
  };

  const direction = transitionDirectionRef.current;
  const outgoingStyle = {
    transform: [
      {
        translateY: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -stageHeight * direction],
        }),
      },
    ],
  };
  const incomingStyle = {
    transform: [
      {
        translateY: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [stageHeight * direction, 0],
        }),
      },
    ],
  };

  // The handoff eases the whole surface - content and footer alike - back
  // behind the paywall sheet arriving on top of it.
  const bodyStyle = {
    opacity: handoff.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.72],
    }),
    transform: [
      {
        scale: handoff.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.97],
        }),
      },
    ],
  };

  return (
    <View
      onLayout={handleLayout}
      style={[styles.root, { backgroundColor: theme.backdrop }]}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
      />

      <Animated.View style={[styles.body, bodyStyle]}>
        <View
          onLayout={event => {
            const measured = event?.nativeEvent?.layout?.height;
            if (measured > 0 && measured !== stageHeight) setStageHeight(measured);
          }}
          style={styles.stage}
        >
          <Animated.View
            key={`step-${index}`}
            pointerEvents={pendingIndex === null ? 'auto' : 'none'}
            style={[
              styles.layer,
              { paddingTop: insets.top + 18 },
              pendingIndex === null ? null : outgoingStyle,
            ]}
          >
            {renderStep(index, pendingIndex === null)}
          </Animated.View>
          {pendingIndex !== null ? (
            <Animated.View
              key={`step-${pendingIndex}`}
              pointerEvents="none"
              style={[
                styles.layer,
                { paddingTop: insets.top + 18 },
                incomingStyle,
              ]}
            >
              {renderStep(pendingIndex, false)}
            </Animated.View>
          ) : null}
        </View>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom + 12, 22) },
          ]}
        >
          <PageDots count={STEPS.length} active={index} theme={theme} />
          {footer ? (
            <PrimaryButton
              disabled={footer.disabled}
              hapticType={footer.hapticType}
              onPress={footer.onPress}
              theme={theme}
              title={footer.label}
              titleKey={index}
            />
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  stage: { flex: 1, overflow: 'hidden' },
  layer: StyleSheet.absoluteFillObject,
  footer: { paddingHorizontal: 20, paddingTop: 6 },
});
