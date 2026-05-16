import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { logout } from "@/lib/firebaseAuth";
import { subscribeEvents, Event, deleteEvent } from "@/lib/firestoreEvents";
import { subscribeUser, searchUsers, getAppUser, AppUser, updateUserPhoto } from "@/lib/firestoreUsers";
import { uploadProfilePhoto } from "@/lib/storagePhotos";
import {
  subscribeIncomingRequests, subscribeOutgoingRequests, sendFriendRequest, acceptFriendRequest, declineRequest, unfriend, FriendRequest,
} from "@/lib/firestoreFriends";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import BottomNav from "@/components/BottomNav";

type ProfileTab = "events" | "going" | "friends";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [tab, setTab] = useState<ProfileTab>("events");
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [currentUserData, setCurrentUserData] = useState<AppUser | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!user) return; return subscribeEvents(setAllEvents); }, [user]);
  useEffect(() => { if (!user) return; return subscribeUser(user.uid, setCurrentUserData); }, [user]);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeIncomingRequests(user.uid, setIncomingRequests);
    const u2 = subscribeOutgoingRequests(user.uid, setOutgoingRequests);
    return () => { u1(); u2(); };
  }, [user]);

  useEffect(() => {
    const friends = currentUserData?.friends ?? [];
    if (friends.length === 0) { setFriendProfiles([]); return; }
    Promise.all(friends.map((uid) => getAppUser(uid))).then((profiles) => setFriendProfiles(profiles.filter(Boolean) as AppUser[]));
  }, [currentUserData?.friends]);

  const myEvents = allEvents.filter((e) => e.creatorId === user?.uid && !e.isExternal);
  const goingEvents = allEvents.filter((e) => user && e.going.includes(user.uid));

  // Live debounced search
  function handleSearchInput(val: string) {
    setSearchQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      if (!user || !val.trim()) return;
      setSearching(true);
      try {
        const results = await searchUsers(val, user.uid);
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  async function handleProfilePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(user.uid, file);
      await updateUserPhoto(user.uid, url);
      toast({ title: "Profile photo updated!" });
    } catch {
      toast({ title: "Photo upload failed", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSendRequest(target: AppUser) {
    if (!user) return;
    setActionLoading(target.uid);
    try {
      await sendFriendRequest(user.uid, user.displayName || user.email || "Someone", target.uid, target.displayName);
      toast({ title: `Request sent to ${target.displayName}` });
      setSearchResults((prev) => prev.filter((u) => u.uid !== target.uid));
    } catch {
      toast({ title: "Error sending request", variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function handleAccept(req: FriendRequest) {
    if (!user) return;
    setActionLoading(req.id);
    try {
      await acceptFriendRequest(req.id, req.fromId, user.uid);
      toast({ title: `You and ${req.fromName} are now friends! 🎉` });
    } catch {
      toast({ title: "Error accepting request", variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function handleDecline(req: FriendRequest) {
    setActionLoading(req.id);
    try { await declineRequest(req.id); }
    finally { setActionLoading(null); }
  }

  async function handleUnfriend(friendId: string, name: string) {
    if (!user || !confirm(`Unfriend ${name}?`)) return;
    setActionLoading(friendId);
    try { await unfriend(user.uid, friendId); toast({ title: "Unfriended" }); }
    finally { setActionLoading(null); }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Delete this event?")) return;
    try { await deleteEvent(eventId); toast({ title: "Event deleted" }); }
    catch { toast({ title: "Error deleting event", variant: "destructive" }); }
  }

  async function handleLogout() { await logout(); setLocation("/login"); }

  const pendingCount = incomingRequests.length;
  const outgoingIds = new Set(outgoingRequests.map((r) => r.toId));
  const friendIds = new Set(currentUserData?.friends ?? []);

  const photoURL = currentUserData?.photoURL;
  const initials = (user?.displayName || user?.email || "?")[0].toUpperCase();

  const tabConfig: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "events", label: "My Events", count: myEvents.length },
    { id: "going", label: "Going To", count: goingEvents.length },
    { id: "friends", label: "Friends" },
  ];

  function EventCard({ event, showDelete }: { event: Event; showDelete?: boolean }) {
    return (
      <div data-testid={`card-event-${event.id}`} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLocation(`/events/${event.id}`)}>
          <p className="font-medium text-foreground truncate">{event.title}</p>
          <p className="text-xs text-muted-foreground">{event.date} &bull; {event.going.length} going</p>
        </div>
        {showDelete && (
          <button data-testid={`button-delete-event-${event.id}`} onClick={() => handleDeleteEvent(event.id)} className="ml-3 text-xs text-destructive hover:opacity-80">Delete</button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between pt-6 mb-4">
          <h1 className="text-lg font-bold">Profile</h1>
          <div className="flex items-center gap-3">
            {/* Dark/Light toggle */}
            <button onClick={toggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 transition-colors">
              {theme === "dark" ? (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>Light</> 
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>Dark</>
              )}
            </button>
            <button data-testid="button-logout" onClick={handleLogout} className="text-sm text-destructive hover:opacity-80">Sign Out</button>
          </div>
        </div>

        {/* Avatar card */}
        <div className="bg-card border border-border rounded-xl p-5 mb-5">
          <div className="flex items-center gap-4">
            {/* Tappable avatar */}
            <div className="relative flex-shrink-0">
              <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}
                className="w-16 h-16 rounded-full overflow-hidden bg-primary/20 border-2 border-primary flex items-center justify-center text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
                {photoURL
                  ? <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                  : initials
                }
              </button>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange} />
            </div>
            <div className="flex-1 min-w-0">
              <p data-testid="text-display-name" className="font-semibold text-foreground text-lg">{user?.displayName || "Anonymous"}</p>
              <p data-testid="text-email" className="text-muted-foreground text-sm truncate">{user?.email || user?.phoneNumber || ""}</p>
              <p className="text-xs text-muted-foreground">
                {currentUserData?.friends?.length ?? 0} friends &bull; {myEvents.length} events created
              </p>
              {uploadingPhoto && <p className="text-xs text-primary mt-1 animate-pulse">Uploading photo…</p>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border border-border rounded-lg overflow-hidden mb-5">
          {tabConfig.map(({ id, label, count }) => (
            <button key={id} data-testid={`tab-${id}`} onClick={() => setTab(id)}
              className={`relative flex-1 py-2 text-xs font-medium transition-colors ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
              {count !== undefined && <span className="ml-1 opacity-70">({count})</span>}
              {id === "friends" && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── My Events ── */}
        {tab === "events" && (
          <div className="space-y-3">
            {myEvents.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
                No events yet. <button onClick={() => setLocation("/events/new")} className="text-primary hover:underline">Create one</button>
              </div>
            ) : myEvents.map((event) => <EventCard key={event.id} event={event} showDelete />)}
          </div>
        )}

        {/* ── Going To ── */}
        {tab === "going" && (
          <div className="space-y-3">
            {goingEvents.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
                You haven't RSVPed "Going" yet. <button onClick={() => setLocation("/")} className="text-primary hover:underline">Explore events</button>
              </div>
            ) : goingEvents.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        )}

        {/* ── Friends ── */}
        {tab === "friends" && (
          <div className="space-y-5">
            {/* Live search */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Find People</p>
              <div className="relative">
                <input data-testid="input-search-users" type="text" value={searchQuery} onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary pr-8" />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-2">
                  {searchResults.map((result) => {
                    const isFriend = friendIds.has(result.uid);
                    const isPending = outgoingIds.has(result.uid);
                    return (
                      <div key={result.uid} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-sm font-bold text-primary flex-shrink-0 cursor-pointer overflow-hidden"
                          onClick={() => setLocation(`/users/${result.uid}`)}>
                          {result.photoURL ? <img src={result.photoURL} alt="" className="w-full h-full object-cover" /> : result.displayName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground cursor-pointer hover:text-primary" onClick={() => setLocation(`/users/${result.uid}`)}>{result.displayName}</p>
                          <p className="text-xs text-muted-foreground">{result.email}</p>
                        </div>
                        {isFriend ? (
                          <span className="text-xs text-green-400 font-medium">Friends</span>
                        ) : isPending ? (
                          <span className="text-xs text-muted-foreground">Sent</span>
                        ) : (
                          <button data-testid={`button-add-friend-${result.uid}`} onClick={() => handleSendRequest(result)} disabled={actionLoading === result.uid}
                            className="text-xs bg-primary text-primary-foreground rounded-lg px-3 py-1.5 font-medium hover:opacity-90 disabled:opacity-50">
                            {actionLoading === result.uid ? "…" : "Add"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {searchQuery.trim() && !searching && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-3">No users found for "{searchQuery}"</p>
              )}
            </div>

            {/* Incoming requests */}
            {incomingRequests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Requests ({incomingRequests.length})</p>
                <div className="space-y-2">
                  {incomingRequests.map((req) => (
                    <div key={req.id} data-testid={`request-${req.id}`} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-sm font-bold text-primary flex-shrink-0 cursor-pointer" onClick={() => setLocation(`/users/${req.fromId}`)}>
                        {req.fromName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{req.fromName}</p>
                        <p className="text-xs text-muted-foreground">wants to be friends</p>
                      </div>
                      <div className="flex gap-2">
                        <button data-testid={`button-accept-${req.id}`} onClick={() => handleAccept(req)} disabled={actionLoading === req.id}
                          className="text-xs bg-green-500/20 border border-green-500 text-green-400 rounded-lg px-3 py-1.5 font-medium hover:opacity-90 disabled:opacity-50">
                          {actionLoading === req.id ? "…" : "Accept"}
                        </button>
                        <button data-testid={`button-decline-${req.id}`} onClick={() => handleDecline(req)} disabled={actionLoading === req.id}
                          className="text-xs border border-border text-muted-foreground rounded-lg px-3 py-1.5 font-medium hover:text-foreground disabled:opacity-50">Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Friends ({friendProfiles.length})</p>
              {friendProfiles.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">No friends yet. Search for people above.</div>
              ) : (
                <div className="space-y-2">
                  {friendProfiles.map((friend) => (
                    <div key={friend.uid} data-testid={`friend-${friend.uid}`} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-sm font-bold text-primary flex-shrink-0 cursor-pointer overflow-hidden" onClick={() => setLocation(`/users/${friend.uid}`)}>
                        {friend.photoURL ? <img src={friend.photoURL} alt="" className="w-full h-full object-cover" /> : friend.displayName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLocation(`/users/${friend.uid}`)}>
                        <p className="text-sm font-medium text-foreground">{friend.displayName}</p>
                        <p className="text-xs text-muted-foreground">{friend.friends?.length ?? 0} friends</p>
                      </div>
                      <button data-testid={`button-unfriend-${friend.uid}`} onClick={() => handleUnfriend(friend.uid, friend.displayName)} disabled={actionLoading === friend.uid}
                        className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50">
                        {actionLoading === friend.uid ? "…" : "Unfriend"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
