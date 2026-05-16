import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "@/contexts/AuthContext";
import { createEvent } from "@/lib/firestoreEvents";
import { uploadEventCover } from "@/lib/storagePhotos";
import { logActivity } from "@/lib/firestoreActivity";
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

const inputCls =
    "w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary";

export default function CreateEvent() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();

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
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!pickedLocation) { toast({ title: "Please set a location", variant: "destructive" }); return; }
        if (!user) return;
        setLoading(true);
        try {
            const tempId = `temp_${Date.now()}`;
            let imageUrl = "";
            if (coverFile) imageUrl = await uploadEventCover(tempId, coverFile, setUploadProgress);
            const eventId = await createEvent({
                title, description, date, time,
                category: category || undefined,
                location: { lat: pickedLocation.lat, lng: pickedLocation.lng, address },
                imageUrl, maxAttendees: maxAttendees ? parseInt(maxAttendees) : undefined,
                creatorId: user.uid, creatorName: user.displayName || user.email || "Anonymous",
            });
            logActivity({ actorId: user.uid, actorName: user.displayName || user.email || "Someone", type: "created_event", eventId, eventTitle: title }).catch(() => { });
            toast({ title: "Event created! 🎉" });
            setLocation(`/events/${eventId}`);
        } catch (err: unknown) {
            toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
        } finally { setLoading(false); }
    }

    return (
        <div className="min-h-screen bg-background text-foreground pb-8">
            <div className="max-w-2xl mx-auto px-4">
                <div className="flex items-center gap-3 mb-6 pt-6">
                    <button data-testid="button-back" onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground text-sm">&larr; Back</button>
                    <h1 className="text-xl font-bold">Create Event</h1>
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

                    {/* Category */}
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
                        <input data-testid="input-max-attendees" type="number" value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} min={1} className={inputCls} placeholder="No limit" />
                    </div>

                    {/* Location */}
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Location * <span className="text-primary">— search or click the map</span>
                        </label>
                        <div className="relative mb-2">
                            <input
                                type="text"
                                value={locationSearchInput}
                                onChange={(e) => handleLocationInput(e.target.value)}
                                placeholder="Search for an address or place…"
                                className={inputCls}
                                autoComplete="off"
                            />
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
                            <MapContainer center={[53.3498, -6.2603]} zoom={13} style={{ height: "100%", width: "100%" }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <FlyToLocation target={flyTarget} />
                                <LocationPicker onPick={handlePickLocation} />
                                {pickedLocation && <Marker position={[pickedLocation.lat, pickedLocation.lng]} />}
                            </MapContainer>
                        </div>
                        {address
                            ? <p className="mt-1.5 text-xs text-muted-foreground truncate">📍 {address}</p>
                            : <p className="mt-1.5 text-xs text-muted-foreground">No location selected — search above or click the map</p>
                        }
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Cover Image</label>
                        <input data-testid="input-cover-image" type="file" accept="image/*" onChange={handleCoverChange}
                            className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:text-sm file:font-medium hover:file:opacity-90 cursor-pointer" />
                        {coverPreview && <img src={coverPreview} alt="Cover preview" className="mt-2 rounded-lg w-full h-32 object-cover border border-border" />}
                        {loading && uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="mt-2 bg-border rounded-full h-1.5">
                                <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        )}
                    </div>

                    <button data-testid="button-create-event" type="submit" disabled={loading}
                        className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                        {loading ? "Creating…" : "Create Event"}
                    </button>
                </form>
            </div>
        </div>
    );
}
