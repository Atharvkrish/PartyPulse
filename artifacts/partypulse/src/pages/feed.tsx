import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeUser } from "@/lib/firestoreUsers";
import { subscribeFriendFeed, Activity } from "@/lib/firestoreActivity";
import BottomNav from "@/components/BottomNav";
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
    case "created_event":
      return `created "${a.eventTitle}"`;
    case "rsvped":
      return `is ${a.detail ?? "going"} to "${a.eventTitle}"`;
    case "uploaded_photos":
      return `uploaded ${a.detail ?? "photos"} to "${a.eventTitle}"`;
    default:
      return `did something at "${a.eventTitle}"`;
  }
}

function activityIcon(type: Activity["type"]): string {
  switch (type) {
    case "created_event": return "★";
    case "rsvped": return "✓";
    case "uploaded_photos": return "◈";
    default: return "•";
  }
}

export default function Feed() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUser(user.uid, (u) => {
      setFriendIds(u?.friends ?? []);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeFriendFeed(friendIds, (acts) => {
      setActivities(acts);
      setLoading(false);
    });
    return unsub;
  }, [friendIds]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <header className="px-4 pt-6 pb-4 border-b border-border bg-card">
        <h1 className="text-xl font-black">
          Party<span className="text-primary">Feed</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">What your friends are up to</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {loading && (
          <div className="space-y-3 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-border flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-border rounded w-3/4" />
                    <div className="h-3 bg-border rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && friendIds.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 opacity-30">◈</div>
            <p className="font-semibold text-foreground">No friends yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add friends from your profile to see their activity here.
            </p>
            <button
              data-testid="button-go-profile"
              onClick={() => setLocation("/profile")}
              className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
            >
              Find Friends
            </button>
          </div>
        )}

        {!loading && friendIds.length > 0 && activities.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 opacity-30">★</div>
            <p className="font-semibold text-foreground">Nothing yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your friends haven't been active recently.
            </p>
          </div>
        )}

        {!loading &&
          activities.map((activity) => (
            <div
              key={activity.id}
              data-testid={`activity-${activity.id}`}
              onClick={() => setLocation(`/events/${activity.eventId}`)}
              className="bg-card border border-border rounded-xl p-4 flex gap-3 cursor-pointer hover:border-primary/40 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                {activity.actorName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{activity.actorName}</span>{" "}
                  <span className="text-muted-foreground">{activityLabel(activity)}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {timeAgo(activity.createdAt)}
                </p>
              </div>
              <span className="text-primary/60 text-sm flex-shrink-0 self-center">
                {activityIcon(activity.type)}
              </span>
            </div>
          ))}
      </div>

      <BottomNav />
    </div>
  );
}
