import type { Event } from "./firestoreEvents";
import type { Timestamp } from "firebase/firestore";

const SEGMENT_MAP: Record<string, string> = {
  "Music": "Club Night",
  "Arts & Theatre": "Themed Party",
  "Sports": "Regular Party",
  "Family": "Regular Party",
  "Miscellaneous": "Regular Party",
};

// Cities to pre-load on startup
export const TM_PRELOAD_CITIES: [number, number][] = [
  [53.3498, -6.2603],
  [51.8985, -8.4756],
  [53.2707, -9.0568],
  [52.6638, -8.6267],
  [19.0760, 72.8777],
  [28.6139, 77.2090],
  [22.7196, 75.8577],
];

type TmVenue = {
  name: string;
  city?: { name: string };
  location?: { latitude: string; longitude: string };
};
type TmClassification = {
  segment?: { name: string };
};
type TmImage = { url: string };
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

function mapTmEvent(e: TmEvent): Event | null {
  const venue = e._embedded?.venues?.[0];
  const loc = venue?.location;
  if (!loc?.latitude || !loc?.longitude) return null;

  const segment = e.classifications?.[0]?.segment?.name ?? "";
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
    imageUrl: e.images?.[0]?.url || "",
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

export async function fetchTicketmasterEvents(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<Event[]> {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  const radiusMiles = Math.max(1, Math.round(radiusKm * 0.621371));
  const url =
    `https://app.ticketmaster.com/discovery/v2/events.json` +
    `?apikey=${apiKey}&latlong=${lat},${lng}&radius=${radiusMiles}&unit=miles&size=50&sort=date,asc`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json() as { _embedded?: { events?: TmEvent[] } };
    const raw = data._embedded?.events ?? [];
    return raw.map(mapTmEvent).filter(Boolean) as Event[];
  } catch {
    return [];
  }
}

export async function fetchTicketmasterForCities(cities: [number, number][], radiusKm = 20): Promise<Event[]> {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  const results = await Promise.allSettled(
    cities.map(([lat, lng]) => fetchTicketmasterEvents(lat, lng, radiusKm))
  );

  const allEvents: Event[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const ev of r.value) {
        if (!seen.has(ev.id)) { seen.add(ev.id); allEvents.push(ev); }
      }
    }
  }
  return allEvents;
}
