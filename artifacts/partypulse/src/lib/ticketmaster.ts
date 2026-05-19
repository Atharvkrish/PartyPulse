import type { Event } from "./firestoreEvents";
import type { Timestamp } from "firebase/firestore";

// ─── Ticketmaster Discovery API v2 ────────────────────────────────────────
// Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
// Base URL (Production): https://app.ticketmaster.com/discovery/v2/
// Auth: pass your key as the `apikey` query parameter — never in a header.
// ──────────────────────────────────────────────────────────────────────────

const TM_BASE_URL = "https://app.ticketmaster.com/discovery/v2";

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
    public readonly code: "MISSING_KEY" | "INVALID_KEY" | "QUOTA_EXCEEDED" | "NOT_FOUND" | "SERVER_ERROR" | "NETWORK_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "TicketmasterError";
  }
}

function getApiKey(): string {
  const key = import.meta.env.VITE_TICKETMASTER_API_KEY as string | undefined;
  if (!key || key.trim() === "") {
    throw new TicketmasterError(
      "MISSING_KEY",
      "VITE_TICKETMASTER_API_KEY is not set. " +
      "Add it to your Replit Secrets (and to Vercel → Project → Settings → Environment Variables for production).",
    );
  }
  return key.trim();
}

// ─── Core utility: fetchEventsFromTicketmaster ─────────────────────────────
// Makes a single Discovery API request, logs the full URL + response,
// and throws a typed TicketmasterError on any failure.
export async function fetchEventsFromTicketmaster(
  params: Record<string, string | number>,
): Promise<TmEvent[]> {
  const apiKey = getApiKey();

  const qs = new URLSearchParams({
    apikey: apiKey,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });

  const url = `${TM_BASE_URL}/events.json?${qs.toString()}`;

  // Log the full request URL (key visible in dev — remove in prod if desired)
  console.group("[Ticketmaster] API request");
  console.log("URL:", url);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    console.error("[Ticketmaster] Network error:", err);
    console.groupEnd();
    throw new TicketmasterError("NETWORK_ERROR", `Network request failed: ${(err as Error).message}`);
  }

  console.log("Status:", res.status, res.statusText);

  // ── Handle HTTP error codes with specific messages ──────────────────────
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* ignore */ }
    console.error("[Ticketmaster] Error body:", body);
    console.groupEnd();

    if (res.status === 401) {
      throw new TicketmasterError(
        "INVALID_KEY",
        "Invalid API Key (HTTP 401). " +
        "Check that VITE_TICKETMASTER_API_KEY is the correct Production key from " +
        "https://developer.ticketmaster.com/. Staging keys use a different base URL.",
      );
    }
    if (res.status === 403) {
      throw new TicketmasterError(
        "INVALID_KEY",
        "API Key forbidden (HTTP 403). The key may be inactive, revoked, " +
        "or not yet approved. Check your app status at developer.ticketmaster.com.",
      );
    }
    if (res.status === 429) {
      throw new TicketmasterError(
        "QUOTA_EXCEEDED",
        "Rate limit exceeded (HTTP 429). The free tier allows 5,000 requests/day. " +
        "You have hit that limit — try again tomorrow or upgrade your plan.",
      );
    }
    throw new TicketmasterError(
      "SERVER_ERROR",
      `Ticketmaster returned HTTP ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  const data = await res.json() as TmResponse;
  console.log("[Ticketmaster] Response:", JSON.stringify(data, null, 2).slice(0, 800));
  console.groupEnd();

  // Some error responses come back as HTTP 200 with a fault object
  if (data.fault) {
    throw new TicketmasterError("INVALID_KEY", `Ticketmaster fault: ${data.fault.faultstring}`);
  }

  const events = data._embedded?.events ?? [];
  if (events.length === 0) {
    console.info("[Ticketmaster] No events found for the given parameters.");
  } else {
    console.info(`[Ticketmaster] Found ${events.length} events (total: ${data.page?.totalElements ?? "?"}).`);
  }

  return events;
}

// ─── Map a raw TM event to our internal Event shape ───────────────────────
function mapTmEvent(e: TmEvent): Event | null {
  const venue = e._embedded?.venues?.[0];
  const loc = venue?.location;
  if (!loc?.latitude || !loc?.longitude) return null;

  const segment = e.classifications?.[0]?.segment?.name ?? "";

  // Prefer a wide landscape image
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
    const raw = await fetchEventsFromTicketmaster({
      latlong: `${lat},${lng}`,
      radius: radiusMiles,
      unit: "miles",
      size: 50,
      sort: "date,asc",
    });
    return raw.map(mapTmEvent).filter(Boolean) as Event[];
  } catch (err) {
    if (err instanceof TicketmasterError) {
      // Only log MISSING_KEY once — it will spam otherwise
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
  // Validate key up-front for a clear early error
  try {
    getApiKey();
  } catch (err) {
    if (err instanceof TicketmasterError && err.code === "MISSING_KEY") {
      console.warn("[Ticketmaster]", err.message);
      return [];
    }
    throw err;
  }

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
