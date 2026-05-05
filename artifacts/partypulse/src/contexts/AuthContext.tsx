import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { onAuthChange } from "@/lib/firebaseAuth";
import { upsertUser } from "@/lib/firestoreUsers";
import { initFCM, listenForegroundMessages } from "@/lib/fcm";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        await upsertUser(
          u.uid,
          u.displayName || u.email || "Anonymous",
          u.email || u.phoneNumber || ""
        ).catch(() => {});
        // Init push notifications in background (won't block render)
        initFCM(u.uid).catch(() => {});
      }
    });
    return unsub;
  }, []);

  // Show foreground push notifications via toast-style alert
  useEffect(() => {
    if (!user) return;
    const unsub = listenForegroundMessages((title, body) => {
      // Use the browser Notification API since the tab is focused
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.svg" });
      }
    });
    return unsub;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
