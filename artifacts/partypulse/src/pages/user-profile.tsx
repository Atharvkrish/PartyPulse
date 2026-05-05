import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeUser, AppUser } from "@/lib/firestoreUsers";
import { subscribeUser as subscribeCurrentUser } from "@/lib/firestoreUsers";
import {
  getFriendStatus,
  sendFriendRequest,
  acceptFriendRequest,
  unfriend,
  subscribeIncomingRequests,
  FriendRequest,
} from "@/lib/firestoreFriends";
import { subscribeOwnActivity, Activity } from "@/lib/firestoreActivity";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";

function timeAgo(ts: Timestamp | undefined): string {
  if (!ts) return "";
  const seconds = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function activityLabel(a: Activity): string {
  switch (a.type) {
    case "created_event": return `created "${a.eventTitle}"`;
    case "rsvped": return `is ${a.detail ?? "going"} to "${a.eventTitle}"`;
    case "uploaded_photos": return `uploaded ${a.detail ?? "photos"} to "${a.eventTitle}"`;
    default: return `attended "${a.eventTitle}"`;
  }
}

type FriendStatus = "friends" | "pending_sent" | "pending_received" | "none" | "self" | "loading";

export default function UserProfile() {
  const { id: targetUid } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [targetUser, setTargetUser] = useState<AppUser | null>(null);
  const [currentUserData, setCurrentUserData] = useState<AppUser | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("loading");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!targetUid) return;
    const unsub = subscribeUser(targetUid, setTargetUser);
    return unsub;
  }, [targetUid]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeCurrentUser(user.uid, setCurrentUserData);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!targetUid) return;
    const unsub = subscribeOwnActivity(targetUid, setActivities);
    return unsub;
  }, [targetUid]);

  // Keep friend status in sync
  useEffect(() => {
    if (!user || !targetUid) return;
    if (user.uid === targetUid) { setFriendStatus("self"); return; }
    if (!currentUserData) return;

    getFriendStatus(user.uid, targetUid, currentUserData.friends ?? []).then(
      setFriendStatus
    );
  }, [user, targetUid, currentUserData]);

  // Watch for incoming request from this target so we can grab its ID for acceptance
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeIncomingRequests(user.uid, (reqs) => {
      const from = reqs.find((r) => r.fromId === targetUid);
      setPendingRequestId(from?.id ?? null);
    });
    return unsub;
  }, [user, targetUid]);

  async function handleFriendAction() {
    if (!user || !targetUser || actionLoading) return;
    setActionLoading(true);
    try {
      if (friendStatus === "none") {
        await sendFriendRequest(
          user.uid,
          user.displayName || user.email || "Someone",
          targetUser.uid,
          targetUser.displayName
        );
        setFriendStatus("pending_sent");
        toast({ title: "Friend request sent" });
      } else if (friendStatus === "pending_received" && pendingRequestId) {
        await acceptFriendRequest(pendingRequestId, targetUser.uid, user.uid);
        setFriendStatus("friends");
        toast({ title: "You are now friends!" });
      } else if (friendStatus === "friends") {
        if (!confirm(`Unfriend ${targetUser.displayName}?`)) return;
        await unfriend(user.uid, targetUser.uid);
        setFriendStatus("none");
        toast({ title: "Unfriended" });
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }

  function friendButtonLabel() {
    switch (friendStatus) {
      case "friends": return "Friends — Unfriend";
      case "pending_sent": return "Request Sent";
      case "pending_received": return "Accept Request";
      case "none": return "Add Friend";
      default: return "";
    }
  }

  function friendButtonStyle() {
    switch (friendStatus) {
      case "friends": return "border border-border text-muted-foreground hover:text-destructive hover:border-destructive";
      case "pending_sent": return "border border-border text-muted-foreground opacity-60 cursor-not-allowed";
      case "pending_received": return "bg-green-500/20 border border-green-500 text-green-400";
      default: return "bg-primary text-primary-foreground hover:opacity-90";
    }
  }

  if (!targetUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 pb-8">
        <div className="pt-4 mb-4">
          <button
            data-testid="button-back"
            onClick={() => setLocation(-1 as unknown as string)}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            &larr; Back
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-2xl font-bold text-primary">
              {(targetUser.displayName || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p data-testid="text-target-name" className="font-bold text-lg text-foreground">
                {targetUser.displayName}
              </p>
              <p className="text-muted-foreground text-sm">{targetUser.friends?.length ?? 0} friends</p>
            </div>
          </div>

          {friendStatus !== "self" && friendStatus !== "loading" && (
            <button
              data-testid="button-friend-action"
              onClick={handleFriendAction}
              disabled={actionLoading || friendStatus === "pending_sent"}
              className={`mt-4 w-full py-2 text-sm font-semibold rounded-lg transition-all ${friendButtonStyle()}`}
            >
              {actionLoading ? "..." : friendButtonLabel()}
            </button>
          )}
        </div>

        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recent Activity
          </h2>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {activities.map((a) => (
                <div
                  key={a.id}
                  data-testid={`activity-${a.id}`}
                  onClick={() => setLocation(`/events/${a.eventId}`)}
                  className="bg-card border border-border rounded-xl p-3 flex gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">{activityLabel(a)}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{timeAgo(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
