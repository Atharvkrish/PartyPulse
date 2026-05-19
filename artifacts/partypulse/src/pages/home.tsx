import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { subscribeEvents, Event } from "@/lib/firestoreEvents";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_FILTERS, FilterState, applyFilters, countActiveFilters, haversineKm, CATEGORY_META,
} from "@/lib/eventFilters";
import { fetchTicketmasterForCities, TM_PRELOAD_CITIES } from "@/lib/ticketmaster";
import { seedEventsIfEmpty } from "@/lib/seedEvents";
import { subscribeOwnActivity, Activity } from "@/lib/firestoreActivity";
import EventFilterSheet from "@/components/EventFilterSheet";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import BottomNav from "@/components/BottomNav";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const DUBLIN: [number, number] = [53.3498, -6.2603];

function getMarkerColor(going: number, isExternal = false): string {
  if (isExternal) return "#6366f1";
  if (going >= 16) return "#22c55e";
  if (going >= 5) return "#f59e0b";
  return "#ef4444";
}

function createColoredIcon(color: string, category?: string) {
  const emoji = category ? CATEGORY_META[category as keyof typeof CATEGORY_META]?.emoji ?? "🎉" : "🎉";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
      <div style="width:30px;height:30px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;">${emoji}</div>
    </div>`,
    iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20],
  });
}

function MapController({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, []);
  return null;
}

function MapFlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { animate: true, duration: 0.8 });
  }, [target]);
  return null;
}

function UserLocationButton({ onLocated }: { onLocated: (lat: number, lng: number) => void }) {
  const map = useMap();
  return (
    <button data-testid="button-locate-me" onClick={() => {
      navigator.geolocation.getCurrentPosition((pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        onLocated(pos.coords.latitude, pos.coords.longitude);
      });
    }} className="absolute bottom-44 right-4 z-[999] bg-card border border-border rounded-full w-10 h-10 flex items-center justify-center text-foreground shadow-md hover:bg-accent transition-colors" title="My location">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
    </button>
  );
}

// Notification Bell component
function NotificationBell({ activities, onOpen }: { activities: Activity[]; onOpen: () => void }) {
  const lastSeenKey = "pp_notif_seen";
  const lastSeen = parseInt(localStorage.getItem(lastSeenKey) ?? "0", 10);
  const unread = activities.filter((a) => {
    const ts = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    return ts > lastSeen;
  }).length;

  return (
    <button onClick={onOpen} className="relative flex-shrink-0 w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

function getActivityLabel(a: Activity): string {
  switch (a.type) {
    case "rsvped": return `RSVPed ${a.detail} to ${a.eventTitle}`;
    case "created_event": return `Created event: ${a.eventTitle}`;
    case "uploaded_photos": return `Uploaded ${a.detail} to ${a.eventTitle}`;
    default: return a.eventTitle ?? "";
  }
}

export default function Home() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [tmEvents, setTmEvents] = useState<Event[]>([]);
  const [, setLocation] = useLocation();
  const [panelOpen, setPanelOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [tmLoading, setTmLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // Notifications
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // Location search state
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [showLocationSetter, setShowLocationSetter] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState("");

  useEffect(() => { return subscribeEvents(setEvents); }, []);

  // Subscribe to user's notifications
  useEffect(() => {
    if (!user) return;
    return subscribeOwnActivity(user.uid, setActivities);
  }, [user]);

  // Ticketmaster preload
  useEffect(() => {
    const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY;
    if (!apiKey) return;
    setTmLoading(true);
    fetchTicketmasterForCities(TM_PRELOAD_CITIES, 20)
      .then(setTmEvents)
      .catch(() => { })
      .finally(() => setTmLoading(false));
  }, []);

  // Seed 60+ events + dummy users when Firestore is empty.
  // Waits 3 s for the real-time subscription to settle before checking the count.
  useEffect(() => {
    if (!user || seeded) return;
    const timer = setTimeout(() => {
      setSeeded(true);
      seedEventsIfEmpty(events.length).catch(console.error);
    }, 3000);
    return () => clearTimeout(timer);
  }, [user]); // only re-run when user changes, not on every events update

  // Geolocation
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { }
    );
  }, []);

  useEffect(() => {
    const uid = user?.uid;
    if (uid) {
      const saved = localStorage.getItem(`pp_location_${uid}`);
      if (saved) {
        const { lat, lng } = JSON.parse(saved);
        setUserCoords({ lat, lng });
        mapRef.current?.setView([lat, lng], 13);
      }
    }
  }, [user]);

  // Auto-open panel when search has results
  useEffect(() => {
    if (filters.search.trim() && allFilteredEvents.length > 0) setPanelOpen(true);
  }, [filters.search]);

  // Merge Firestore + Ticketmaster events
  const allEvents = [...events, ...tmEvents];

  // Compute "For You" categories based on user's RSVPs
  const forYouCategories = new Set<string>();
  if (user) {
    for (const e of events) {
      if (e.going.includes(user.uid) && e.category) forYouCategories.add(e.category);
    }
  }

  const allFilteredEvents = applyFilters(allEvents, filters, userCoords?.lat, userCoords?.lng);
  const activeFilterCount = countActiveFilters(filters);

  function formatDistance(event: Event): string | null {
    if (!userCoords) return null;
    const km = haversineKm(userCoords.lat, userCoords.lng, event.location.lat, event.location.lng);
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
  }

  function getCategoryMeta(cat?: string) {
    if (!cat) return null;
    return CATEGORY_META[cat as keyof typeof CATEGORY_META] ?? null;
  }

  function flyToEvent(event: Event) {
    setFlyTarget({ lat: event.location.lat, lng: event.location.lng });
    setTimeout(() => setFlyTarget(null), 1000);
  }

  async function searchLocation(query: string) {
    if (!query.trim()) { setLocationResults([]); return; }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=4`);
    setLocationResults(await res.json());
  }

  async function setManualLocation() {
    if (!manualLocationInput.trim()) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(manualLocationInput)}&format=json&limit=1`);
    const data = await res.json();
    if (data[0]) {
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
      setUserCoords({ lat, lng });
      mapRef.current?.setView([lat, lng], 13);
      if (user?.uid) localStorage.setItem(`pp_location_${user.uid}`, JSON.stringify({ lat, lng }));
      setShowLocationSetter(false);
      setManualLocationInput("");
    }
  }

  function handleOpenNotifications() {
    setNotifOpen(true);
    localStorage.setItem("pp_notif_seen", String(Date.now()));
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-card border-b border-border z-10">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <span className="text-lg font-black tracking-tight flex-shrink-0">Party<span className="text-primary">Pulse</span></span>

          {/* Event search */}
          <div className="flex-1 relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input data-testid="input-search-events" type="text" value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search events…"
              className="w-full bg-background border border-border rounded-full pl-8 pr-8 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            {filters.search && (
              <button onClick={() => setFilters((f) => ({ ...f, search: "" }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Filter button */}
          <button data-testid="button-open-filters" onClick={() => setFilterSheetOpen(true)}
            className="relative flex-shrink-0 w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">{activeFilterCount}</span>
            )}
          </button>

          {/* Notification bell */}
          <NotificationBell activities={activities} onOpen={handleOpenNotifications} />

          {/* Set location button */}
          <button onClick={() => setShowLocationSetter(true)} title="Set my location"
            className="flex-shrink-0 w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">📍</button>

          {/* Avatar */}
          <div data-testid="avatar-user" onClick={() => setLocation("/profile")}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-sm font-bold text-primary cursor-pointer overflow-hidden">
            {(user?.displayName || user?.email || "?")[0].toUpperCase()}
          </div>
        </div>

        {/* Location search bar */}
        <div className="px-4 pb-2 relative">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <input type="text" value={locationSearch}
              onChange={(e) => { setLocationSearch(e.target.value); searchLocation(e.target.value); }}
              placeholder="Search location on map…"
              className="w-full bg-background border border-border rounded-full pl-8 pr-4 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            {locationSearch && (
              <button onClick={() => { setLocationSearch(""); setLocationResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          {locationResults.length > 0 && (
            <div className="absolute left-4 right-4 top-full bg-card border border-border rounded-lg shadow-lg z-[1000] mt-1 overflow-hidden">
              {locationResults.map((r, i) => (
                <button key={i} className="w-full text-left px-3 py-2 text-sm hover:bg-accent truncate border-b border-border last:border-0"
                  onClick={() => { mapRef.current?.setView([parseFloat(r.lat), parseFloat(r.lon)], 14); setLocationSearch(""); setLocationResults([]); }}>
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto">
            {filters.categories.map((cat) => {
              const meta = getCategoryMeta(cat);
              return (
                <button key={cat} onClick={() => setFilters((f) => ({ ...f, categories: f.categories.filter((c) => c !== cat) }))}
                  className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1">
                  {meta?.emoji} {cat}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              );
            })}
            {filters.datePreset !== "all" && (
              <button onClick={() => setFilters((f) => ({ ...f, datePreset: "all" }))}
                className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1">
                🗓 {filters.datePreset === "custom" ? `${filters.dateFrom}–${filters.dateTo}` : filters.datePreset.charAt(0).toUpperCase() + filters.datePreset.slice(1)}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
            {filters.maxDistanceKm !== null && (
              <button onClick={() => setFilters((f) => ({ ...f, maxDistanceKm: null }))}
                className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1">
                📍 {filters.maxDistanceKm}km
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
            {filters.sortBy !== "soonest" && (
              <button onClick={() => setFilters((f) => ({ ...f, sortBy: "soonest" }))}
                className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1">
                Sort: {filters.sortBy}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
            {filters.capacityOnly && (
              <button onClick={() => setFilters((f) => ({ ...f, capacityOnly: false }))}
                className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1">
                Spots available
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
            {!filters.showExternal && (
              <button onClick={() => setFilters((f) => ({ ...f, showExternal: true }))}
                className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1">
                🎫 Hiding TM
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
            <button onClick={() => setFilters(DEFAULT_FILTERS)} className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground px-1">Clear all</button>
          </div>
        )}
      </header>

      {/* ── Map ── */}
      <div className="relative flex-1 overflow-hidden">
        <MapContainer center={DUBLIN} zoom={13} style={{ height: "100%", width: "100%" }} className="z-0">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
          <MapController onReady={(m) => { mapRef.current = m; }} />
          <MapFlyTo target={flyTarget} />
          {allFilteredEvents.map((event) => (
            <Marker key={event.id} position={[event.location.lat, event.location.lng]}
              icon={createColoredIcon(getMarkerColor(event.going.length, event.isExternal), event.category)}>
              <Popup>
                <div className="min-w-[170px]">
                  {event.category && <p className="text-xs text-gray-400 mb-0.5">{CATEGORY_META[event.category as keyof typeof CATEGORY_META]?.emoji} {event.category}</p>}
                  {event.isExternal && <p className="text-xs text-indigo-400 mb-0.5">🎫 Ticketmaster</p>}
                  <p className="font-bold text-sm">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.date} at {event.time}</p>
                  {!event.isExternal && <p className="text-xs">{event.going.length} going</p>}
                  {event.isExternal && event.externalUrl
                    ? <a href={event.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block w-full bg-indigo-600 text-white text-xs py-1 px-2 rounded hover:bg-indigo-700 text-center">Get Tickets</a>
                    : <button onClick={() => setLocation(`/events/${event.id}`)} className="mt-2 w-full bg-violet-600 text-white text-xs py-1 px-2 rounded hover:bg-violet-700">View Event</button>
                  }
                </div>
              </Popup>
            </Marker>
          ))}
          <UserLocationButton onLocated={(lat, lng) => setUserCoords({ lat, lng })} />
        </MapContainer>

        {/* TM loading indicator */}
        {tmLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] bg-card/90 border border-border rounded-full px-3 py-1 text-xs text-muted-foreground flex items-center gap-2">
            <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Loading Ticketmaster events…
          </div>
        )}

        {/* Create FAB */}
        <button data-testid="button-create-event-fab" onClick={() => setLocation("/events/new")}
          className="absolute bottom-24 right-4 z-[999] bg-primary text-primary-foreground rounded-full px-5 py-3 font-bold text-sm shadow-lg hover:opacity-90 transition-opacity">
          + Create
        </button>

        {/* ── Events slide-up panel ── */}
        <div className="absolute bottom-0 left-0 right-0 z-[998] transition-transform duration-300"
          style={{ transform: panelOpen ? "translateY(0)" : "translateY(calc(100% - 48px))" }}>
          <div className="bg-card border-t border-border rounded-t-2xl shadow-2xl">
            <button data-testid="button-toggle-panel" onClick={() => setPanelOpen(!panelOpen)}
              className="w-full flex items-center justify-center py-3 gap-2 text-muted-foreground hover:text-foreground">
              <span className="w-8 h-1 rounded-full bg-border block" />
              <span className="text-xs font-medium">
                {allFilteredEvents.length === allEvents.length
                  ? `${allEvents.length} Events`
                  : `${allFilteredEvents.length} of ${allEvents.length} Events`}
              </span>
              {tmEvents.length > 0 && filters.showExternal && (
                <span className="text-xs bg-indigo-500/20 text-indigo-400 rounded-full px-2 py-0.5">+{tmEvents.length} TM</span>
              )}
              {allFilteredEvents.length < allEvents.length && (
                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">filtered</span>
              )}
            </button>

            <div className="overflow-y-auto max-h-56 px-4 pb-4 space-y-2">
              {allFilteredEvents.length === 0 && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-muted-foreground text-sm">No events match your filters.</p>
                  {activeFilterCount > 0 && <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-xs text-primary hover:underline">Clear filters</button>}
                </div>
              )}
              {allFilteredEvents.map((event) => {
                const catMeta = getCategoryMeta(event.category);
                const dist = formatDistance(event);
                const isForYou = !event.isExternal && event.category && forYouCategories.has(event.category) && !event.going.includes(user?.uid ?? "");
                return (
                  <div key={event.id} data-testid={`card-event-${event.id}`}
                    className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setLocation(`/events/${event.id}`)}>
                    {/* Pin button */}
                    <button onClick={(e) => { e.stopPropagation(); flyToEvent(event); setPanelOpen(false); }}
                      className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors" title="Show on map">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                    </button>

                    {/* Event thumbnail */}
                    {event.imageUrl && (
                      <img src={event.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    )}
                    {!event.imageUrl && catMeta && (
                      <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-lg ${event.isExternal ? "bg-indigo-500/10" : "bg-primary/10"}`}>
                        {catMeta.emoji}
                      </div>
                    )}

                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                        {isForYou && (
                          <span className="flex-shrink-0 text-[9px] font-bold bg-primary/15 text-primary rounded-full px-1.5 py-0.5">For You</span>
                        )}
                        {event.isExternal && (
                          <span className="flex-shrink-0 text-[9px] font-bold bg-indigo-500/15 text-indigo-400 rounded-full px-1.5 py-0.5">TM</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.date} at {event.time}
                        {dist && <> &bull; {dist}</>}
                        {!event.isExternal && <> &bull; {event.going.length} going</>}
                      </p>
                    </div>

                    {/* Chevron */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground flex-shrink-0">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Set manual location modal ── */}
      {showLocationSetter && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-bold mb-3">Set Your Location</h2>
            <input type="text" value={manualLocationInput} onChange={(e) => setManualLocationInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setManualLocation()}
              placeholder="e.g. Dublin, Ireland"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3" autoFocus />
            <div className="flex gap-2">
              <button onClick={setManualLocation} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90">Set Location</button>
              <button onClick={() => setShowLocationSetter(false)} className="flex-1 border border-border text-muted-foreground py-2 rounded-lg text-sm font-medium hover:text-foreground">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notifications panel ── */}
      {notifOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setNotifOpen(false)} />
          <div className="relative bg-card border-t border-border rounded-t-2xl max-h-[60vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
              <h2 className="text-base font-bold">Activity</h2>
              <button onClick={() => setNotifOpen(false)} className="w-7 h-7 rounded-full bg-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {activities.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">No activity yet.</p>
              ) : (
                activities.slice(0, 30).map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-base flex-shrink-0">
                      {a.type === "rsvped" ? "🎟" : a.type === "created_event" ? "✨" : "📸"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{getActivityLabel(a)}</p>
                      {a.createdAt && (
                        <p className="text-xs text-muted-foreground">
                          {new Date((a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <EventFilterSheet open={filterSheetOpen} filters={filters} hasUserLocation={!!userCoords} onApply={setFilters} onClose={() => setFilterSheetOpen(false)} />
      <PwaInstallBanner />
      <BottomNav />
    </div>
  );
}
