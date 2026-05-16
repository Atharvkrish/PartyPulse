import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "@/contexts/AuthContext";
import { getEvent, updateEvent, Event } from "@/lib/firestoreEvents";
import { CATEGORIES, CATEGORY_META } from "@/lib/eventFilters";
import { useToast } from "@/hooks/use-toast";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

interface LatLng { lat: number; lng: number }
interface NominatimResult { display_name: string; lat: string; lon: string }

function LocationPicker({ onPick }: { onPick: (ll: LatLng) => void }) {
    useMapEvents({ click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
    return null;
}

function FlyToLocation({ target }: { target: LatLng | null }) {
    const map = useMap();
    const prevRef = useRef<string>("");
    if (target) {
        const key = `${target.lat},${target.lng}`;
        if (key !== prevRef.current) {
            prevRef.current = key;
            map.flyTo([target.lat, target.lng], 15, { animate: true, duration: 0.6 });
        }
    }
    return null;
}

export default function EditEvent() {
    const { id: eventId } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const [original, setOriginal] = useState<Event | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [maxAttendees, setMaxAttendees] = useState("");
    const [category, setCategory] = useState("");
    const [pickedLocation, setPickedLocation] = useState<LatLng | null>(null);
    const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
    const [address, setAddress] = useState("");
    const [locationSearchInput, setLocationSearchInput] = useState("");
    const [locationResults, setLocationResults] = useState<NominatimResult[]>([]);
    const [searchingLocation, setSearchingLocation] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!eventId) return;
        getEvent(eventId).then((ev) => {
            if (!ev) { setLocation("/"); return; }
            if (ev.creatorId !== user?.uid) { setLocation(`/events/${eventId}`); return; }
            setOriginal(ev);
            setTitle(ev.title);
            setDescription(ev.description ?? "");
            setDate(ev.date);
            setTime(ev.time);
            setMaxAttendees(ev.maxAttendees?.toString() ?? "");
            setCategory(ev.category ?? "");
            const ll = { lat: ev.location.lat, lng: ev.location.lng };
            setPickedLocation(ll);
            setFlyTarget(ll);
            setAddress(ev.location.address);
            setLocationSearchInput(ev.location.address);
            setFetching(false);
        });
    }, [eventId, user]);

    const handlePickLocation = useCallback(async (ll: LatLng) => {
        setPickedLocation(ll);
        setFlyTarget(ll);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${ll.lat}&lon=${ll.lng}`, { headers: { "Accept-Language": "en" } });
            const data = await res.json();
            const name = data.display_name || `${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`;
            setAddress(name);
            setLocationSearchInput(name);
        } catch {
            setAddress(`${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`);
        }
    }, []);

    function handleLocationInput(val: string) {
        setLocationSearchInput(val);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (!val.trim()) { setLocationResults([]); return; }
        searchTimeout.current = setTimeout(async () => {
            setSearchingLocation(true);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`, { headers: { "Accept-Language": "en" } });
                setLocationResults(await res.json());
            } catch { setLocationResults([]); }
            finally { setSearchingLocation(false); }
        }, 400);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!pickedLocation || !eventId) return;
        setLoading(true);
        try {
            await updateEvent(eventId, {
                title, description, date, time,
                category: category || undefined,
                location: { lat: pickedLocation.lat, lng: pickedLocation.lng, address },
                maxAttendees: maxAttendees ? parseInt(maxAttendees) : undefined,
            });
            toast({ title: "Event updated!" });
            setLocation(`/events/${eventId}`);
        } catch (err: unknown) {
            toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
        } finally { setLoading(false); }
    }

    if (fetching) {
        return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    }

    void original;
    const mapCenter = pickedLocation ?? { lat: 53.3498, lng: -6.2603 };
    const inputCls = "w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary";

    return (
        <div className="min-h-screen bg-background text-foreground pb-8">
            <div className="max-w-2xl mx-auto px-4">
                <div className="flex items-center gap-3 pt-6 mb-6">
                    <button data-testid="button-back" onClick={() => setLocation(`/events/${eventId}`)} className="text-muted-foreground hover:text-foreground text-sm">&larr; Back</button>
                    <h1 className="text-xl font-bold">Edit Event</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
                        <input data-testid="input-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} placeholder="What's the event?" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                        <textarea data-testid="input-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Tell people what to expect..." />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-2">Category</label>
                        <div className="grid grid-cols-5 gap-2">
                            {CATEGORIES.map((cat) => {
                                const meta = CATEGORY_META[cat];
                                const active = category === cat;
                                return (
                                    <button key={cat} type="button" data-testid={`cat-${cat}`} onClick={() => setCategory(active ? "" : cat)}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all ${active ? meta.active : "border-border text-muted-foreground hover:border-primary/40"}`}>
                                        <span className="text-base">{meta.emoji}</span>
                                        <span className="leading-tight text-center text-[10px]">{cat}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                            <input data-testid="input-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Time *</label>
                            <input data-testid="input-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputCls} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Max Attendees (optional)</label>
                        <input data-testid="input-max-attendees" type="number" value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} min={1} className={inputCls} placeholder="Leave blank for unlimited" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Location — search or click the map</label>
                        <div className="relative mb-2">
                            <input type="text" value={locationSearchInput} onChange={(e) => handleLocationInput(e.target.value)} placeholder="Search for an address or place…" className={inputCls} autoComplete="off" />
                            {searchingLocation && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                            {locationResults.length > 0 && (
                                <div className="absolute left-0 right-0 top-full bg-card border border-border rounded-lg shadow-lg z-[1000] mt-1 overflow-hidden">
                                    {locationResults.map((r, i) => (
                                        <button key={i} type="button"
                                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent border-b border-border last:border-0"
                                            onClick={() => {
                                                const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
                                                setPickedLocation({ lat, lng });
                                                setFlyTarget({ lat, lng });
                                                setAddress(r.display_name);
                                                setLocationSearchInput(r.display_name);
                                                setLocationResults([]);
                                            }}>
                                            📍 <span className="text-xs">{r.display_name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl overflow-hidden border border-border" style={{ height: 240 }}>
                            <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={14} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <FlyToLocation target={flyTarget} />
                                <LocationPicker onPick={handlePickLocation} />
                                {pickedLocation && <Marker position={[pickedLocation.lat, pickedLocation.lng]} />}
                            </MapContainer>
                        </div>
                        {address && <p className="mt-1.5 text-xs text-muted-foreground truncate">📍 {address}</p>}
                    </div>

                    <button data-testid="button-submit" type="submit" disabled={loading || !title || !date || !time || !pickedLocation}
                        className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all">
                        {loading ? "Saving…" : "Save Changes"}
                    </button>
                </form>
            </div>
        </div>
    );
}
