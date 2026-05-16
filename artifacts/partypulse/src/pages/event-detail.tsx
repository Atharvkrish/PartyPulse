import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeEvent,
  setRsvp,
  deleteEvent,
  banUser,
  unbanUser,
  checkIn,
  Event,
  RsvpStatus,
} from "@/lib/firestoreEvents";
import { subscribeMessages, sendMessage, deleteMessage, ChatMessage } from "@/lib/firestoreChat";
import { subscribePhotos, uploadEventPhoto, deletePhoto, EventPhoto } from "@/lib/storagePhotos";
import { logActivity } from "@/lib/firestoreActivity";
import { CATEGORY_META } from "@/lib/eventFilters";
import { useToast } from "@/hooks/use-toast";
import {
  sendFriendRequest,
  subscribeOutgoingRequests,
  FriendRequest,
} from "@/lib/firestoreFriends";
import { subscribeUser } from "@/lib/firestoreUsers";

type Tab = "info" | "chat" | "gallery";

const rsvpConfig: { status: RsvpStatus; label: string; emoji: string; inactive: string; active: string }[] = [
  { status: "going",      label: "Going",      emoji: "✅", inactive: "border-border text-muted-foreground hover:border-green-500/50 hover:text-green-400", active: "bg-green-500/20 border-green-500 text-green-400" },
  { status: "interested", label: "Interested", emoji: "⭐", inactive: "border-border text-muted-foreground hover:border-amber-500/50 hover:text-amber-400", active: "bg-amber-500/20 border-amber-500 text-amber-400" },
  { status: "cantGo",     label: "Can't Go",   emoji: "❌", inactive: "border-border text-muted-foreground hover:border-red-500/50 hover:text-red-400",  active: "bg-red-500/20 border-red-500 text-red-400" },
];

function useCountdown(date: string, time: string) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(`${date}T${time}:00`);
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { started: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  void tick;
  return {
    started: false,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function isCheckInWindow(date: string, time: string): boolean {
  const target = new Date(`${date}T${time}:00`);
  const diff = target.getTime() - Date.now();
  return diff <= 7200000 && diff >= -3600000;
}

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
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friendsSent, setFriendsSent] = useState<Set<string>>(new Set());
  const [myFriends, setMyFriends] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!eventId) return; return subscribeEvent(eventId, setEvent); }, [eventId]);
  useEffect(() => { if (!eventId) return; return subscribeMessages(eventId, setMessages); }, [eventId]);
  useEffect(() => { if (!eventId) return; return subscribePhotos(eventId, setPhotos); }, [eventId]);
  useEffect(() => { if (tab === "chat") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, tab]);

  useEffect(() => {
    if (!user) return;
    return subscribeOutgoingRequests(user.uid, (reqs) => {
      setOutgoingRequests(reqs);
      setFriendsSent(new Set(reqs.map((r) => r.toId)));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeUser(user.uid, (u) => {
      setMyFriends(new Set(u?.friends ?? []));
    });
  }, [user]);

  const countdown = useCountdown(event?.date ?? "2099-01-01", event?.time ?? "00:00");

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isCreator = user?.uid === event.creatorId;
  const isBanned = user ? event.bannedUsers.includes(user.uid) : false;
  const isFull = event.maxAttendees != null && event.going.length >= event.maxAttendees;
  const isExternal = !!event.isExternal;
  const checkedIn = user ? (event.checkedIn ?? []).includes(user.uid) : false;
  const canCheckIn = !isExternal && user && isCheckInWindow(event.date, event.time);

  function getUserRsvp(): RsvpStatus | null {
    if (!user) return null;
    if (event!.going.includes(user.uid)) return "going";
    if (event!.interested.includes(user.uid)) return "interested";
    if (event!.cantGo.includes(user.uid)) return "cantGo";
    return null;
  }

  async function handleRsvp(status: RsvpStatus) {
    if (!user || !event || rsvpLoading || isExternal) return;
    const prev = getUserRsvp();
    const next = prev === status ? null : status;
    setRsvpLoading(true);
    try {
      await setRsvp(event.id, user.uid, next, prev);
      if (next === "going" || next === "interested") {
        logActivity({ actorId: user.uid, actorName: user.displayName || user.email || "Someone", type: "rsvped", eventId: event.id, eventTitle: event.title, detail: next === "going" ? "Going" : "Interested" }).catch(() => { });
      }
    } catch (err: unknown) {
      toast({ title: "RSVP failed", description: (err as Error)?.message || "Please try again.", variant: "destructive" });
    } finally {
      setRsvpLoading(false);
    }
  }

  async function handleCheckIn() {
    if (!user || !event || checkingIn || checkedIn) return;
    setCheckingIn(true);
    try {
      await checkIn(event.id, user.uid);
      toast({ title: "Checked in! 🎉", description: "You're officially at the party." });
    } catch {
      toast({ title: "Check-in failed", variant: "destructive" });
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}events/${event!.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: event!.title, text: event!.description || `Check out ${event!.title} on PartyPulse!`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied!", description: "Share it with your crew." });
      }
    } catch { /* user cancelled */ }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim() || !user || !event) return;
    setSendingChat(true);
    try {
      await sendMessage(event.id, chatText.trim(), user.uid, user.displayName || user.email || "Anonymous", user.photoURL || undefined);
      setChatText("");
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setSendingChat(false);
    }
  }

  async function handleAddFriendFromChat(targetId: string, targetName: string) {
    if (!user || myFriends.has(targetId) || friendsSent.has(targetId)) return;
    try {
      await sendFriendRequest(user.uid, user.displayName || user.email || "Someone", targetId, targetName);
      setFriendsSent((s) => new Set([...s, targetId]));
      toast({ title: `Friend request sent to ${targetName}` });
    } catch {
      toast({ title: "Failed to send friend request", variant: "destructive" });
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
      await uploadEventPhoto(event.id, file, user.uid, user.displayName || user.email || "Anonymous", setPhotoProgress);
      toast({ title: "Photo uploaded!" });
      logActivity({ actorId: user.uid, actorName: user.displayName || user.email || "Someone", type: "uploaded_photos", eventId: event.id, eventTitle: event.title, detail: "a photo" }).catch(() => { });
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

  async function handleBan(uid: string) { await banUser(event!.id, uid); toast({ title: "User banned from chat" }); }
  async function handleUnban(uid: string) { await unbanUser(event!.id, uid); toast({ title: "User unbanned" }); }

  const currentRsvp = getUserRsvp();
  const catMeta = event.category ? CATEGORY_META[event.category as keyof typeof CATEGORY_META] : null;

  // Format date nicely
  const eventDate = new Date(`${event.date}T${event.time}:00`);
  const formattedDate = eventDate.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Cover image / header area */}
      {event.imageUrl && (
        <div className="relative h-52 flex-shrink-0">
          <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
          <button data-testid="button-back" onClick={() => setLocation("/")}
            className="absolute top-4 left-4 bg-background/60 backdrop-blur-sm border border-border rounded-full px-3 py-1 text-sm text-foreground">&larr; Back</button>
          <button data-testid="button-share" onClick={handleShare}
            className="absolute top-4 right-4 bg-background/60 backdrop-blur-sm border border-border rounded-full px-3 py-1 text-sm text-foreground flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
            Share
          </button>
        </div>
      )}

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pb-8">
        {!event.imageUrl && (
          <div className="pt-4 mb-2 flex items-center justify-between">
            <button data-testid="button-back" onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground text-sm">&larr; Back</button>
            <button data-testid="button-share" onClick={handleShare}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
              Share
            </button>
          </div>
        )}

        {/* Event info */}
        <div className="mt-4 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {catMeta && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5">
                {catMeta.emoji} {event.category}
              </span>
            )}
            {isExternal && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2.5 py-0.5">
                🎫 Ticketmaster
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-foreground">{event.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{formattedDate} at {event.time} &bull; {event.creatorName}</p>
          {event.maxAttendees && !isExternal && (
            <p className="text-xs text-muted-foreground mt-0.5">{event.going.length}/{event.maxAttendees} spots filled</p>
          )}
        </div>

        {/* ── Countdown timer ── */}
        {!countdown.started && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-2 text-center">Event starts in</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { n: countdown.days, label: "days" },
                { n: countdown.hours, label: "hrs" },
                { n: countdown.minutes, label: "min" },
                { n: countdown.seconds, label: "sec" },
              ].map(({ n, label }) => (
                <div key={label} className="bg-background border border-border rounded-lg p-2">
                  <p className="text-xl font-black text-primary tabular-nums">{String(n).padStart(2, "0")}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {countdown.started && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl px-4 py-3 text-sm text-center font-semibold mb-4">
            🎉 This event has started!
          </div>
        )}

        {/* ── Check-in ── */}
        {canCheckIn && !isExternal && (
          <div className="mb-4">
            {checkedIn ? (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl px-4 py-3 text-sm text-center font-semibold">
                ✓ You're checked in
              </div>
            ) : (
              <button onClick={handleCheckIn} disabled={checkingIn}
                className="w-full bg-green-500/20 border-2 border-green-500 text-green-400 font-bold py-3 rounded-xl hover:bg-green-500/30 disabled:opacity-50 transition-all">
                {checkingIn ? "Checking in…" : "📍 Check In Now"}
              </button>
            )}
          </div>
        )}

        {/* ── External: Get Tickets ── */}
        {isExternal && event.externalUrl && (
          <a href={event.externalUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-colors mb-4">
            🎫 Get Tickets on Ticketmaster
          </a>
        )}

        {/* ── RSVP buttons (only for non-external events) ── */}
        {!isExternal && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {rsvpConfig.map(({ status, label, emoji, inactive, active }) => {
              const isActive = currentRsvp === status;
              const disabled = (status === "going" && isFull && !isActive) || rsvpLoading || !user;
              return (
                <button key={status} data-testid={`button-rsvp-${status}`} onClick={() => handleRsvp(status)} disabled={disabled}
                  className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border-2 font-bold text-sm transition-all ${isActive ? active : inactive} disabled:opacity-40 disabled:cursor-not-allowed`}>
                  <span className="text-xl">{emoji}</span>
                  <span>{label}{status === "going" && isFull && !isActive ? " (Full)" : ""}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Tabs (hide chat for external events) ── */}
        <div className="flex border border-border rounded-lg overflow-hidden mb-5">
          {(isExternal ? (["info", "gallery"] as Tab[]) : (["info", "chat", "gallery"] as Tab[])).map((t) => (
            <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
              {t === "chat" && messages.length > 0 && <span className="ml-1 text-xs opacity-60">{messages.length}</span>}
              {t === "gallery" && photos.length > 0 && <span className="ml-1 text-xs opacity-60">{photos.length}</span>}
            </button>
          ))}
        </div>

        {/* ── Info tab ── */}
        {tab === "info" && (
          <div className="space-y-4">
            {event.description && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-foreground leading-relaxed">{event.description}</p>
              </div>
            )}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">📍 Location</p>
              <p className="text-sm text-foreground">{event.location.address}</p>
            </div>
            {!isExternal && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-400">{event.going.length}</p>
                  <p className="text-xs text-muted-foreground">Going</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-amber-400">{event.interested.length}</p>
                  <p className="text-xs text-muted-foreground">Interested</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-red-400">{event.cantGo.length}</p>
                  <p className="text-xs text-muted-foreground">Can't Go</p>
                </div>
              </div>
            )}
            {(event.checkedIn?.length ?? 0) > 0 && (
              <div className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Checked in</span>
                <span className="text-sm font-bold text-green-400">{event.checkedIn!.length} people</span>
              </div>
            )}
            {isCreator && !isExternal && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Controls</p>
                <div className="grid grid-cols-2 gap-2">
                  <button data-testid="button-edit-event" onClick={() => setLocation(`/events/${event.id}/edit`)}
                    className="py-2 text-sm font-medium text-primary border border-primary/50 rounded-lg hover:bg-primary/10 transition-colors">Edit Event</button>
                  <button data-testid="button-delete-event" onClick={handleDeleteEvent}
                    className="py-2 text-sm font-medium text-destructive border border-destructive/50 rounded-lg hover:bg-destructive/10 transition-colors">Delete Event</button>
                </div>
                {event.going.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Attendees ({event.going.length})</p>
                    <div className="space-y-2">
                      {event.going.map((uid) => (
                        <div key={uid} className="flex items-center justify-between">
                          <span className="text-xs text-foreground font-mono">{uid.slice(0, 12)}…</span>
                          {event.bannedUsers.includes(uid) ? (
                            <button data-testid={`button-unban-${uid}`} onClick={() => handleUnban(uid)} className="text-xs text-primary hover:underline">Unban</button>
                          ) : (
                            <button data-testid={`button-ban-${uid}`} onClick={() => handleBan(uid)} className="text-xs text-destructive hover:underline">Ban</button>
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

        {/* ── Chat tab ── */}
        {tab === "chat" && !isExternal && (
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
                const isOtherUser = !isOwn && msg.userId !== event.creatorId;
                const alreadyFriend = myFriends.has(msg.userId);
                const requestSent = friendsSent.has(msg.userId);
                return (
                  <div key={msg.id} data-testid={`message-${msg.id}`} className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                    <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {(msg.userName || "?")[0].toUpperCase()}
                    </div>
                    <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                      <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                        <p className="text-xs text-muted-foreground">{msg.userName}</p>
                        {isOtherUser && user && (
                          alreadyFriend ? (
                            <span className="text-[9px] text-green-400 font-medium">Friends</span>
                          ) : requestSent ? (
                            <span className="text-[9px] text-muted-foreground">Sent</span>
                          ) : (
                            <button
                              onClick={() => handleAddFriendFromChat(msg.userId, msg.userName)}
                              title={`Add ${msg.userName} as friend`}
                              className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/40 transition-colors"
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                            </button>
                          )
                        )}
                      </div>
                      <div className={`px-3 py-2 rounded-xl text-sm ${isOwn ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
                        {msg.text}
                      </div>
                      {canDelete && (
                        <button data-testid={`button-delete-message-${msg.id}`} onClick={() => handleDeleteMessage(msg.id)} className="text-xs text-muted-foreground hover:text-destructive mt-0.5">delete</button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {!isBanned && (
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input data-testid="input-chat-message" type="text" value={chatText} onChange={(e) => setChatText(e.target.value)}
                  placeholder="Say something…"
                  className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                <button data-testid="button-send-message" type="submit" disabled={sendingChat || !chatText.trim()}
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">Send</button>
              </form>
            )}
          </div>
        )}

        {/* ── Gallery tab ── */}
        {tab === "gallery" && (
          <div>
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer w-full justify-center bg-card border border-dashed border-border rounded-xl py-4 hover:border-primary transition-colors">
                <input data-testid="input-photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} className="hidden" />
                <span className="text-sm text-muted-foreground">{uploadingPhoto ? `Uploading ${photoProgress}%…` : "Upload a photo"}</span>
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
                      <img data-testid={`photo-${photo.id}`} src={photo.url} alt="Event photo" className="w-full h-full object-cover" />
                      {canDelete && (
                        <button data-testid={`button-delete-photo-${photo.id}`}
                          onClick={() => { if (confirm("Delete this photo?")) deletePhoto(event.id, photo.id, photo.storagePath); }}
                          className="absolute top-1 right-1 bg-background/80 backdrop-blur-sm border border-border text-destructive rounded-full w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive hover:text-white" title="Delete photo">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
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
