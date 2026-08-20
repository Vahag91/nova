import fs from 'fs';
import path from 'path';

const readSource = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const chatSource = readSource('src/screens/Chat.js');
const editImageSource = readSource('src/screens/EditImage.jsx');
const testInputSource = readSource('src/components/chat/TestInput.jsx');

describe('image picker call-site safety contract', () => {
  test('uses the shared single-flight helper at every picker call site', () => {
    for (const source of [chatSource, editImageSource]) {
      expect(source).toContain("from '../lib/imagePickerSingleFlight'");
      expect(source).toContain('runImagePickerSingleFlight');
      expect(source).toContain('await launchImageLibrary');
    }
  });

  test('does not use callback-style picker calls', () => {
    expect(chatSource).not.toMatch(/launchImageLibrary\([\s\S]*?,\s*\(response\)/);
  });

  test('disables picker controls while a picker is active', () => {
    expect(chatSource).toContain('imagePickerActive={imagePickerActive}');
    expect(testInputSource).toContain('disabled={imagePickerActive}');
    expect(editImageSource).toContain('disabled={imagePickerActive}');
  });

  test('does not bridge Edit Image base64 during picker completion', () => {
    const pickerBlock = editImageSource.slice(
      editImageSource.indexOf('const pickImage'),
      editImageSource.indexOf('const ensureReferenceImage'),
    );

    expect(pickerBlock).toContain('includeBase64: false');
    expect(pickerBlock).not.toContain('asset.base64');
  });
});
