const rnPreset = require('react-native/jest-preset');

// The react-native preset only transforms `^.+\.(js|ts|tsx)$`, so any `.jsx`
// module fails to load in tests with "Cannot use import statement outside a
// module". Most of our components are `.jsx`, so widen the pattern.
const babelTransform = rnPreset.transform['^.+\\.(js|ts|tsx)$'];

// The preset only un-ignores react-native itself. Third-party RN packages ship
// untranspiled ESM, so requiring any component that imports them throws the
// same syntax error. Add the ones our components actually pull in.
const esmPackages = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  '@react-navigation',
  'react-native-reanimated',
  'react-native-linear-gradient',
  'react-native-vector-icons',
  'react-native-safe-area-context',
  'react-native-fs',
  'react-native-gesture-handler',
  'uuid',
];

module.exports = {
  preset: 'react-native',
  transform: {
    ...rnPreset.transform,
    '^.+\\.(js|jsx|ts|tsx)$': babelTransform,
  },
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  transformIgnorePatterns: [
    `node_modules/(?!(${esmPackages.join('|')})/)`,
  ],
};
