import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

export interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  createdAt: Timestamp;
}

export function subscribeMessages(
  eventId: string,
  cb: (messages: ChatMessage[]) => void
) {
  const q = query(
    collection(db, "events", eventId, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
  });
}

export async function sendMessage(
  eventId: string,
  text: string,
  userId: string,
  userName: string,
  userPhoto?: string
) {
  await addDoc(collection(db, "events", eventId, "messages"), {
    text,
    userId,
    userName,
    userPhoto: userPhoto || null,
    createdAt: serverTimestamp(),
  });
}

export async function deleteMessage(eventId: string, messageId: string) {
  await deleteDoc(doc(db, "events", eventId, "messages", messageId));
}
