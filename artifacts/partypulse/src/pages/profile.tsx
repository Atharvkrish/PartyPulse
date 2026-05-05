import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { logout } from "@/lib/firebaseAuth";
import { subscribeEvents, Event, deleteEvent } from "@/lib/firestoreEvents";
import { subscribeUser, searchUsers, getAppUser, AppUser } from "@/lib/firestoreUsers";
import {
  subscribeIncomingRequests,
  subscribeOutgoingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineRequest,
  unfriend,
  FriendRequest,
} from "@/lib/firestoreFriends";
import { useToast } from "@/hooks/use-toast";
import BottomNav from "@/components/BottomNav";

type ProfileTab = "events" | "friends";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tab, setTab] = useState<ProfileTab>("events");
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [currentUserData, setCurrentUserData] = useState<AppUser | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeEvents((events) =>
      setMyEvents(events.filter((e) => e.creatorId === user.uid))
    );
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUser(user.uid, setCurrentUserData);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const u1 = subscribeIncomingRequests(user.uid, setIncomingRequests);
    const u2 = subscribeOutgoingRequests(user.uid, setOutgoingRequests);
    return () => { u1(); u2(); };
  }, [user]);

  // Resolve friend profiles whenever friends list changes
  useEffect(() => {
    const friends = currentUserData?.friends ?? [];
    if (friends.length === 0) { setFriendProfiles([]); return; }
    Promise.all(
      friends.map((uid) =>
        getAppUser(uid)
      )
    ).then((profiles) =>
      setFriendProfiles(profiles.filter(Boolean) as AppUser[])
    );
  }, [currentUserData?.friends]);

  async function handleSearch() {
    if (!user || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await searchUsers(searchQuery, user.uid);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(target: AppUser) {
    if (!user) return;
    setActionLoading(target.uid);
    try {
      await sendFriendRequest(
        user.uid,
        user.displayName || user.email || "Someone",
        target.uid,
        target.displayName
      );
      toast({ title: `Request sent to ${target.displayName}` });
      setSearchResults((prev) => prev.filter((u) => u.uid !== target.uid));
    } catch {
      toast({ title: "Error sending request", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAccept(req: FriendRequest) {
    if (!user) return;
    setActionLoading(req.id);
    try {
      await acceptFriendRequest(req.id, req.fromId, user.uid);
      toast({ title: `You and ${req.fromName} are now friends!` });
    } catch {
      toast({ title: "Error accepting request", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDecline(req: FriendRequest) {
    setActionLoading(req.id);
    try {
      await declineRequest(req.id);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnfriend(friendId: string, name: string) {
    if (!user || !confirm(`Unfriend ${name}?`)) return;
    setActionLoading(friendId);
    try {
      await unfriend(user.uid, friendId);
      toast({ title: "Unfriended" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Delete this event?")) return;
    try {
      await deleteEvent(eventId);
      toast({ title: "Event deleted" });
    } catch {
      toast({ title: "Error deleting event", variant: "destructive" });
    }
  }

  async function handleLogout() {
    await logout();
    setLocation("/login");
  }

  const pendingCount = incomingRequests.length;
  const outgoingIds = new Set(outgoingRequests.map((r) => r.toId));
  const friendIds = new Set(currentUserData?.friends ?? []);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between pt-6 mb-4">
          <h1 className="text-lg font-bold">Profile</h1>
          <button
            data-testid="button-logout"
            onClick={handleLogout}
            className="text-sm text-destructive hover:opacity-80"
          >
            Sign Out
          </button>
        </div>

        {/* Avatar card */}
        <div className="bg-card border border-border rounded-xl p-5 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-2xl font-bold text-primary">
              {(user?.displayName || user?.email || "?")[0].toUpperCase()}
            </div>
            <div>
              <p data-testid="text-display-name" className="font-semibold text-foreground text-lg">
                {user?.displayName || "Anonymous"}
              </p>
              <p data-testid="text-email" className="text-muted-foreground text-sm">
                {user?.email || user?.phoneNumber || ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentUserData?.friends?.length ?? 0} friends
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border border-border rounded-lg overflow-hidden mb-5">
          <button
            data-testid="tab-events"
            onClick={() => setTab("events")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === "events" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Events ({myEvents.length})
          </button>
          <button
            data-testid="tab-friends"
            onClick={() => setTab("friends")}
            className={`relative flex-1 py-2 text-sm font-medium transition-colors ${
              tab === "friends" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Friends
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Events tab */}
        {tab === "events" && (
          <div className="space-y-3">
            {myEvents.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
                No events yet.{" "}
                <button onClick={() => setLocation("/events/new")} className="text-primary hover:underline">
                  Create one
                </button>
              </div>
            ) : (
              myEvents.map((event) => (
                <div
                  key={event.id}
                  data-testid={`card-event-${event.id}`}
                  className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
                >
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setLocation(`/events/${event.id}`)}
                  >
                    <p className="font-medium text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.date} &bull; {event.going.length} going
                    </p>
                  </div>
                  <button
                    data-testid={`button-delete-event-${event.id}`}
                    onClick={() => handleDeleteEvent(event.id)}
                    className="ml-3 text-xs text-destructive hover:opacity-80"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Friends tab */}
        {tab === "friends" && (
          <div className="space-y-5">
            {/* Search */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Find People
              </p>
              <div className="flex gap-2">
                <input
                  data-testid="input-search-users"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search by name or email..."
                  className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  data-testid="button-search-users"
                  onClick={handleSearch}
                  disabled={searching}
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {searching ? "..." : "Search"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 space-y-2">
                  {searchResults.map((result) => {
                    const isFriend = friendIds.has(result.uid);
                    const isPending = outgoingIds.has(result.uid);
                    return (
                      <div
                        key={result.uid}
                        className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
                      >
                        <div
                          className="w-9 h-9 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-sm font-bold text-primary flex-shrink-0 cursor-pointer"
                          onClick={() => setLocation(`/users/${result.uid}`)}
                        >
                          {result.displayName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium text-foreground cursor-pointer hover:text-primary"
                            onClick={() => setLocation(`/users/${result.uid}`)}
                          >
                            {result.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground">{result.email}</p>
                        </div>
                        {isFriend ? (
                          <span className="text-xs text-green-400 font-medium">Friends</span>
                        ) : isPending ? (
                          <span className="text-xs text-muted-foreground">Sent</span>
                        ) : (
                          <button
                            data-testid={`button-add-friend-${result.uid}`}
                            onClick={() => handleSendRequest(result)}
                            disabled={actionLoading === result.uid}
                            className="text-xs bg-primary text-primary-foreground rounded-lg px-3 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            {actionLoading === result.uid ? "..." : "Add"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Incoming requests */}
            {incomingRequests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Pending Requests ({incomingRequests.length})
                </p>
                <div className="space-y-2">
                  {incomingRequests.map((req) => (
                    <div
                      key={req.id}
                      data-testid={`request-${req.id}`}
                      className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
                    >
                      <div
                        className="w-9 h-9 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-sm font-bold text-primary flex-shrink-0 cursor-pointer"
                        onClick={() => setLocation(`/users/${req.fromId}`)}
                      >
                        {req.fromName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{req.fromName}</p>
                        <p className="text-xs text-muted-foreground">wants to be friends</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          data-testid={`button-accept-${req.id}`}
                          onClick={() => handleAccept(req)}
                          disabled={actionLoading === req.id}
                          className="text-xs bg-green-500/20 border border-green-500 text-green-400 rounded-lg px-3 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
                        >
                          {actionLoading === req.id ? "..." : "Accept"}
                        </button>
                        <button
                          data-testid={`button-decline-${req.id}`}
                          onClick={() => handleDecline(req)}
                          disabled={actionLoading === req.id}
                          className="text-xs border border-border text-muted-foreground rounded-lg px-3 py-1.5 font-medium hover:text-foreground disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Friends ({friendProfiles.length})
              </p>
              {friendProfiles.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
                  No friends yet. Search for people above.
                </div>
              ) : (
                <div className="space-y-2">
                  {friendProfiles.map((friend) => (
                    <div
                      key={friend.uid}
                      data-testid={`friend-${friend.uid}`}
                      className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
                    >
                      <div
                        className="w-9 h-9 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-sm font-bold text-primary flex-shrink-0 cursor-pointer"
                        onClick={() => setLocation(`/users/${friend.uid}`)}
                      >
                        {friend.displayName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setLocation(`/users/${friend.uid}`)}
                      >
                        <p className="text-sm font-medium text-foreground">{friend.displayName}</p>
                        <p className="text-xs text-muted-foreground">{friend.friends?.length ?? 0} friends</p>
                      </div>
                      <button
                        data-testid={`button-unfriend-${friend.uid}`}
                        onClick={() => handleUnfriend(friend.uid, friend.displayName)}
                        disabled={actionLoading === friend.uid}
                        className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        {actionLoading === friend.uid ? "..." : "Unfriend"}
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
