import fs from 'fs';
import path from 'path';

const projectPath = relativePath => path.join(__dirname, '..', relativePath);

test('chat uses the single API streamChat implementation', () => {
  const chatSource = fs.readFileSync(projectPath('src/screens/Chat.js'), 'utf8');

  expect(chatSource).toContain("from '../api/streamChat'");
  expect(fs.existsSync(projectPath('src/api/streamChat.js'))).toBe(true);
  expect(fs.existsSync(projectPath('src/lib/streamChat.js'))).toBe(false);
});
