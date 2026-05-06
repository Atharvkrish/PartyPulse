import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { subscribeEvents, Event } from "@/lib/firestoreEvents";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_FILTERS,
  FilterState,
  applyFilters,
  countActiveFilters,
  haversineKm,
  CATEGORY_META,
} from "@/lib/eventFilters";
import EventFilterSheet from "@/components/EventFilterSheet";
import BottomNav from "@/components/BottomNav";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

function getMarkerColor(going: number): string {
  if (going >= 16) return "#22c55e";
  if (going >= 5) return "#f59e0b";
  return "#ef4444";
}

function createColoredIcon(color: string, category?: string) {
  const emoji = category
    ? CATEGORY_META[category as keyof typeof CATEGORY_META]?.emoji ?? "★"
    : "★";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <div style="width:28px;height:28px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;">${emoji}</div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

function UserLocationButton({ onLocated }: { onLocated: (lat: number, lng: number) => void }) {
  const map = useMap();
  function handleLocate() {
    navigator.geolocation.getCurrentPosition((pos) => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 14);
      onLocated(pos.coords.latitude, pos.coords.longitude);
    });
  }
  return (
    <button
      data-testid="button-locate-me"
      onClick={handleLocate}
      className="absolute bottom-44 right-4 z-[999] bg-card border border-border rounded-full w-10 h-10 flex items-center justify-center text-foreground shadow-md hover:bg-accent transition-colors"
      title="My location"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [, setLocation] = useLocation();
  const [panelOpen, setPanelOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeEvents(setEvents);
    return unsub;
  }, []);

  // Try to get location silently on mount (for distance sort/filter)
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  const filteredEvents = applyFilters(events, filters, userCoords?.lat, userCoords?.lng);
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

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-card border-b border-border z-10">
        <div className="flex items-center justify-between px-4 py-3 gap-3">
          <span className="text-lg font-black tracking-tight flex-shrink-0">
            Party<span className="text-primary">Pulse</span>
          </span>

          {/* Search bar */}
          <div className="flex-1 relative">
            <svg
              width="14" height="14"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              data-testid="input-search-events"
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search events…"
              className="w-full bg-background border border-border rounded-full pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {filters.search && (
              <button
                onClick={() => setFilters((f) => ({ ...f, search: "" }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter button */}
          <button
            data-testid="button-open-filters"
            onClick={() => setFilterSheetOpen(true)}
            className="relative flex-shrink-0 w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Avatar */}
          <div
            data-testid="avatar-user"
            onClick={() => setLocation("/profile")}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-sm font-bold text-primary cursor-pointer"
          >
            {(user?.displayName || user?.email || "?")[0].toUpperCase()}
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
            {filters.categories.map((cat) => {
              const meta = getCategoryMeta(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setFilters((f) => ({ ...f, categories: f.categories.filter((c) => c !== cat) }))}
                  className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1"
                >
                  {meta?.emoji} {cat}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              );
            })}
            {filters.datePreset !== "all" && (
              <button
                onClick={() => setFilters((f) => ({ ...f, datePreset: "all" }))}
                className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1"
              >
                🗓 {filters.datePreset === "custom"
                  ? `${filters.dateFrom}–${filters.dateTo}`
                  : filters.datePreset.charAt(0).toUpperCase() + filters.datePreset.slice(1)}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            {filters.maxDistanceKm !== null && (
              <button
                onClick={() => setFilters((f) => ({ ...f, maxDistanceKm: null }))}
                className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1"
              >
                📍 Within {filters.maxDistanceKm}km
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            {filters.sortBy !== "soonest" && (
              <button
                onClick={() => setFilters((f) => ({ ...f, sortBy: "soonest" }))}
                className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1"
              >
                Sort: {filters.sortBy}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            {filters.capacityOnly && (
              <button
                onClick={() => setFilters((f) => ({ ...f, capacityOnly: false }))}
                className="flex-shrink-0 flex items-center gap-1 text-xs bg-primary/10 border border-primary/30 text-primary rounded-full px-2.5 py-1"
              >
                Spots available
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              Clear all
            </button>
          </div>
        )}
      </header>

      {/* ── Map ── */}
      <div className="relative flex-1 overflow-hidden">
        <MapContainer
          center={[40.7128, -74.006]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {filteredEvents.map((event) => (
            <Marker
              key={event.id}
              position={[event.location.lat, event.location.lng]}
              icon={createColoredIcon(getMarkerColor(event.going.length), event.category)}
            >
              <Popup>
                <div className="min-w-[170px]">
                  {event.category && (
                    <p className="text-xs text-gray-400 mb-0.5">
                      {CATEGORY_META[event.category as keyof typeof CATEGORY_META]?.emoji} {event.category}
                    </p>
                  )}
                  <p className="font-bold text-sm">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.date} at {event.time}</p>
                  <p className="text-xs">{event.going.length} going</p>
                  <button
                    onClick={() => setLocation(`/events/${event.id}`)}
                    className="mt-2 w-full bg-violet-600 text-white text-xs py-1 px-2 rounded hover:bg-violet-700"
                  >
                    View Event
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
          <UserLocationButton onLocated={(lat, lng) => setUserCoords({ lat, lng })} />
        </MapContainer>

        {/* Create FAB */}
        <button
          data-testid="button-create-event-fab"
          onClick={() => setLocation("/events/new")}
          className="absolute bottom-24 right-4 z-[999] bg-primary text-primary-foreground rounded-full px-5 py-3 font-bold text-sm shadow-lg hover:opacity-90 transition-opacity"
        >
          + Create
        </button>

        {/* ── Events slide-up panel ── */}
        <div
          className="absolute bottom-0 left-0 right-0 z-[998] transition-transform duration-300"
          style={{ transform: panelOpen ? "translateY(0)" : "translateY(calc(100% - 48px))" }}
        >
          <div className="bg-card border-t border-border rounded-t-2xl shadow-2xl">
            <button
              data-testid="button-toggle-panel"
              onClick={() => setPanelOpen(!panelOpen)}
              className="w-full flex items-center justify-center py-3 gap-2 text-muted-foreground hover:text-foreground"
            >
              <span className="w-8 h-1 rounded-full bg-border block" />
              <span className="text-xs font-medium">
                {filteredEvents.length === events.length
                  ? `${events.length} Events`
                  : `${filteredEvents.length} of ${events.length} Events`}
              </span>
              {filteredEvents.length < events.length && (
                <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">filtered</span>
              )}
            </button>

            <div className="overflow-y-auto max-h-56 px-4 pb-4 space-y-2">
              {filteredEvents.length === 0 && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-muted-foreground text-sm">No events match your filters.</p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
              {filteredEvents.map((event) => {
                const catMeta = getCategoryMeta(event.category);
                const dist = formatDistance(event);
                return (
                  <div
                    key={event.id}
                    data-testid={`card-event-${event.id}`}
                    onClick={() => setLocation(`/events/${event.id}`)}
                    className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getMarkerColor(event.going.length) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {catMeta && (
                          <span className="text-xs">{catMeta.emoji}</span>
                        )}
                        <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {event.date} &bull; {event.going.length} going
                        {dist && <> &bull; {dist}</>}
                      </p>
                    </div>
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

      {/* ── Filter sheet ── */}
      <EventFilterSheet
        open={filterSheetOpen}
        filters={filters}
        hasUserLocation={!!userCoords}
        onApply={setFilters}
        onClose={() => setFilterSheetOpen(false)}
      />

      <BottomNav />
    </div>
  );
}
