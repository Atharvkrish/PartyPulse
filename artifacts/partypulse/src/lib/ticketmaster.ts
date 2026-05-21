import type { Event } from "./firestoreEvents";
import type { Timestamp } from "firebase/firestore";

// ─── Ticketmaster Discovery API — via server-side proxy ───────────────────
//
// All Ticketmaster calls go through /api/ticketmaster (a Vercel serverless
// function) so the API key is never bundled into client JavaScript.
//
// The proxy endpoint:  GET /api/ticketmaster?latlong=<lat,lng>&radius=<miles>&size=<n>
// The API key is read from process.env.TICKETMASTER_API_KEY on the server.
// ──────────────────────────────────────────────────────────────────────────

const SEGMENT_MAP: Record<string, string> = {
  "Music":          "Club Night",
  "Arts & Theatre": "Themed Party",
  "Sports":         "Regular Party",
  "Family":         "Regular Party",
  "Miscellaneous":  "Regular Party",
};

// Cities to pre-load on startup
export const TM_PRELOAD_CITIES: [number, number][] = [
  [53.3498, -6.2603],  // Dublin
  [51.8985, -8.4756],  // Cork
  [53.2707, -9.0568],  // Galway
  [52.6638, -8.6267],  // Limerick
  [19.0760, 72.8777],  // Mumbai
  [28.6139, 77.2090],  // Delhi
  [22.7196, 75.8577],  // Indore
];

// ─── Internal types ────────────────────────────────────────────────────────
type TmVenue = {
  name: string;
  city?: { name: string };
  location?: { latitude: string; longitude: string };
};
type TmClassification = { segment?: { name: string } };
type TmImage = { url: string; width: number; height: number };
type TmStart = { localDate: string; localTime?: string };
type TmEvent = {
  id: string;
  name: string;
  info?: string;
  pleaseNote?: string;
  url: string;
  dates: { start: TmStart };
  images?: TmImage[];
  classifications?: TmClassification[];
  _embedded?: { venues?: TmVenue[] };
};
type TmResponse = {
  _embedded?: { events?: TmEvent[] };
  page?: { totalElements: number };
  fault?: { faultstring?: string };
};

// ─── Error types ──────────────────────────────────────────────────────────
export class TicketmasterError extends Error {
  constructor(
    public readonly code:
      | "MISSING_KEY"
      | "INVALID_KEY"
      | "QUOTA_EXCEEDED"
      | "NOT_FOUND"
      | "SERVER_ERROR"
      | "NETWORK_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "TicketmasterError";
  }
}

// ─── Core: call the server-side proxy ─────────────────────────────────────
// The proxy lives at /api/ticketmaster and forwards to Ticketmaster with
// the key attached server-side. This avoids CORS and keeps the key secret.
export async function fetchEventsFromTicketmaster(
  latlong: string,
  radiusMiles: number,
  size = 50,
): Promise<TmEvent[]> {
  const url =
    `/api/ticketmaster` +
    `?latlong=${encodeURIComponent(latlong)}` +
    `&radius=${radiusMiles}` +
    `&size=${size}`;

  console.group("[Ticketmaster] Proxy request");
  console.log("URL:", url);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  } catch (err) {
    console.error("[Ticketmaster] Network error:", err);
    console.groupEnd();
    throw new TicketmasterError(
      "NETWORK_ERROR",
      `Proxy request failed: ${(err as Error).message}`,
    );
  }

  console.log("Status:", res.status, res.statusText);

  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    console.error("[Ticketmaster] Error body:", body);
    console.groupEnd();

    if (res.status === 500) {
      // Proxy server misconfiguration — key not set on Vercel
      throw new TicketmasterError(
        "MISSING_KEY",
        "TICKETMASTER_API_KEY is not set on the server. " +
        "Add it in Vercel → Project → Settings → Environment Variables.",
      );
    }
    if (res.status === 401) {
      throw new TicketmasterError(
        "INVALID_KEY",
        "Invalid API key (HTTP 401). Verify TICKETMASTER_API_KEY in Vercel settings.",
      );
    }
    if (res.status === 403) {
      throw new TicketmasterError(
        "INVALID_KEY",
        "API key forbidden (HTTP 403). The key may be inactive or revoked.",
      );
    }
    if (res.status === 429) {
      throw new TicketmasterError(
        "QUOTA_EXCEEDED",
        "Rate limit exceeded (HTTP 429). Free tier: 5,000 req/day. Try again tomorrow.",
      );
    }
    throw new TicketmasterError(
      "SERVER_ERROR",
      `Proxy returned HTTP ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as TmResponse;
  console.log(
    "[Ticketmaster] Response preview:",
    JSON.stringify(data, null, 2).slice(0, 600),
  );
  console.groupEnd();

  // Some TM errors come back as HTTP 200 with a fault object
  if (data.fault) {
    throw new TicketmasterError(
      "INVALID_KEY",
      `Ticketmaster fault: ${data.fault.faultstring}`,
    );
  }

  const events = data._embedded?.events ?? [];
  if (events.length === 0) {
    console.info("[Ticketmaster] No events found for this location.");
  } else {
    console.info(
      `[Ticketmaster] ${events.length} events (total: ${data.page?.totalElements ?? "?"})`,
    );
  }

  return events;
}

// ─── Map a raw TM event → our internal Event shape ────────────────────────
function mapTmEvent(e: TmEvent): Event | null {
  const venue = e._embedded?.venues?.[0];
  const loc = venue?.location;
  if (!loc?.latitude || !loc?.longitude) return null;

  const segment = e.classifications?.[0]?.segment?.name ?? "";
  const bestImage = e.images?.sort((a, b) => b.width - a.width)[0];

  return {
    id: "tm_" + e.id,
    title: e.name,
    description: e.info || e.pleaseNote || "",
    date: e.dates.start.localDate,
    time: e.dates.start.localTime?.slice(0, 5) || "00:00",
    location: {
      lat: parseFloat(loc.latitude),
      lng: parseFloat(loc.longitude),
      address: `${venue!.name}${venue!.city?.name ? ", " + venue!.city.name : ""}`,
    },
    imageUrl: bestImage?.url || "",
    going: [],
    interested: [],
    cantGo: [],
    bannedUsers: [],
    checkedIn: [],
    creatorId: "ticketmaster",
    creatorName: "Ticketmaster",
    category: SEGMENT_MAP[segment] || "Regular Party",
    isExternal: true,
    externalUrl: e.url,
    createdAt: null as unknown as Timestamp,
  };
}

// ─── Fetch events near a lat/lng ──────────────────────────────────────────
export async function fetchTicketmasterEvents(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<Event[]> {
  const radiusMiles = Math.max(1, Math.round(radiusKm * 0.621371));
  try {
    const raw = await fetchEventsFromTicketmaster(`${lat},${lng}`, radiusMiles, 50);
    return raw.map(mapTmEvent).filter(Boolean) as Event[];
  } catch (err) {
    if (err instanceof TicketmasterError) {
      if (err.code !== "MISSING_KEY") {
        console.error(`[Ticketmaster] ${err.code}:`, err.message);
      }
    } else {
      console.error("[Ticketmaster] Unexpected error:", err);
    }
    return [];
  }
}

// ─── Pre-load events for multiple cities (deduped by id) ──────────────────
export async function fetchTicketmasterForCities(
  cities: [number, number][],
  radiusKm = 20,
): Promise<Event[]> {
  // No up-front key check — the key lives on the server now.
  // If the proxy returns a MISSING_KEY error it will be logged per-request.

  const results = await Promise.allSettled(
    cities.map(([lat, lng]) => fetchTicketmasterEvents(lat, lng, radiusKm)),
  );

  const allEvents: Event[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const ev of r.value) {
        if (!seen.has(ev.id)) {
          seen.add(ev.id);
          allEvents.push(ev);
        }
      }
    }
  }

  console.info(`[Ticketmaster] Total unique events loaded: ${allEvents.length}`);
  return allEvents;
}
