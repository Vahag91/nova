const patchKeyboardControllerCMake = require('./patchKeyboardControllerCMake');
const patchVoiceToText = require('./patchVoiceToText');

const tasks = [
  ['patchKeyboardControllerCMake', patchKeyboardControllerCMake],
  ['patchVoiceToText', patchVoiceToText],
];

let hasFailure = false;

for (const [name, task] of tasks) {
  try {
    task();
  } catch (error) {
    hasFailure = true;
    console.error(`[${name}] ${error.message}`);
  }
}

if (hasFailure) {
  process.exit(1);
}
