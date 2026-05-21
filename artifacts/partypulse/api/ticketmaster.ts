import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Vercel Serverless Proxy for Ticketmaster Discovery API ─────────────────
//
// WHY THIS EXISTS:
//   The Ticketmaster API does not send CORS headers that allow browser
//   (cross-origin) requests, so all calls must go through a server-side proxy.
//
// REQUIRED ENVIRONMENT VARIABLE:
//   TICKETMASTER_API_KEY — set this in Vercel → Project → Settings →
//   Environment Variables (Production + Preview + Development).
//   Never use a VITE_ prefix — that would bundle the key into client JS.
//
// ENDPOINT:
//   GET /api/ticketmaster?latlong=<lat,lng>&radius=<miles>&size=<n>
// ─────────────────────────────────────────────────────────────────────────────

const TM_BASE = "https://app.ticketmaster.com/discovery/v2/events.json";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Only allow GET
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Read server-side API key — never exposed to the browser
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.error(
      "[ticketmaster proxy] TICKETMASTER_API_KEY is not set. " +
      "Add it in Vercel → Project → Settings → Environment Variables.",
    );
    res.status(500).json({
      error:
        "Server misconfiguration: TICKETMASTER_API_KEY is not set. " +
        "Contact the site administrator.",
    });
    return;
  }

  // Read and validate query params
  const rawLatlong = req.query.latlong;
  const rawRadius  = req.query.radius  ?? "12";
  const rawSize    = req.query.size    ?? "50";

  const latlong = Array.isArray(rawLatlong) ? rawLatlong[0] : rawLatlong;
  const radius  = Array.isArray(rawRadius)  ? rawRadius[0]  : rawRadius;
  const size    = Array.isArray(rawSize)    ? rawSize[0]    : rawSize;

  if (!latlong || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(latlong)) {
    res.status(400).json({ error: "latlong query param is required (format: lat,lng)" });
    return;
  }

  // Construct the upstream Ticketmaster URL
  const url =
    `${TM_BASE}?apikey=${apiKey}` +
    `&latlong=${encodeURIComponent(latlong)}` +
    `&radius=${encodeURIComponent(radius ?? "12")}` +
    `&unit=miles` +
    `&size=${encodeURIComponent(size ?? "50")}` +
    `&sort=date,asc`;

  console.log(
    `[ticketmaster proxy] → latlong=${latlong} radius=${radius} size=${size}`,
  );

  let tmRes: Response;
  try {
    tmRes = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    console.error("[ticketmaster proxy] Fetch error:", err);
    res.status(502).json({ error: "Failed to reach Ticketmaster API" });
    return;
  }

  console.log(`[ticketmaster proxy] ← TM status: ${tmRes.status} ${tmRes.statusText}`);

  // Forward TM's status code + JSON body verbatim so the frontend can
  // inspect faults / rate-limit messages exactly as before.
  let body: unknown;
  try {
    body = await tmRes.json();
  } catch {
    body = { error: "Non-JSON response from Ticketmaster" };
  }

  res.status(tmRes.status).json(body);
}
