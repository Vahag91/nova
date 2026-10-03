import { handleRequest } from "./index.ts";
const device = "123e4567-e89b-42d3-a456-426614174000",
  docId = "123e4567-e89b-42d3-a456-426614174001",
  id = "123e4567-e89b-42d3-a456-426614174002";
const secret = "a".repeat(64);
function assert(value: unknown, message = "Assertion failed") {
  if (!value) throw new Error(message);
}
Deno.test("job lifecycle, ownership, idempotency, quotas and provider failure", async () => {
  const original = fetch;
  const env = {
    SUPABASE_URL: "https://db.test",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    OPENAI_API_KEY: "text",
    GEMINI_API_KEY: "video",
  };
  const old = Object.fromEntries(
    Object.keys(env).map((k) => [k, Deno.env.get(k)]),
  );
  Object.entries(env).forEach(([k, v]) => Deno.env.set(k, v));
  let job: any = null,
    providerCalls = 0,
    quotaCode = "",
    rows: any[] = [],
    invalid = false;
  globalThis.fetch = (async (url, opts) => {
    const u = new URL(String(url)),
      body = opts?.body ? JSON.parse(String(opts.body)) : null;
    if (u.pathname.endsWith("source_workspace_settings")) {
      return Response.json([{
        enabled: true,
        document_enabled: true,
        transcript_enabled: true,
        youtube_enabled: true,
        upload_enabled: true,
      }]);
    }
    if (u.pathname.endsWith("chat_documents")) {
      if (opts?.method === "POST") return Response.json([body]);
      assert(
        u.searchParams.get("client_hash")?.startsWith("eq."),
        "Document ownership filter",
      );
      assert(
        u.searchParams.get("expires_at")?.startsWith("gt."),
        "Document expiry filter",
      );
      return Response.json(rows);
    }
    if (u.pathname.endsWith("reserve_source_workspace_job")) {
      if (quotaCode) return Response.json({ code: quotaCode });
      job = {
        id: body.p_id,
        owner_hash: body.p_owner,
        client_hash: body.p_client,
        request_hash: body.p_hash,
        source_type: body.p_type,
        status: "processing",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };
      return Response.json({ created: true });
    }
    if (u.pathname.endsWith("source_workspace_jobs")) {
      if (!job) return Response.json([]);
      if (
        u.searchParams.get("owner_hash") &&
        u.searchParams.get("owner_hash") !== "eq." + job.owner_hash
      ) return Response.json([]);
      if (opts?.method === "PATCH") {
        if (
          u.searchParams.get("status") &&
          u.searchParams.get("status") !== "eq." + job.status
        ) return Response.json([]);
        Object.assign(job, body);
      }
      return Response.json([job]);
    }
    assert(u.hostname === "api.openai.com");
    providerCalls++;
    assert(
      body.store === false && body.text.format.strict === true,
      "Private structured output",
    );
    const result = {
      sourceAccessible: true,
      title: "Review",
      overview: "Revenue grew.",
      keyPoints: ["Revenue grew."],
      sections: [],
      actions: [],
      evidence: [],
      limitations: [],
    };
    return Response.json({
      status: invalid ? "incomplete" : "completed",
      output: [{
        content: [{ type: "output_text", text: JSON.stringify(result) }],
      }],
    });
  }) as typeof fetch;
  const source = {
    type: "transcript",
    transcript:
      "Revenue grew during the quarter. The team will publish the report on Friday.",
  };
  const call = (method = "POST", body: any = source, key = secret) =>
    handleRequest(
      new Request(
        "https://service.test" + (method === "POST" ? "" : "?id=" + id),
        {
          method,
          headers: {
            "x-client-id": device,
            "x-workspace-key": key,
            "x-request-id": id,
            "content-type": "application/json",
          },
          ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
        },
      ),
    );
  try {
    let r = await handleRequest(new Request("https://service.test"));
    assert((await r.json()).contractVersion === 2);
    r = await call("POST", source, "");
    assert(r.status === 401 && providerCalls === 0);
    r = await call("POST", { type: "document", documentIds: [docId] });
    assert(r.status === 410 && providerCalls === 0);
    const bigIds = [docId, docId.slice(0, -1) + "2", docId.slice(0, -1) + "3"];
    rows = bigIds.map((rowId) => ({
      id: rowId,
      name: "dense.txt",
      extracted_text: "字".repeat(190000),
      extracted_chars: 190000,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }));
    r = await call("POST", { type: "document", documentIds: bigIds });
    assert(
      r.status === 413 && (await r.json()).code === "SOURCES_TOO_LARGE" &&
        providerCalls === 0,
      "Combined input budget rejects before any provider call",
    );
    rows = [];
    quotaCode = "DAILY_LIMIT";
    r = await call();
    assert(r.status === 429 && providerCalls === 0);
    quotaCode = "";
    r = await call();
    let data = await r.json();
    assert(
      r.status === 202 && data.job.status === "completed" &&
        providerCalls === 1,
    );
    assert(
      data.job.result.sourceDocuments.length === 1,
      "Transcript available for chat",
    );
    r = await call();
    assert(
      r.status === 200 && providerCalls === 1,
      "Retry reuses completed job",
    );
    r = await call("POST", {
      ...source,
      transcript: source.transcript + " Changed",
    });
    assert(r.status === 409 && providerCalls === 1);
    r = await call("GET", null, "b".repeat(64));
    assert(r.status === 404, "Foreign secret cannot read job");
    r = await call("DELETE", null, "b".repeat(64));
    assert(
      r.status === 404 && job.status === "completed",
      "Foreign secret cannot cancel",
    );
    r = await call("DELETE");
    assert(
      r.status === 200 && job.result === null && job.status === "cancelled",
    );
    r = await call();
    assert(
      (await r.json()).job.status === "cancelled" && providerCalls === 1,
      "Cancelled request never reruns",
    );
    job = null;
    invalid = true;
    r = await call();
    data = await r.json();
    assert(data.job.status === "failed" && data.job.code === "INVALID_RESULT");
    job.status = "processing";
    job.created_at = new Date(Date.now() - 160000).toISOString();
    r = await call("GET");
    assert(
      (await r.json()).job.code === "TIMEOUT",
      "Dead worker becomes actionable failure",
    );
    job = null;
    r = await call("POST", {
      type: "youtube",
      url: "https://youtube.com.evil.test/watch?v=abcdefghijk",
    });
    assert(r.status === 400);
    Deno.env.delete("GEMINI_API_KEY");
    Deno.env.delete("GOOGLE_API_KEY");
    r = await call("POST", {
      type: "youtube",
      url: "https://youtu.be/abcdefghijk",
    });
    assert(r.status === 503);
  } finally {
    globalThis.fetch = original;
    Object.entries(old).forEach(([k, v]) =>
      v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v)
    );
  }
});
