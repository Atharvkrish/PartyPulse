import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useAuth } from "@/contexts/AuthContext";
import { createEvent } from "@/lib/firestoreEvents";
import { uploadEventCover } from "@/lib/storagePhotos";
import { useToast } from "@/hooks/use-toast";

import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

interface LatLng { lat: number; lng: number }

function LocationPicker({ onPick }: { onPick: (ll: LatLng) => void }) {
  useMapEvents({
    click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

export default function CreateEvent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [pickedLocation, setPickedLocation] = useState<LatLng | null>(null);
  const [address, setAddress] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handlePickLocation = useCallback(async (ll: LatLng) => {
    setPickedLocation(ll);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${ll.lat}&lon=${ll.lng}`
      );
      const data = await res.json();
      setAddress(data.display_name || `${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`);
    } catch {
      setAddress(`${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)}`);
    }
  }, []);

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickedLocation) {
      toast({ title: "Pick a location on the map", variant: "destructive" });
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const tempId = `temp_${Date.now()}`;
      let imageUrl = "";
      if (coverFile) {
        imageUrl = await uploadEventCover(tempId, coverFile, setUploadProgress);
      }
      const eventId = await createEvent({
        title,
        description,
        date,
        time,
        location: { lat: pickedLocation.lat, lng: pickedLocation.lng, address },
        imageUrl,
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : undefined,
        creatorId: user.uid,
        creatorName: user.displayName || user.email || "Anonymous",
      });
      toast({ title: "Event created!" });
      setLocation(`/events/${eventId}`);
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button
            data-testid="button-back"
            onClick={() => setLocation("/")}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            &larr; Back
          </button>
          <h1 className="text-xl font-bold">Create Event</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
            <input
              data-testid="input-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="What's the event?"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea
              data-testid="input-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Tell people what to expect..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
              <input
                data-testid="input-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Time *</label>
              <input
                data-testid="input-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Max Attendees (optional)</label>
            <input
              data-testid="input-max-attendees"
              type="number"
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              min={1}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="No limit"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Location * <span className="text-primary">— click on the map</span>
            </label>
            <div className="rounded-xl overflow-hidden border border-border" style={{ height: 220 }}>
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
                <LocationPicker onPick={handlePickLocation} />
                {pickedLocation && <Marker position={[pickedLocation.lat, pickedLocation.lng]} />}
              </MapContainer>
            </div>
            {address && (
              <p className="mt-1.5 text-xs text-muted-foreground truncate">{address}</p>
            )}
            {!pickedLocation && (
              <p className="mt-1.5 text-xs text-muted-foreground">No location selected yet</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cover Image</label>
            <input
              data-testid="input-cover-image"
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:text-sm file:font-medium hover:file:opacity-90 cursor-pointer"
            />
            {coverPreview && (
              <img
                src={coverPreview}
                alt="Cover preview"
                className="mt-2 rounded-lg w-full h-32 object-cover border border-border"
              />
            )}
            {loading && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-2 bg-border rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>

          <button
            data-testid="button-create-event"
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Event"}
          </button>
        </form>
      </div>
    </div>
  );
}
