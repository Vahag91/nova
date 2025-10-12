// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { MODELS } from "../chat-proxy/registry.js";

Deno.serve(() => {
  const body = JSON.stringify({ models: MODELS });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
});
