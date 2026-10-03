import { analyze } from "./provider.ts";
function assert(v: unknown, message = "Assertion failed") { if (!v) throw new Error(message); }
const raw = { sourceAccessible: true, title: "Visual test", overview: "A blue square appears.", keyPoints: ["A blue square."], sections: [{title:"Scene",body:"Blue square",startSeconds:3},{title:"Invalid",body:"Beyond coverage",startSeconds:601}],actions:[], evidence:[], limitations:[] };
Deno.test("Gemini handles silent upload and YouTube, clips coverage, rejects blocked and unavailable sources", async () => {
  const original=fetch, keys=["OPENAI_API_KEY","GEMINI_API_KEY","GOOGLE_API_KEY"];
  const old=keys.map(k=>Deno.env.get(k));
  Deno.env.delete("OPENAI_API_KEY"); Deno.env.delete("GEMINI_API_KEY"); Deno.env.set("GOOGLE_API_KEY","video-test");
  let calls=0, unavailable=false, blocked=false;
  globalThis.fetch=(async (url,opts)=>{
    calls++;
    assert(String(url).includes("generativelanguage.googleapis.com"), "No OpenAI transcription for videos");
    assert((opts?.headers as any)["x-goog-api-key"]==="video-test");
    const body=JSON.parse(String(opts?.body)), part=body.contents[0].parts[0];
    assert(part.videoMetadata.endOffset==="600s" && part.videoMetadata.fps===1);
    assert(body.generationConfig.mediaResolution==="MEDIA_RESOLUTION_LOW");
    assert(body.systemInstruction.parts[0].text.includes("Silent videos are valid"));
    assert(body.store===false);
    if(calls===1) assert(part.inlineData.mimeType==="video/mp4" && part.inlineData.data==="dGVzdA==");
    else assert(part.fileData.fileUri==="https://www.youtube.com/watch?v=jNQXAC9IVRw");
    return Response.json({candidates:[{finishReason:blocked?"SAFETY":"STOP",content:{parts:[{thought:true,text:"not JSON"},{text:JSON.stringify({...raw,sourceAccessible:!unavailable})}]}}]});
  }) as typeof fetch;
  try {
    const source={type:"upload",language:"en",detail:"detailed"};
    const result=await analyze(source,[],new File(["test"],"silent.mp4",{type:"video/mp4"}),new AbortController().signal);
    assert(result.coverage.kind==="audiovisual" && result.coverage.maxVideoSeconds===600);
    assert(result.sections[1].startSeconds===null && result.evidence.length===0);
    const youtube={...source,type:"youtube",url:"https://www.youtube.com/watch?v=jNQXAC9IVRw"};
    assert((await analyze(youtube,[],null,new AbortController().signal)).overview.includes("blue"));
    for(const condition of ["unavailable","blocked"]){
      unavailable=condition==="unavailable";blocked=condition==="blocked";
      let code="";try{await analyze(youtube,[],null,new AbortController().signal);}catch(e){code=e.code;}
      assert(code===(unavailable?"SOURCE_UNAVAILABLE":"INVALID_RESULT"));
    }
  } finally { globalThis.fetch=original;keys.forEach((k,i)=>old[i]===undefined?Deno.env.delete(k):Deno.env.set(k,old[i]!)); }
});
Deno.test("text sources continue to use OpenAI",async()=>{
  const original=fetch,old=Deno.env.get("OPENAI_API_KEY");Deno.env.set("OPENAI_API_KEY","text-test");
  globalThis.fetch=(async(url,opts)=>{assert(String(url)==="https://api.openai.com/v1/responses");const body=JSON.parse(String(opts?.body));assert(body.input[0].content[0].text.includes("37 volunteers"));return Response.json({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify(raw)}]}]});}) as typeof fetch;
  try {assert((await analyze({type:"transcript",transcript:"00:00 There are 37 volunteers.",language:"en"},[],null,new AbortController().signal)).coverage.kind==="transcript");}
  finally {globalThis.fetch=original;old===undefined?Deno.env.delete("OPENAI_API_KEY"):Deno.env.set("OPENAI_API_KEY",old);}
});
Deno.test("text context overflow becomes an actionable size error",async()=>{
  const original=fetch,old=Deno.env.get("OPENAI_API_KEY");Deno.env.set("OPENAI_API_KEY","text-test");
  globalThis.fetch=(async()=>Response.json({error:{code:"context_length_exceeded",message:"Your input exceeds the context window of this model."}},{status:400})) as typeof fetch;
  try {
    let error:any=null;
    try{await analyze({type:"transcript",transcript:"00:00 There are 37 volunteers.",language:"en"},[],null,new AbortController().signal);}catch(e){error=e;}
    assert(error?.code==="SOURCES_TOO_LARGE" && error?.status===413, "Overflow maps to SOURCES_TOO_LARGE");
  } finally {globalThis.fetch=original;old===undefined?Deno.env.delete("OPENAI_API_KEY"):Deno.env.set("OPENAI_API_KEY",old);}
});
Deno.test("text model migration preserves explicit overrides and structured output", async () => {
  const original = fetch;
  const keys = ["OPENAI_API_KEY", "SOURCE_TEXT_MODEL"];
  const old = keys.map(k => Deno.env.get(k));
  Deno.env.set("OPENAI_API_KEY", "text-test");
  let expected = "";
  globalThis.fetch = (async (_url, opts) => {
    const body = JSON.parse(String(opts?.body));
    assert(body.model === expected, "Correct migrated or custom model");
    assert(body.text.format.type === "json_schema" && body.text.format.strict === true);
    assert(body.store === false && body.max_output_tokens === 7000);
    return Response.json({status:"completed", output:[{content:[{type:"output_text",text:JSON.stringify(raw)}]}]});
  }) as typeof fetch;
  try {
    for (const [configured, target] of [[null,"gpt-6-luna"],["gpt-5.6-luna","gpt-6-luna"],["custom-model","custom-model"]]) {
      configured === null ? Deno.env.delete("SOURCE_TEXT_MODEL") : Deno.env.set("SOURCE_TEXT_MODEL", configured);
      expected = target!;
      await analyze({type:"transcript", transcript:"37 volunteers", language:"en"}, [], null, new AbortController().signal);
    }
  } finally {
    globalThis.fetch = original;
    keys.forEach((k,i) => old[i] === undefined ? Deno.env.delete(k) : Deno.env.set(k, old[i]!));
  }
});
