const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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

function parseConnectedDevices(output) {
  return parseAdbDevices(output)
    .filter(device => device.state === 'device')
    .map(device => device.serial);
}

function parseAdbDevices(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('List of devices'))
    .map(line => line.split(/\s+/))
    .filter(parts => parts[0] && parts[1])
    .map(parts => ({
      serial: parts[0],
      state: parts[1],
    }));
}

function getBlockedAdbDevices(devices) {
  const blockedStates = new Set(['offline', 'unauthorized', 'authorizing']);
  return devices.filter(device => blockedStates.has(device.state));
}

function parseAvdList(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function findAndroidSdkRoot(env = process.env) {
  const candidates = [
    env.ANDROID_HOME,
    env.ANDROID_SDK_ROOT,
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Android', 'Sdk'),
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  ].filter(Boolean);

  return candidates.find(candidate => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  }) || null;
}

function buildPathWithAndroidSdkTools(sdkRoot, currentPath = process.env.PATH || '') {
  if (!sdkRoot) return currentPath;

  const entries = [
    path.join(sdkRoot, 'platform-tools'),
    path.join(sdkRoot, 'emulator'),
    currentPath,
  ].filter(Boolean);

  return entries.join(path.delimiter);
}

function getAndroidToolCommand(sdkRoot, toolName) {
  const exe = process.platform === 'win32' ? `${toolName}.exe` : toolName;
  const subdir = toolName === 'adb' ? 'platform-tools' : 'emulator';
  const candidate = sdkRoot ? path.join(sdkRoot, subdir, exe) : null;

  if (candidate && fs.existsSync(candidate)) {
    return candidate;
  }

  return toolName;
}

function runTextCommand(command, args, env) {
  return spawnSync(command, args, {
    env,
    encoding: 'utf8',
    shell: false,
  });
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function listConnectedDevices(adbCommand, env) {
  const result = runTextCommand(adbCommand, ['devices'], env);
  return parseConnectedDevices(result.stdout);
}

function listAdbDevices(adbCommand, env) {
  const result = runTextCommand(adbCommand, ['devices'], env);
  return parseAdbDevices(result.stdout);
}

function reportBlockedAdbDevices(devices) {
  if (devices.length === 0) return;

  const summary = devices
    .map(device => `${device.serial} (${device.state})`)
    .join(', ');
  console.error(`Android device is connected but adb cannot install yet: ${summary}.`);

  if (devices.some(device => device.state === 'authorizing' || device.state === 'unauthorized')) {
    console.error('Accept the USB debugging authorization prompt on the emulator/device, then run npm run android again.');
  }

  if (devices.some(device => device.state === 'offline')) {
    console.error('The emulator is offline. Close and restart the AVD, then run npm run android again.');
  }
}

function getRunAndroidCommandConfig(platform = process.platform) {
  return {
    command: platform === 'win32' ? 'npx.cmd' : 'npx',
    shell: platform === 'win32',
  };
}

function waitForBootedDevice(adbCommand, env, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const devices = listConnectedDevices(adbCommand, env);
    for (const serial of devices) {
      const bootResult = runTextCommand(
        adbCommand,
        ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'],
        env,
      );
      if (String(bootResult.stdout || '').trim() === '1') {
        return serial;
      }
    }

    sleepSync(3000);
  }

  return null;
}

function ensureAndroidDevice(env) {
  const sdkRoot = findAndroidSdkRoot(env);
  env.PATH = buildPathWithAndroidSdkTools(sdkRoot, env.PATH);

  const adbCommand = getAndroidToolCommand(sdkRoot, 'adb');
  const emulatorCommand = getAndroidToolCommand(sdkRoot, 'emulator');

  runTextCommand(adbCommand, ['start-server'], env);

  const connected = listConnectedDevices(adbCommand, env);
  if (connected.length > 0) {
    runTextCommand(adbCommand, ['-s', connected[0], 'reverse', 'tcp:8081', 'tcp:8081'], env);
    return connected[0];
  }

  const blockedDevices = getBlockedAdbDevices(listAdbDevices(adbCommand, env));
  if (blockedDevices.length > 0) {
    runTextCommand(adbCommand, ['reconnect', 'offline'], env);
    const recoveredSerial = waitForBootedDevice(adbCommand, env, 30000);
    if (recoveredSerial) {
      runTextCommand(adbCommand, ['-s', recoveredSerial, 'reverse', 'tcp:8081', 'tcp:8081'], env);
      return recoveredSerial;
    }

    reportBlockedAdbDevices(getBlockedAdbDevices(listAdbDevices(adbCommand, env)));
    return null;
  }

  const avdResult = runTextCommand(emulatorCommand, ['-list-avds'], env);
  const avds = parseAvdList(avdResult.stdout);

  if (avds.length === 0) {
    console.error('No Android device is connected and no Android Virtual Device was found.');
    return null;
  }

  const avdName = avds[0];
  console.log(`No Android device connected. Starting emulator "${avdName}"...`);
  const child = spawn(
    emulatorCommand,
    ['-avd', avdName, '-no-snapshot-load', '-netdelay', 'none', '-netspeed', 'full'],
    {
      env,
      detached: true,
      stdio: 'ignore',
      shell: false,
    },
  );
  child.unref();

  const bootedSerial = waitForBootedDevice(adbCommand, env);
  if (!bootedSerial) {
    console.error(`Timed out waiting for emulator "${avdName}" to boot.`);
    return null;
  }

  runTextCommand(adbCommand, ['-s', bootedSerial, 'reverse', 'tcp:8081', 'tcp:8081'], env);
  return bootedSerial;
}

function runAndroid() {
  const repoRoot = path.resolve(__dirname, '..');
  patchKeyboardControllerCMake();

  const env = { ...process.env };
  if (!ensureAndroidDevice(env)) {
    process.exit(1);
  }

  const args = ['react-native', 'run-android', ...process.argv.slice(2)];
  const { command, shell } = getRunAndroidCommandConfig();

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
    shell,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
  }

  process.exit(result.status ?? 1);
}

if (require.main === module) {
  runAndroid();
}

module.exports = {
  buildPathWithAndroidSdkTools,
  ensureAndroidDevice,
  findAndroidSdkRoot,
  getBlockedAdbDevices,
  getRunAndroidCommandConfig,
  parseAdbDevices,
  parseAvdList,
  parseConnectedDevices,
  runAndroid,
};
