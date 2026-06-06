const fs = require('fs');
const path = require('path');

function patchVoiceToText() {
  const repoRoot = path.resolve(__dirname, '..');
  const templatePath = path.join(__dirname, 'templates', 'VoiceToTextModule.kt');
  const targetPath = path.join(
    repoRoot,
    'node_modules',
    '@ascendtis',
    'react-native-voice-to-text',
    'android',
    'src',
    'main',
    'java',
    'com',
    'voicetotext',
    'VoiceToTextModule.kt',
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error('VoiceToText template is missing.');
  }

  if (!fs.existsSync(targetPath)) {
    return false;
  }

  const desired = fs.readFileSync(templatePath, 'utf8').replace(/\r\n/g, '\n');
  const current = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

  if (current === desired) {
    return true;
  }

  fs.writeFileSync(targetPath, desired);
  return true;
}

if (require.main === module) {
  try {
    patchVoiceToText();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = patchVoiceToText;
