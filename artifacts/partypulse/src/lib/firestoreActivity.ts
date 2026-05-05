import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type ActivityType = "created_event" | "rsvped" | "uploaded_photos";

export interface Activity {
  id: string;
  actorId: string;
  actorName: string;
  type: ActivityType;
  eventId: string;
  eventTitle: string;
  detail?: string;
  createdAt: Timestamp;
}

export async function logActivity(data: {
  actorId: string;
  actorName: string;
  type: ActivityType;
  eventId: string;
  eventTitle: string;
  detail?: string;
}) {
  await addDoc(collection(db, "activities"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export function subscribeFriendFeed(
  friendIds: string[],
  cb: (activities: Activity[]) => void
) {
  if (friendIds.length === 0) {
    cb([]);
    return () => {};
  }

  const chunk = friendIds.slice(0, 30);

  const q = query(
    collection(db, "activities"),
    where("actorId", "in", chunk),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity)))
  );
}

export function subscribeOwnActivity(
  userId: string,
  cb: (activities: Activity[]) => void
) {
  const q = query(
    collection(db, "activities"),
    where("actorId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity)))
  );
}
