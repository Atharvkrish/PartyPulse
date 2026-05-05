import { getMessaging, getToken, onMessage } from "firebase/messaging";
import app, { db } from "./firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

function getMsg() {
  if (!messagingInstance) messagingInstance = getMessaging(app);
  return messagingInstance;
}

export async function initFCM(userId: string): Promise<boolean> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  if (!VAPID_KEY) {
    console.warn("FCM: VITE_FIREBASE_VAPID_KEY is not set. Push notifications disabled.");
    return false;
  }

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    const messaging = getMsg();

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await updateDoc(doc(db, "users", userId), {
        fcmTokens: arrayUnion(token),
      }).catch(() => {});
    }

    return !!token;
  } catch (err) {
    console.warn("FCM init failed:", err);
    return false;
  }
}

export function listenForegroundMessages(
  onNotification: (title: string, body: string, url?: string) => void
): () => void {
  try {
    const messaging = getMsg();
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? "PartyPulse";
      const body = payload.notification?.body ?? "";
      const url = (payload.data as Record<string, string> | undefined)?.url;
      onNotification(title, body, url);
    });
  } catch {
    return () => {};
  }
}
