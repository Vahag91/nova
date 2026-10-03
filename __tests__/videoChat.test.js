import { getChatVideoSource, asksForVideoWithoutSource } from '../src/lib/videoChat';
import { validateSource } from '../supabase/functions/source-analyze/contracts';
import { buildPayload } from '../src/lib/payloadBuilder';
test('video requests preserve questions and canonicalize URLs', () => {
  const text='Summarize https://youtu.be/jNQXAC9IVRw?t=3. Explain the elephants.';
  expect(getChatVideoSource(text)).toEqual({type:'youtube',url:'https://www.youtube.com/watch?v=jNQXAC9IVRw',question:text,detail:'detailed'});
  expect(getChatVideoSource('https://youtu.be/jNQXAC9IVRw https://www.youtube.com/watch?v=jNQXAC9IVRw').type).toBe('youtube');
  expect(validateSource(getChatVideoSource(text)).question).toBe(text);
});
test('ordinary chat and spoofed links are not sent to the video backend', () => {
  for(const text of ['hello','https://example.com','https://youtube.com.evil.com/watch?v=jNQXAC9IVRw','https://youtube.com@localhost/watch?v=jNQXAC9IVRw']) expect(getChatVideoSource(text)).toBeNull();
});
test('one upload can be summarized; mixed or multiple sources are rejected', () => {
  const file={kind:'video',name:'clip.mp4',uri:'file://test'};
  expect(getChatVideoSource('',[file])).toMatchObject({type:'upload',file});
  expect(()=>getChatVideoSource('https://youtu.be/jNQXAC9IVRw',[file])).toThrow();
  expect(()=>getChatVideoSource('',[file,{kind:'document'}])).toThrow();
  expect(()=>getChatVideoSource('x'.repeat(4001),[file])).toThrow();
  expect(()=>validateSource({type:'youtube',url:'https://youtu.be/jNQXAC9IVRw',question:'x'.repeat(4001)})).toThrow();
});
test('missing video input is identified', () => {
  expect(asksForVideoWithoutSource('Please summarize this video')).toBe(true);
  expect(asksForVideoWithoutSource('What is 7 plus 8?')).toBe(false);
});
test('ordinary chat retains video context after recency trimming and drops expired source IDs', () => {
  const thread={messages:[{role:'assistant',content:'Video summary',meta:{videoContext:'A blue rectangle is visible.',videoDocuments:[{kind:'document',id:'expired-video',expiresAt:'2000-01-01'}]}},...Array.from({length:20},()=>({role:'user',content:'More conversation'}))]};
  const payload=buildPayload({thread,newMsg:{role:'user',content:'What color was it?'},tokenCap:6000});
  expect(JSON.stringify(payload)).toContain('A blue rectangle');
  expect(JSON.stringify(payload)).not.toContain('expired-video');
  expect(payload.filter(m=>m.role==='system').some(m=>JSON.stringify(m).includes('blue rectangle'))).toBe(false);
});
