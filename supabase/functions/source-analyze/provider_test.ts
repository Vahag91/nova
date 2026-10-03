import { analyze } from "./provider.ts";
function assert(v: unknown, message = "Assertion failed") { if (!v) throw new Error(message); }
const raw = { sourceAccessible: true, title: "Visual test", overview: "A blue square appears.", keyPoints: ["A blue square."], sections: [{title:"Scene",body:"Blue square",startSeconds:2700},{title:"Invalid",body:"Beyond coverage",startSeconds:3601}],actions:[], evidence:[], limitations:[] };
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

Deno.test('document questions read the full extraction and return an answer instead of another brief',async()=>{
 const original=fetch,old=Deno.env.get('OPENAI_API_KEY');Deno.env.set('OPENAI_API_KEY','test');
 globalThis.fetch=(async(_url,opts)=>{const body=JSON.parse(String(opts?.body));assert(body.input[0].content[0].text.includes('FINAL_SECRET_742'));assert(body.text.format.schema.required[0]==='answer');return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:'The final code is FINAL_SECRET_742.'})}]}]});}) as typeof fetch;
 try{const result=await analyze({type:'document',mode:'question',question:'What is the final code?',language:'en'},[{name:'Long report',extracted_text:'context '.repeat(15000)+'FINAL_SECRET_742'}],null,new AbortController().signal);assert(result.answer==='The final code is FINAL_SECRET_742.'&&result.coverage.extractedChars>48000);}
 finally{globalThis.fetch=original;old===undefined?Deno.env.delete('OPENAI_API_KEY'):Deno.env.set('OPENAI_API_KEY',old);}
});
