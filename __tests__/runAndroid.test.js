const {
  buildPathWithAndroidSdkTools,
  getBlockedAdbDevices,
  getRunAndroidCommandConfig,
  parseAdbDevices,
  parseConnectedDevices,
  parseAvdList,
} = require('../scripts/runAndroid');

describe('runAndroid helpers', () => {
  test('parses adb device states', () => {
    const output = [
      'List of devices attached',
      'emulator-5554\tdevice',
      'emulator-5556\toffline',
      'R58M12345\tauthorizing transport_id:7',
      '',
    ].join('\n');

    expect(parseAdbDevices(output)).toEqual([
      { serial: 'emulator-5554', state: 'device' },
      { serial: 'emulator-5556', state: 'offline' },
      { serial: 'R58M12345', state: 'authorizing' },
    ]);
  });

  test('detects connected adb devices and ignores blocked entries', () => {
    const output = [
      'List of devices attached',
      'emulator-5554\tdevice',
      'emulator-5556\toffline',
      'R58M12345\tauthorizing transport_id:7',
      '',
    ].join('\n');

    expect(parseConnectedDevices(output)).toEqual(['emulator-5554']);
  });

  test('reports adb devices that cannot install apps yet', () => {
    expect(
      getBlockedAdbDevices([
        { serial: 'emulator-5554', state: 'offline' },
        { serial: 'R58M12345', state: 'authorizing' },
        { serial: 'emulator-5556', state: 'device' },
      ]),
    ).toEqual([
      { serial: 'emulator-5554', state: 'offline' },
      { serial: 'R58M12345', state: 'authorizing' },
    ]);
  });

  test('parses available Android virtual devices', () => {
    expect(parseAvdList('Pixel_9_Pro\nPixel_Tablet\n\n')).toEqual([
      'Pixel_9_Pro',
      'Pixel_Tablet',
    ]);
  });

  test('prepends Android emulator and platform-tools paths', () => {
    const sdkRoot = 'C:\\Users\\gevor\\AppData\\Local\\Android\\Sdk';
    const nextPath = buildPathWithAndroidSdkTools(sdkRoot, 'C:\\Windows');

    expect(nextPath.startsWith(`${sdkRoot}\\platform-tools;${sdkRoot}\\emulator;`)).toBe(true);
  });

  test('runs npx through a shell on Windows so cmd shims execute', () => {
    expect(getRunAndroidCommandConfig('win32')).toEqual({
      command: 'npx.cmd',
      shell: true,
    });
    expect(getRunAndroidCommandConfig('linux')).toEqual({
      command: 'npx',
      shell: false,
    });
  });
});
