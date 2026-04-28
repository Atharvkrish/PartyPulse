import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { subscribeEvents, Event } from "@/lib/firestoreEvents";
import { useAuth } from "@/contexts/AuthContext";

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

function createColoredIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -12],
  });
}

function UserLocationButton() {
  const map = useMap();
  function handleLocate() {
    navigator.geolocation.getCurrentPosition((pos) => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 14);
    });
  }
  return (
    <button
      data-testid="button-locate-me"
      onClick={handleLocate}
      className="absolute bottom-28 right-4 z-[999] bg-card border border-border rounded-full w-10 h-10 flex items-center justify-center text-foreground shadow-md hover:bg-accent transition-colors"
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

  useEffect(() => {
    const unsub = subscribeEvents(setEvents);
    return unsub;
  }, []);

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date + "T" + a.time).getTime() - new Date(b.date + "T" + b.time).getTime()
  );

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card z-10 flex-shrink-0">
        <span className="text-xl font-black tracking-tight">
          Party<span className="text-primary">Pulse</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            data-testid="button-profile"
            onClick={() => setLocation("/profile")}
            className="w-8 h-8 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-sm font-bold text-primary"
          >
            {(user?.displayName || user?.email || "?")[0].toUpperCase()}
          </button>
        </div>
      </header>

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
          {events.map((event) => (
            <Marker
              key={event.id}
              position={[event.location.lat, event.location.lng]}
              icon={createColoredIcon(getMarkerColor(event.going.length))}
            >
              <Popup>
                <div className="min-w-[160px]">
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
          <UserLocationButton />
        </MapContainer>

        <button
          data-testid="button-create-event-fab"
          onClick={() => setLocation("/events/new")}
          className="absolute bottom-4 right-4 z-[999] bg-primary text-primary-foreground rounded-full px-5 py-3 font-bold text-sm shadow-lg hover:opacity-90 transition-opacity"
        >
          + Create Event
        </button>

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
              <span className="text-xs font-medium">{events.length} Events Nearby</span>
            </button>
            <div className="overflow-y-auto max-h-64 px-4 pb-4 space-y-2">
              {sortedEvents.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-6">No events yet. Create one!</p>
              )}
              {sortedEvents.map((event) => (
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
                    <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date} &bull; {event.going.length} going</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground flex-shrink-0">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
