import { handleRequest, hash } from './index.ts';
const assert=(v:unknown,message='Assertion failed')=>{if(!v)throw Error(message);};
Deno.test('video follow-up authenticates source ownership, hides file reference and enforces expiry',async()=>{
 const original=fetch;const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY'];const old=names.map(k=>Deno.env.get(k));['https://db.test','service','video'].forEach((v,i)=>Deno.env.set(names[i],v));
 const client='123e4567-e89b-42d3-a456-426614174000',parentId='123e4567-e89b-42d3-a456-426614174001',childId='123e4567-e89b-42d3-a456-426614174002',secret='a'.repeat(64);
 const owner=await hash(secret+':'+client);let calls=0;
 const parent:any={id:parentId,owner_hash:owner,status:'completed',source_type:'upload',expires_at:new Date(Date.now()+86400000).toISOString(),created_at:new Date().toISOString(),result:{title:'Video',_video:{name:'files/private',uri:'https://generativelanguage.googleapis.com/v1beta/files/private',mimeType:'video/mp4',expiresAt:new Date(Date.now()+3600000).toISOString()},videoSource:{jobId:parentId,type:'upload',expiresAt:new Date(Date.now()+3600000).toISOString()}}};
 const jobs:any={[parentId]:parent};
 globalThis.fetch=(async(url,opts)=>{
  const u=new URL(String(url)),body=opts?.body?JSON.parse(String(opts.body)):null;
  if(u.pathname.endsWith('reserve_source_workspace_job')){jobs[body.p_id]={id:body.p_id,owner_hash:body.p_owner,client_hash:body.p_client,request_hash:body.p_hash,source_type:body.p_type,status:'processing',created_at:new Date().toISOString(),expires_at:parent.expires_at};return Response.json({created:true});}
  if(u.pathname.endsWith('source_workspace_jobs')){const job=jobs[u.searchParams.get('id')?.slice(3)||''];if(!job||u.searchParams.has('owner_hash')&&u.searchParams.get('owner_hash')!=='eq.'+job.owner_hash)return Response.json([]);if(opts?.method==='PATCH')Object.assign(job,body);return Response.json([job]);}
  assert(u.hostname==='generativelanguage.googleapis.com','No summary-only text provider');calls++;assert(body.contents[0].parts[0].fileData.fileUri===parent.result._video.uri);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({answer:'A detail found by looking at the video again.'})}]}}]});
 }) as typeof fetch;
 const call=(key=secret,method='POST')=>handleRequest(new Request('https://service.test'+(method==='GET'?'?id='+parentId:''),{method,headers:{'x-client-id':client,'x-workspace-key':key,'x-request-id':childId,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({type:'upload',sourceJobId:parentId,question:'What happens?'})}:{})}));
 try{
  const publicBody=await (await call(secret,'GET')).json();assert(!JSON.stringify(publicBody).includes('files/private'),'Private provider URI never returned');
  assert((await call('b'.repeat(64))).status===404 && calls===0,'Other device secret cannot reuse video');
  parent.result._video.expiresAt='2000-01-01';assert((await call()).status===410 && calls===0,'Expired media rejected before charge');
  parent.result._video.expiresAt=new Date(Date.now()+3600000).toISOString();const response=await call();const result=await response.json();assert(response.status===202&&result.job.result.answer&&calls===1);assert(!JSON.stringify(result).includes('files/private'));assert(result.job.result.videoSource.jobId===parentId);
  assert((await call()).status===200&&calls===1,'Duplicate question request is idempotent');
 }finally{globalThis.fetch=original;names.forEach((n,i)=>old[i]===undefined?Deno.env.delete(n):Deno.env.set(n,old[i]!));}
});
