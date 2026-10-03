import { analyzeVideo, checkChapter, publicVideoResult } from './video.ts';
const assert = (v: unknown, message = 'Assertion failed') => { if (!v) throw new Error(message); };
const ref = { name: 'files/test', uri: 'https://generativelanguage.googleapis.com/v1beta/files/test', mimeType: 'video/mp4', expiresAt: new Date(Date.now() + 86400000).toISOString(), durationSeconds: 60 };
const reply = (value: any) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
Deno.test('video source retained privately; independent tasks and bounded chapter checks', async () => {
  const original = fetch, old = Deno.env.get('GEMINI_API_KEY'); Deno.env.set('GEMINI_API_KEY', 'test');
  let uploaded = 0, calls = 0;
  globalThis.fetch = (async (url, options) => {
    if (String(url).endsWith('/upload/v1beta/files')) return new Response('', { headers: { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/fixture' } });
    if (String(url).endsWith('/upload/fixture')) { uploaded++; assert(options?.body instanceof File); return Response.json({ file: { ...ref, state: 'ACTIVE', expirationTime: ref.expiresAt, videoMetadata: { videoDuration: '60s' } } }); }
    const body = JSON.parse(String(options?.body)); calls++;
    const schema = body.generationConfig.responseJsonSchema;
    assert(body.contents[0].parts[0].fileData.fileUri === ref.uri);
    if (schema.properties.sourceAccessible) return reply({ sourceAccessible: true, title: 'Meeting', overview: 'Lena owns design.', keyPoints: ['Design due Friday'], actions: [], sections: [{title:'Design',body:'Lena updates design.',startSeconds:10},{title:'Unknown',body:'Not present.',startSeconds:35}], evidence: [], limitations: [] });
    if (schema.properties.actions) return reply({ actions: ['Lena: update the design by Friday.'] });
    const window = body.contents[0].parts[0].videoMetadata;
    assert(window.fps === 2 && parseFloat(window.endOffset) - parseFloat(window.startOffset) <= 8);
    return reply(window.startOffset === '8s' ? { confirmed: true, offsetSeconds: 2 } : { confirmed: false, offsetSeconds: null });
  }) as typeof fetch;
  try {
    const result = await analyzeVideo({ type: 'upload', language: 'en' }, new File(['x'],'x.mp4',{type:'video/mp4'}),new AbortController().signal);
    assert(uploaded === 1 && calls === 4);
    assert(result.actions[0].includes('Lena'));
    assert(result.sections[0].startSeconds === 10 && result.sections[0].timestampChecked);
    assert(result.sections[1].startSeconds === null && !result.sections[1].timestampChecked);
    assert(!('_video' in publicVideoResult(result)) && result._video.uri === ref.uri);
  } finally { globalThis.fetch = original; old === undefined ? Deno.env.delete('GEMINI_API_KEY') : Deno.env.set('GEMINI_API_KEY',old); }
});
Deno.test('follow-up reuses original video, not the saved summary; rejects expired uploads', async () => {
  const original = fetch, old = Deno.env.get('GEMINI_API_KEY'); Deno.env.set('GEMINI_API_KEY','test'); let calls=0;
  globalThis.fetch = (async (_url, options) => { calls++; const body = JSON.parse(String(options?.body)); assert(body.contents[0].parts[0].fileData.fileUri === ref.uri); assert(body.contents[0].parts[1].text.includes('Who owns design?')); return reply({answer:'Lena owns design.'}); }) as typeof fetch;
  try {
    const source = {type:'upload', sourceJobId:'owned-id', question:'Who owns design?', language:'en', videoRef:ref};
    const result = await analyzeVideo(source,null,new AbortController().signal); assert(result.answer==='Lena owns design.' && calls===1);
    let code='';try { await analyzeVideo({...source,videoRef:{...ref,expiresAt:'2000-01-01'}},null,new AbortController().signal); } catch(e) { code=(e as any).code; }
    assert(code==='VIDEO_SOURCE_EXPIRED' && calls===1);
  } finally { globalThis.fetch=original; old===undefined?Deno.env.delete('GEMINI_API_KEY'):Deno.env.set('GEMINI_API_KEY',old); }
});
Deno.test('chapter failures and out-of-window provider timestamps never become jump times', async()=>{
 const original=fetch;let calls=0;
 globalThis.fetch=(async()=>{calls++;return reply({confirmed:true,offsetSeconds:1000});}) as typeof fetch;
 try{
  const section={title:'Design',body:'A topic',startSeconds:20};
  assert((await checkChapter(ref,section,new AbortController().signal)).startSeconds===null);
  assert((await checkChapter(ref,{...section,startSeconds:80},new AbortController().signal)).startSeconds===null && calls===1);
  globalThis.fetch=(async()=>new Response('',{status:429})) as typeof fetch;
  assert((await checkChapter(ref,section,new AbortController().signal)).startSeconds===null);
 }finally{globalThis.fetch=original;}
});
