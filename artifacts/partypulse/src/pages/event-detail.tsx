import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeEvent,
  setRsvp,
  deleteEvent,
  banUser,
  unbanUser,
  Event,
  RsvpStatus,
} from "@/lib/firestoreEvents";
import { subscribeMessages, sendMessage, deleteMessage, ChatMessage } from "@/lib/firestoreChat";
import { subscribePhotos, uploadEventPhoto, deletePhoto, EventPhoto } from "@/lib/storagePhotos";
import { logActivity } from "@/lib/firestoreActivity";
import { useToast } from "@/hooks/use-toast";

type Tab = "info" | "chat" | "gallery";

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [event, setEvent] = useState<Event | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [tab, setTab] = useState<Tab>("info");
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!eventId) return;
    const unsub = subscribeEvent(eventId, setEvent);
    return unsub;
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const unsub = subscribeMessages(eventId, setMessages);
    return unsub;
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const unsub = subscribePhotos(eventId, setPhotos);
    return unsub;
  }, [eventId]);

  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, tab]);

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const isCreator = user?.uid === event.creatorId;
  const isBanned = user ? event.bannedUsers.includes(user.uid) : false;
  const isFull = event.maxAttendees != null && event.going.length >= event.maxAttendees;

  function getUserRsvp(): RsvpStatus | null {
    if (!user) return null;
    if (event!.going.includes(user.uid)) return "going";
    if (event!.interested.includes(user.uid)) return "interested";
    if (event!.cantGo.includes(user.uid)) return "cantGo";
    return null;
  }

  async function handleRsvp(status: RsvpStatus) {
    if (!user || !event) return;
    const prev = getUserRsvp();
    const next = prev === status ? null : status;
    await setRsvp(event.id, user.uid, next, prev);
    if (next === "going" || next === "interested") {
      logActivity({
        actorId: user.uid,
        actorName: user.displayName || user.email || "Someone",
        type: "rsvped",
        eventId: event.id,
        eventTitle: event.title,
        detail: next === "going" ? "Going" : "Interested",
      }).catch(() => {});
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim() || !user || !event) return;
    setSendingChat(true);
    try {
      await sendMessage(
        event.id,
        chatText.trim(),
        user.uid,
        user.displayName || user.email || "Anonymous",
        user.photoURL || undefined
      );
      setChatText("");
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingChat(false);
    }
  }

  async function handleDeleteMessage(msgId: string) {
    if (!event) return;
    await deleteMessage(event.id, msgId);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !event) return;
    setUploadingPhoto(true);
    try {
      await uploadEventPhoto(
        event.id,
        file,
        user.uid,
        user.displayName || user.email || "Anonymous",
        setPhotoProgress
      );
      toast({ title: "Photo uploaded!" });
      logActivity({
        actorId: user.uid,
        actorName: user.displayName || user.email || "Someone",
        type: "uploaded_photos",
        eventId: event.id,
        eventTitle: event.title,
        detail: "a photo",
      }).catch(() => {});
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      setPhotoProgress(0);
    }
  }

  async function handleDeleteEvent() {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    await deleteEvent(event!.id);
    setLocation("/");
  }

  async function handleBan(uid: string) {
    await banUser(event!.id, uid);
    toast({ title: "User banned from chat" });
  }

  async function handleUnban(uid: string) {
    await unbanUser(event!.id, uid);
    toast({ title: "User unbanned" });
  }

  const currentRsvp = getUserRsvp();

  const rsvpConfig: { status: RsvpStatus; label: string; color: string; activeColor: string }[] = [
    { status: "going", label: "Going", color: "border-border text-muted-foreground", activeColor: "bg-green-500/20 border-green-500 text-green-400" },
    { status: "interested", label: "Interested", color: "border-border text-muted-foreground", activeColor: "bg-amber-500/20 border-amber-500 text-amber-400" },
    { status: "cantGo", label: "Can't Go", color: "border-border text-muted-foreground", activeColor: "bg-red-500/20 border-red-500 text-red-400" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {event.imageUrl && (
        <div className="relative h-48 flex-shrink-0">
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
          <button
            data-testid="button-back"
            onClick={() => setLocation("/")}
            className="absolute top-4 left-4 bg-background/60 backdrop-blur-sm border border-border rounded-full px-3 py-1 text-sm text-foreground"
          >
            &larr; Back
          </button>
        </div>
      )}

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pb-8">
        {!event.imageUrl && (
          <div className="pt-4 mb-2">
            <button
              data-testid="button-back"
              onClick={() => setLocation("/")}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              &larr; Back
            </button>
          </div>
        )}

        <div className="mt-4 mb-4">
          <h1 className="text-2xl font-black text-foreground">{event.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {event.date} at {event.time} &bull; by {event.creatorName}
          </p>
          {event.maxAttendees && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {event.going.length}/{event.maxAttendees} spots filled
            </p>
          )}
        </div>

        <div className="flex gap-2 mb-5">
          {rsvpConfig.map(({ status, label, color, activeColor }) => (
            <button
              key={status}
              data-testid={`button-rsvp-${status}`}
              onClick={() => handleRsvp(status)}
              disabled={status === "going" && isFull && currentRsvp !== "going"}
              className={`flex-1 py-2 text-xs font-semibold border rounded-lg transition-all ${
                currentRsvp === status ? activeColor : color
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {label}
              {status === "going" && isFull && currentRsvp !== "going" && " (Full)"}
            </button>
          ))}
        </div>

        <div className="flex border border-border rounded-lg overflow-hidden mb-5">
          {(["info", "chat", "gallery"] as Tab[]).map((t) => (
            <button
              key={t}
              data-testid={`tab-${t}`}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              {t === "chat" && messages.length > 0 && (
                <span className="ml-1 text-xs opacity-60">{messages.length}</span>
              )}
              {t === "gallery" && photos.length > 0 && (
                <span className="ml-1 text-xs opacity-60">{photos.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="space-y-4">
            {event.description && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-foreground leading-relaxed">{event.description}</p>
              </div>
            )}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Location</p>
              <p className="text-sm text-foreground">{event.location.address}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-green-400">{event.going.length}</p>
                <p className="text-xs text-muted-foreground">Going</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-amber-400">{event.interested.length}</p>
                <p className="text-xs text-muted-foreground">Interested</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-400">{event.cantGo.length}</p>
                <p className="text-xs text-muted-foreground">Can't Go</p>
              </div>
            </div>

            {isCreator && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Controls</p>
                <button
                  data-testid="button-delete-event"
                  onClick={handleDeleteEvent}
                  className="w-full py-2 text-sm font-medium text-destructive border border-destructive/50 rounded-lg hover:bg-destructive/10 transition-colors"
                >
                  Delete Event
                </button>
                {event.going.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Attendees</p>
                    <div className="space-y-2">
                      {event.going.map((uid) => (
                        <div key={uid} className="flex items-center justify-between">
                          <span className="text-xs text-foreground font-mono">{uid.slice(0, 12)}...</span>
                          {event.bannedUsers.includes(uid) ? (
                            <button
                              data-testid={`button-unban-${uid}`}
                              onClick={() => handleUnban(uid)}
                              className="text-xs text-primary hover:underline"
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              data-testid={`button-ban-${uid}`}
                              onClick={() => handleBan(uid)}
                              className="text-xs text-destructive hover:underline"
                            >
                              Ban
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "chat" && (
          <div className="flex flex-col">
            {isBanned && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-3 text-sm text-destructive text-center">
                You have been banned from this chat.
              </div>
            )}
            <div className="space-y-3 min-h-48 max-h-96 overflow-y-auto mb-4 pr-1">
              {messages.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No messages yet. Start the conversation!</p>
              )}
              {messages.map((msg) => {
                const isOwn = msg.userId === user?.uid;
                const canDelete = isOwn || isCreator;
                return (
                  <div
                    key={msg.id}
                    data-testid={`message-${msg.id}`}
                    className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {(msg.userName || "?")[0].toUpperCase()}
                    </div>
                    <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                      <p className={`text-xs text-muted-foreground mb-0.5 ${isOwn ? "text-right" : ""}`}>
                        {msg.userName}
                      </p>
                      <div className={`px-3 py-2 rounded-xl text-sm ${isOwn ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
                        {msg.text}
                      </div>
                      {canDelete && (
                        <button
                          data-testid={`button-delete-message-${msg.id}`}
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="text-xs text-muted-foreground hover:text-destructive mt-0.5"
                        >
                          delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {!isBanned && (
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  data-testid="input-chat-message"
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Say something..."
                  className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  data-testid="button-send-message"
                  type="submit"
                  disabled={sendingChat || !chatText.trim()}
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            )}
          </div>
        )}

        {tab === "gallery" && (
          <div>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer w-full justify-center bg-card border border-dashed border-border rounded-xl py-4 hover:border-primary transition-colors">
                <input
                  data-testid="input-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
                <span className="text-sm text-muted-foreground">
                  {uploadingPhoto ? `Uploading ${photoProgress}%...` : "Upload a photo"}
                </span>
              </label>
              {uploadingPhoto && (
                <div className="mt-2 bg-border rounded-full h-1">
                  <div className="bg-primary h-1 rounded-full transition-all" style={{ width: `${photoProgress}%` }} />
                </div>
              )}
            </div>
            {photos.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No photos yet. Be the first!</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((photo) => {
                  const canDelete = photo.uploaderId === user?.uid || isCreator;
                  return (
                    <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-square">
                      <img
                        data-testid={`photo-${photo.id}`}
                        src={photo.url}
                        alt="Event photo"
                        className="w-full h-full object-cover"
                      />
                      {canDelete && (
                        <button
                          data-testid={`button-delete-photo-${photo.id}`}
                          onClick={() => deletePhoto(event.id, photo.id, photo.storagePath)}
                          className="absolute top-1 right-1 bg-background/70 backdrop-blur-sm text-destructive rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          x
                        </button>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs truncate">{photo.uploaderName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
