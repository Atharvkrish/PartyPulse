import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  where,
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  imageUrl?: string;
  maxAttendees?: number;
  creatorId: string;
  creatorName: string;
  going: string[];
  interested: string[];
  cantGo: string[];
  bannedUsers: string[];
  createdAt: Timestamp;
}

export type RsvpStatus = "going" | "interested" | "cantGo";

export async function createEvent(data: Omit<Event, "id" | "createdAt" | "going" | "interested" | "cantGo" | "bannedUsers">) {
  const ref = await addDoc(collection(db, "events"), {
    ...data,
    going: [],
    interested: [],
    cantGo: [],
    bannedUsers: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getEvents(): Promise<Event[]> {
  const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
}

export async function getEvent(id: string): Promise<Event | null> {
  const snap = await getDoc(doc(db, "events", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Event;
}

export function subscribeEvent(id: string, cb: (event: Event | null) => void) {
  return onSnapshot(doc(db, "events", id), (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id: snap.id, ...snap.data() } as Event);
  });
}

export function subscribeEvents(cb: (events: Event[]) => void) {
  const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event)));
  });
}

export async function setRsvp(
  eventId: string,
  userId: string,
  status: RsvpStatus | null,
  prevStatus: RsvpStatus | null
) {
  const ref = doc(db, "events", eventId);
  const updates: Record<string, unknown> = {};

  if (prevStatus) {
    updates[prevStatus] = arrayRemove(userId);
  }
  if (status) {
    updates[status] = arrayUnion(userId);
  }

  await updateDoc(ref, updates);
}

export async function deleteEvent(eventId: string) {
  await deleteDoc(doc(db, "events", eventId));
}

export async function banUser(eventId: string, userId: string) {
  await updateDoc(doc(db, "events", eventId), {
    bannedUsers: arrayUnion(userId),
  });
}

export async function unbanUser(eventId: string, userId: string) {
  await updateDoc(doc(db, "events", eventId), {
    bannedUsers: arrayRemove(userId),
  });
}
