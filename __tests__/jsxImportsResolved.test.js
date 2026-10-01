/**
 * Catches the class of bug where a component is used in JSX but never
 * imported. Babel parses such a file happily and jest never renders these
 * screens, so the first sign is a red screen on device: shipping the paywall
 * with an unimported <SvgIcon> is exactly how this slipped through once.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

// Screens that are expensive to render in tests but costly to break.
const FILES = [
  'App.js',
  'src/components/PremiumPaywallScreen.jsx',
  'src/components/PaywallScreen.jsx',
  'src/components/rewards/DailyCheckInModal.jsx',
  'src/components/NotificationPrimingModal.jsx',
  'src/screens/IntroductionAnimationScreen.jsx',
  'src/components/onboarding/v2/IntentView.jsx',
  'src/components/onboarding/v2/OutcomeView.jsx',
  'src/components/onboarding/v2/ProofView.jsx',
  'src/components/onboarding/v2/JourneyControls.jsx',
  'src/navigation/AndroidNavigationMenu.jsx',
];

// Namespaced tags (<Animated.View>) resolve through their root object, and
// lowercase tags are host components.
// Commented-out JSX still matches the tag pattern, so strip comments first.
const isCommentLine = line => {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  );
};

const collectJsxRoots = source => {
  const roots = new Set();
  const re = /<([A-Z][A-Za-z0-9_]*)(?:\.[A-Za-z0-9_]+)*[\s/>]/g;

  for (const line of source.split(/\r?\n/)) {
    if (isCommentLine(line)) continue;
    let match;
    re.lastIndex = 0;
    while ((match = re.exec(line))) roots.add(match[1]);
  }

  return roots;
};

const collectBindings = source => {
  const names = new Set();
  const add = value => value && names.add(value);

  // import X, { a as b, c } from '...'
  const importRe = /import\s+([^'"]+?)\s+from\s+['"][^'"]+['"]/g;
  let m;
  while ((m = importRe.exec(source))) {
    const clause = m[1];
    const defaultPart = clause.split('{')[0].replace(/,\s*$/, '').trim();
    if (defaultPart && !defaultPart.startsWith('*')) add(defaultPart);
    const namespaced = clause.match(/\*\s+as\s+([A-Za-z0-9_$]+)/);
    if (namespaced) add(namespaced[1]);
    const braced = clause.match(/\{([^}]*)\}/);
    if (braced) {
      braced[1]
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .forEach(part => add(part.split(/\s+as\s+/).pop().trim()));
    }
  }

  // Locally declared components / requires.
  const localRe =
    /(?:function|class)\s+([A-Z][A-Za-z0-9_]*)|(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=/g;
  while ((m = localRe.exec(source))) add(m[1] || m[2]);

  return names;
};

describe('every JSX component resolves to a binding', () => {
  test.each(FILES)('%s', file => {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    const used = collectJsxRoots(source);
    const bound = collectBindings(source);

    const missing = [...used].filter(name => !bound.has(name));
    expect(missing).toEqual([]);
  });
});
