import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeIncomingRequests } from "@/lib/firestoreFriends";

export default function BottomNav() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeIncomingRequests(user.uid, (reqs) =>
      setPendingCount(reqs.length)
    );
    return unsub;
  }, [user]);

  const tabs = [
    {
      id: "map",
      label: "Map",
      path: "/",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" y1="3" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
      ),
    },
    {
      id: "feed",
      label: "Feed",
      path: "/feed",
      badge: 0,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      ),
    },
    {
      id: "profile",
      label: "Profile",
      path: "/profile",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      badge: pendingCount,
    },
  ];

  function isActive(path: string) {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1000] bg-card border-t border-border flex items-center justify-around px-2 pb-safe">
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.id}
            data-testid={`nav-${tab.id}`}
            onClick={() => setLocation(tab.path)}
            className={`relative flex flex-col items-center gap-1 py-3 px-4 flex-1 transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span className="absolute top-2 right-4 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {tab.badge > 9 ? "9+" : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
