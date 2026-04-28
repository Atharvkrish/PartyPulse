import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { logout } from "@/lib/firebaseAuth";
import { subscribeEvents, Event, deleteEvent } from "@/lib/firestoreEvents";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [myEvents, setMyEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeEvents((events) => {
      setMyEvents(events.filter((e) => e.creatorId === user.uid));
    });
    return unsub;
  }, [user]);

  async function handleLogout() {
    await logout();
    setLocation("/login");
  }

  async function handleDelete(eventId: string) {
    if (!confirm("Delete this event?")) return;
    try {
      await deleteEvent(eventId);
      toast({ title: "Event deleted" });
    } catch {
      toast({ title: "Error deleting event", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            data-testid="button-back"
            onClick={() => setLocation("/")}
            className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1"
          >
            &larr; Map
          </button>
          <h1 className="text-lg font-bold">Profile</h1>
          <button
            data-testid="button-logout"
            onClick={handleLogout}
            className="text-sm text-destructive hover:opacity-80"
          >
            Sign Out
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 mb-6">
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
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Your Events ({myEvents.length})
          </h2>
          {myEvents.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              No events created yet.{" "}
              <button onClick={() => setLocation("/events/new")} className="text-primary hover:underline">
                Create one
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myEvents.map((event) => (
                <div
                  key={event.id}
                  data-testid={`card-event-${event.id}`}
                  className="bg-card border border-border rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLocation(`/events/${event.id}`)}>
                    <p className="font-medium text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date} &bull; {event.going.length} going</p>
                  </div>
                  <button
                    data-testid={`button-delete-event-${event.id}`}
                    onClick={() => handleDelete(event.id)}
                    className="ml-3 text-xs text-destructive hover:opacity-80"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
