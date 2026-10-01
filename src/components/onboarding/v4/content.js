/**
 * Every user-visible string for the workspace onboarding (v4).
 *
 * Keys resolve through i18n with an English defaultValue, so a locale that has
 * not been translated yet still renders correctly.
 *
 * Never route an asset name, icon name or goal id through i18n: on iOS those
 * got machine-translated and every image silently broke in ~75 languages.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export const MAX_GOAL_SELECTION = 3;

// Setup pacing. The beat exists to be watched, so it is deliberately unhurried:
// steps tick over slowly enough to read, and the trial toggle takes its time
// travelling rather than snapping across.
export const WORKSPACE_STEP_DURATION_MS = 720;
export const WORKSPACE_TRIAL_DELAY_MS = 900;
export const WORKSPACE_TRIAL_TRAVEL_MS = 720;
// The knob's easing front-loads its travel: it has covered ~97% of the distance
// by this point, and the last 3% is under a pixel. This is when the toggle reads
// as landed, so the haptic and the accessible state fire here rather than at the
// animation's end. The visible labels cross-fade off the knob's value directly.
export const WORKSPACE_TRIAL_SETTLE_MS = Math.round(
  WORKSPACE_TRIAL_TRAVEL_MS * 0.6,
);
// Beat spent on the finished "enabled" state before the paywall takes over.
export const WORKSPACE_AUTO_ADVANCE_MS = 1250;

// Ids and accent keys are structural - translation must never touch them.
const GOAL_IDS = [
  { id: 'workFaster', emoji: '⚡️', accent: 'orange' },
  { id: 'writeBetter', emoji: '✍️', accent: 'orange' },
  { id: 'understandDocuments', emoji: '📑', accent: 'yellow' },
  { id: 'learnAnything', emoji: '💡', accent: 'yellow' },
  { id: 'createContent', emoji: '🎨', accent: 'red' },
  { id: 'planBusiness', emoji: '📈', accent: 'cyan' },
  { id: 'personalClarity', emoji: '🧭', accent: 'purple' },
  { id: 'askBigQuestions', emoji: '✨', accent: 'purple' },
];

const GOAL_COPY = {
  workFaster: ['Work faster', 'Emails, replies, tasks'],
  writeBetter: ['Write better', 'Fix tone, rewrite, improve'],
  understandDocuments: ['Understand documents', 'Summaries, scans, key points'],
  learnAnything: ['Learn anything', 'Explain topics clearly'],
  createContent: ['Create content', 'Posts, captions, ideas'],
  planBusiness: ['Plan business', 'Ideas, strategy, automation'],
  personalClarity: ['Personal clarity', 'Decisions, habits, thoughts'],
  askBigQuestions: ['Ask any questions', 'Future, meaning, AI, life'],
};

const DEMO_CARDS = [
  { id: 'doc' },
  { id: 'reply' },
  { id: 'translation' },
];

const DEMO_CARD_COPY = {
  doc: ['Document Summary', '12-page file → 5 key points'],
  reply: ['Reply Drafted', 'Polite, professional tone'],
  translation: ['Translation Ready', 'English → Spanish'],
};

const WORKSPACE_STEP_COPY = [
  'Preparing your assistant',
  'Personalizing responses',
  'Securing access',
  'Finishing setup',
];

export function useOnboardingContent() {
  const { t } = useTranslation();

  return useMemo(() => {
    const copy = (key, defaultValue) =>
      t(`onboarding.v4.${key}`, { defaultValue });

    return {
      common: {
        continue: copy('common.continue', 'Continue'),
        tryItFree: copy('common.tryItFree', 'Try it for free'),
        back: copy('common.back', 'Back'),
      },

      valueDemo: {
        title: copy('valueDemo.title', 'We Want You To Try Cloud AI For Free'),
        subtitle: copy(
          'valueDemo.subtitle',
          'Write, summarize, translate, and scan documents in one AI workspace.',
        ),
        workspaceLabel: copy('valueDemo.workspaceLabel', 'AI WORKSPACE'),
        userPromptLabel: copy('valueDemo.userPromptLabel', 'USER PROMPT'),
        aiTypingLabel: copy('valueDemo.aiTypingLabel', 'AI TYPING'),
        prompt: copy(
          'valueDemo.prompt',
          'Write a polite reply to a client about a delayed delivery.',
        ),
        response: copy(
          'valueDemo.response',
          'Hi, thanks for your patience. Your delivery may be slightly delayed. I’ll keep you updated.',
        ),
        cards: DEMO_CARDS.map(card => ({
          ...card,
          title: copy(
            `valueDemo.cards.${card.id}.title`,
            DEMO_CARD_COPY[card.id][0],
          ),
          detail: DEMO_CARD_COPY[card.id][1]
            ? copy(
                `valueDemo.cards.${card.id}.detail`,
                DEMO_CARD_COPY[card.id][1],
              )
            : null,
        })),
      },

      goals: {
        title: copy('goals.title', 'What do you need help with?'),
        subtitle: copy(
          'goals.subtitle',
          'Choose 1–3 goals. We’ll build your AI workspace.',
        ),
        emptyCta: copy('goals.emptyCta', 'Choose at least 1 goal'),
        maxSelection: MAX_GOAL_SELECTION,
        items: GOAL_IDS.map(goal => ({
          ...goal,
          title: copy(`goals.items.${goal.id}.title`, GOAL_COPY[goal.id][0]),
          subtitle: copy(
            `goals.items.${goal.id}.subtitle`,
            GOAL_COPY[goal.id][1],
          ),
        })),
      },

      workspace: {
        preparingTitle: copy(
          'workspace.preparingTitle',
          'Creating your AI assistant',
        ),
        readyTitle: copy('workspace.readyTitle', 'Your AI assistant is ready'),
        subtitle: copy(
          'workspace.subtitle',
          'Your assistant is configured. Trial access is turning on now.',
        ),
        trialTitle: copy('workspace.trialTitle', '3-day trial'),
        trialActivating: copy('workspace.trialActivating', 'activating'),
        trialEnabled: copy('workspace.trialEnabled', 'enabled'),
        steps: WORKSPACE_STEP_COPY.map((step, index) =>
          copy(`workspace.steps.${index}`, step),
        ),
      },
    };
  }, [t]);
}
