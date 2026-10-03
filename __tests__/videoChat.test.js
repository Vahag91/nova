import { getChatVideoSource, asksForVideoWithoutSource, videoQuestionSource } from '../src/lib/videoChat';
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

const videoRef = {type:'upload',jobId:'d57a9b51-57da-411c-8608-b79757fbdb5a',expiresAt:'2099-01-01'};
test('follow-up routes to original video with bounded conversation', () => {
 const thread={messages:[{role:'assistant',content:'summary',meta:{videoSummary:true,videoSource:videoRef}},...Array.from({length:8},()=>({role:'user',content:'x'.repeat(3000)}))]};
 expect(videoQuestionSource(thread,'Who owns it?')).toMatchObject({sourceJobId:videoRef.jobId,type:'upload',question:'Who owns it?'});
 expect(videoQuestionSource(thread,'Who?').conversation).toHaveLength(6);
 expect(videoQuestionSource(thread,'Who?').conversation[0].content).toHaveLength(2000);
 expect(videoQuestionSource({meta:{workspaceVideoSource:videoRef},messages:[]},'Who?').sourceJobId).toBe(videoRef.jobId);
});
test('legacy or expired videos never silently fall back to summary chat',()=>{
 expect(()=>videoQuestionSource({messages:[{meta:{videoSummary:true}}]},'Who?')).toThrow();
 expect(()=>videoQuestionSource({meta:{workspaceVideoSource:{...videoRef,expiresAt:'2000-01-01'}}},'Who?')).toThrow();
 expect(videoQuestionSource({messages:[]},'Hello')).toBeNull();
});
