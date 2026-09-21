import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Only the hash is deployed; the random bearer credential stays in Netlify.
const TOKEN_SHA256 = "0f95173de13f3d0f62f977713f14fb396853d2c4d105e9aea4622a27f3d13950";
const REST_PATH = /^\/rest\/v1\/(mixology_(items|recipes|likes|saves|comments)|rpc\/mixology_(item|recipe)_list)$/;
const PUBLIC_COVER = "/storage/v1/object/public/mixology-assets/";
const COVER = "/storage/v1/object/mixology-assets/";
const json = (error: string, status: number) => new Response(JSON.stringify({ error }), {
  status, headers: { "content-type": "application/json" },
});

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  const match = url.pathname.match(/\/(?:rest|storage)\/v1\//);
  const path = match?.index === undefined ? "" : url.pathname.slice(match.index);
  const publicCover = path.startsWith(PUBLIC_COVER) && ["GET", "HEAD"].includes(request.method);
  const bucket = path === "/storage/v1/bucket" && request.method === "POST";
  if (!REST_PATH.test(path) && !path.startsWith(COVER) && !publicCover && !bucket) {
    return json("unsupported_path", 404);
  }
  if (!publicCover) {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    if (!token || hash !== TOKEN_SHA256) return json("unauthorized", 401);
  }
  let body: BodyInit | null = ["GET", "HEAD"].includes(request.method) ? null : request.body;
  if (bucket) {
    let input;
    try { input = await request.json(); } catch { return json("invalid_bucket", 400); }
    if (input.id !== "mixology-assets" || input.name !== "mixology-assets") return json("invalid_bucket", 400);
    body = JSON.stringify({ id: "mixology-assets", name: "mixology-assets", public: true });
  }
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) return json("upstream_not_configured", 503);
  const headers = new Headers({ apikey: key, authorization: `Bearer ${key}` });
  for (const name of ["accept", "content-type", "prefer", "range", "cache-control", "x-upsert", "if-none-match"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(new URL(path + url.search, base), {
      method: request.method, headers, body, redirect: "manual",
    });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("set-cookie");
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return json("upstream_unavailable", 502);
  }
});
