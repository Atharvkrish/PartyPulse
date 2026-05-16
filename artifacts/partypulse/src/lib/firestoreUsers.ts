import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  friends: string[];
  photoURL?: string;
  createdAt: unknown;
}

export async function upsertUser(uid: string, displayName: string, email: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid, displayName, email, friends: [], createdAt: serverTimestamp() });
  } else {
    await setDoc(ref, { displayName, email }, { merge: true });
  }
}

export async function updateUserPhoto(uid: string, photoURL: string) {
  await updateDoc(doc(db, "users", uid), { photoURL });
}

export async function getAppUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as AppUser;
}

export function subscribeUser(uid: string, cb: (user: AppUser | null) => void) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    cb(snap.exists() ? (snap.data() as AppUser) : null);
  });
}

export async function searchUsers(term: string, currentUid: string): Promise<AppUser[]> {
  if (!term.trim()) return [];
  const lower = term.trim().toLowerCase();
  const snap = await getDocs(collection(db, "users"));
  return snap.docs
    .map((d) => d.data() as AppUser)
    .filter(
      (u) =>
        u.uid !== currentUid &&
        (u.displayName?.toLowerCase().includes(lower) || u.email?.toLowerCase().includes(lower))
    )
    .slice(0, 20);
}
