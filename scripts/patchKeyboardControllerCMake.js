const fs = require('fs');
const path = require('path');

function patchKeyboardControllerCMake() {
  const repoRoot = path.resolve(__dirname, '..');
  const cmakePath = path.join(
    repoRoot,
    'node_modules',
    'react-native-keyboard-controller',
    'android',
    'src',
    'main',
    'jni',
    'CMakeLists.txt',
  );

  if (!fs.existsSync(cmakePath)) {
    return false;
  }

  const source = fs.readFileSync(cmakePath, 'utf8');
  if (
    source.includes('DEFINED RNKC_COMMON_DIR') &&
    source.includes('DEFINED RNKC_GENERATED_JNI_DIR')
  ) {
    return true;
  }

  const originalBlock = [
    'set(LIB_COMMON_COMPONENTS_DIR ${LIB_COMMON_DIR}/react/renderer/components/${LIB_LITERAL})',
    'set(LIB_ANDROID_GENERATED_JNI_DIR ${LIB_ANDROID_DIR}/build/generated/source/codegen/jni)',
    'set(LIB_ANDROID_GENERATED_COMPONENTS_DIR ${LIB_ANDROID_GENERATED_JNI_DIR}/react/renderer/components/${LIB_LITERAL})',
  ].join('\n');

  const envOnlyBlock = [
    'set(LIB_COMMON_COMPONENTS_DIR ${LIB_COMMON_DIR}/react/renderer/components/${LIB_LITERAL})',
    'set(LIB_ANDROID_GENERATED_JNI_DIR ${LIB_ANDROID_DIR}/build/generated/source/codegen/jni)',
    '',
    'if(WIN32 AND DEFINED ENV{RNKC_COMMON_DIR})',
    '  file(TO_CMAKE_PATH "$ENV{RNKC_COMMON_DIR}" LIB_COMMON_COMPONENTS_DIR)',
    'endif()',
    '',
    'if(WIN32 AND DEFINED ENV{RNKC_GENERATED_JNI_DIR})',
    '  file(TO_CMAKE_PATH "$ENV{RNKC_GENERATED_JNI_DIR}" LIB_ANDROID_GENERATED_JNI_DIR)',
    'endif()',
    '',
    'set(LIB_ANDROID_GENERATED_COMPONENTS_DIR ${LIB_ANDROID_GENERATED_JNI_DIR}/react/renderer/components/${LIB_LITERAL})',
  ].join('\n');

  const after = [
    'set(LIB_COMMON_COMPONENTS_DIR ${LIB_COMMON_DIR}/react/renderer/components/${LIB_LITERAL})',
    'set(LIB_ANDROID_GENERATED_JNI_DIR ${LIB_ANDROID_DIR}/build/generated/source/codegen/jni)',
    '',
    'if(WIN32 AND DEFINED RNKC_COMMON_DIR)',
    '  file(TO_CMAKE_PATH "${RNKC_COMMON_DIR}" LIB_COMMON_COMPONENTS_DIR)',
    'elseif(WIN32 AND DEFINED ENV{RNKC_COMMON_DIR})',
    '  file(TO_CMAKE_PATH "$ENV{RNKC_COMMON_DIR}" LIB_COMMON_COMPONENTS_DIR)',
    'endif()',
    '',
    'if(WIN32 AND DEFINED RNKC_GENERATED_JNI_DIR)',
    '  file(TO_CMAKE_PATH "${RNKC_GENERATED_JNI_DIR}" LIB_ANDROID_GENERATED_JNI_DIR)',
    'elseif(WIN32 AND DEFINED ENV{RNKC_GENERATED_JNI_DIR})',
    '  file(TO_CMAKE_PATH "$ENV{RNKC_GENERATED_JNI_DIR}" LIB_ANDROID_GENERATED_JNI_DIR)',
    'endif()',
    '',
    'set(LIB_ANDROID_GENERATED_COMPONENTS_DIR ${LIB_ANDROID_GENERATED_JNI_DIR}/react/renderer/components/${LIB_LITERAL})',
  ].join('\n');

  const before = source.includes(envOnlyBlock) ? envOnlyBlock : originalBlock;

  if (!source.includes(before)) {
    throw new Error('Unexpected react-native-keyboard-controller CMakeLists layout.');
  }

  fs.writeFileSync(cmakePath, source.replace(before, after));
  return true;
}

if (require.main === module) {
  try {
    const patched = patchKeyboardControllerCMake();
    if (patched) {
      console.log('react-native-keyboard-controller CMakeLists patched');
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = patchKeyboardControllerCMake;
