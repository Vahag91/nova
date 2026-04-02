const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const patchKeyboardControllerCMake = require('./patchKeyboardControllerCMake');

function getRealPath(targetPath) {
  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return fs.realpathSync(targetPath);
  }
}

function ensureJunction(linkPath, targetPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.mkdirSync(targetPath, { recursive: true });

  if (fs.existsSync(linkPath)) {
    try {
      if (getRealPath(linkPath).toLowerCase() === getRealPath(targetPath).toLowerCase()) {
        return;
      }
    } catch {}

    fs.rmSync(linkPath, { recursive: true, force: true });
  }

  fs.symlinkSync(targetPath, linkPath, 'junction');
}

function runAndroid() {
  const repoRoot = path.resolve(__dirname, '..');
  patchKeyboardControllerCMake();

  const env = { ...process.env };
  const args = ['react-native', 'run-android', ...process.argv.slice(2)];
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  if (process.platform === 'win32') {
    const shortRoot = path.join(os.homedir(), '.nova-native');
    const buildDir = path.join(shortRoot, 'cxx');
    const keyboardControllerRoot = path.join(
      repoRoot,
      'node_modules',
      'react-native-keyboard-controller',
    );

    const commonTarget = path.join(
      keyboardControllerRoot,
      'common',
      'cpp',
      'react',
      'renderer',
      'components',
      'reactnativekeyboardcontroller',
    );
    const generatedTarget = path.join(
      keyboardControllerRoot,
      'android',
      'build',
      'generated',
      'source',
      'codegen',
      'jni',
    );

    const commonLink = path.join(shortRoot, 'rnkc-common');
    const generatedLink = path.join(shortRoot, 'rnkc-generated');

    ensureJunction(commonLink, commonTarget);
    ensureJunction(generatedLink, generatedTarget);
    fs.mkdirSync(buildDir, { recursive: true });

    env.RN_ANDROID_CMAKE_BUILD_DIR = buildDir;
    env.RNKC_COMMON_DIR = commonLink;
    env.RNKC_GENERATED_JNI_DIR = generatedLink;
  }

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });

  process.exit(result.status ?? 1);
}

runAndroid();
