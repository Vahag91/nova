/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-id, x-app-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

type Body = {
  uri?: string;           // data URI or base64 string
  file?: any;            // file object (for future use)
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Only POST", { status: 405, headers: CORS });

  const RUNWARE_API_KEY = Deno.env.get("RUNWARE_KEY") || "";
  if (!RUNWARE_API_KEY) {
    return new Response("Runware not configured", { status: 500, headers: CORS });
  }

  let body: Body = {};
  try { 
    body = await req.json(); 
  } catch { 
    return new Response("Bad JSON", { status: 400, headers: CORS }); 
  }

  const { uri } = body;
  if (!uri) {
    return new Response("Missing image URI", { status: 400, headers: CORS });
  }

  try {
    // Upload to Runware Image Upload API
    const uploadResponse = await fetch("https://api.runware.ai/v1/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNWARE_API_KEY}`,
        "X-API-Key": RUNWARE_API_KEY,
      },
      body: JSON.stringify({
        image: uri, // data URI or base64
      }),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => "Upload failed");
      return new Response(errorText, { status: uploadResponse.status, headers: CORS });
    }

    const uploadJson = await uploadResponse.json();
    const imageUUID = uploadJson?.imageUUID || uploadJson?.uuid || uploadJson?.id;

    if (!imageUUID) {
      return new Response("Invalid response from Runware", { status: 502, headers: CORS });
    }

    return new Response(JSON.stringify({
      success: true,
      imageUUID,
      message: "Image uploaded successfully"
    }), { 
      status: 200, 
      headers: { ...CORS, "Content-Type": "application/json" } 
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || "Upload failed" 
      }), 
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
