import { moderateLatestUserTurn, withSafetySystemMessage, SAFETY_SYSTEM_MESSAGE } from "./safety.ts";
function assert(value: unknown, message = "Assertion failed") { if (!value) throw new Error(message); }
Deno.test("latest turn moderation limits text/images and blocks only configured categories", async () => {
  const original = fetch;
  let categories: Record<string,boolean> = {harassment:true,violence:true};
  globalThis.fetch = (async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert(body.model === "omni-moderation-latest");
    assert(body.input.filter((p:any)=>p.type==="text").reduce((n:number,p:any)=>n+p.text.length,0) === 8000);
    assert(body.input.filter((p:any)=>p.type==="image_url").length === 4);
    assert(!JSON.stringify(body).includes("old turn"));
    return Response.json({results:[{categories}]});
  }) as typeof fetch;
  const body = {messages:[{role:"user",content:"old turn"},{role:"assistant",content:"reply"},{role:"user",content:[
    {type:"input_text",text:"a".repeat(9000)},
    ...Array.from({length:5},()=>({type:"image_url",image_url:{url:"data:image/png;base64,test"}})),
  ]}]};
  try {
    assert(!(await moderateLatestUserTurn(body,"test")).blocked);
    for (const category of ["sexual","sexual/minors","hate/threatening","harassment/threatening","self-harm/instructions","violence/graphic","illicit/violent"]) {
      categories = {[category]:true};
      const result = await moderateLatestUserTurn(body,"test");
      assert(result.blocked && result.categories[0] === category);
    }
  } finally {globalThis.fetch = original;}
});
Deno.test("missing input and moderation errors fail open; policy prepends idempotently", async () => {
  const original = fetch;
  const body = {model:"unchanged",messages:[{role:"user",content:"Paris?"}]};
  try {
    globalThis.fetch = (async () => {throw new Error("simulated outage");}) as typeof fetch;
    assert((await moderateLatestUserTurn(body,undefined)).skipped === "no_api_key");
    assert((await moderateLatestUserTurn({messages:[]},"test")).skipped === "no_user_message");
    assert((await moderateLatestUserTurn({messages:[{role:"user",content:" "}]},"test")).skipped === "empty_input");
    assert((await moderateLatestUserTurn(body,"test")).skipped === "error");
    globalThis.fetch = (async()=>new Response("",{status:503})) as typeof fetch;
    assert((await moderateLatestUserTurn(body,"test")).skipped === "http_503");
    const safe = withSafetySystemMessage(body);
    assert(safe.messages[0] === SAFETY_SYSTEM_MESSAGE && safe.model === body.model);
    assert(body.messages.length === 1 && withSafetySystemMessage(safe) === safe);
  } finally {globalThis.fetch = original;}
});
