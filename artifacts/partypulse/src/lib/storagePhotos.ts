import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
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
} from "firebase/firestore";
import { storage, db } from "./firebase";

export interface EventPhoto {
  id: string;
  url: string;
  uploaderId: string;
  uploaderName: string;
  storagePath: string;
  createdAt: Timestamp;
}

export function subscribePhotos(eventId: string, cb: (photos: EventPhoto[]) => void) {
  const q = query(collection(db, "events", eventId, "photos"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventPhoto)));
  });
}

export function uploadEventPhoto(
  eventId: string,
  file: File,
  userId: string,
  userName: string,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storagePath = `events/${eventId}/photos/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, "events", eventId, "photos"), {
          url, uploaderId: userId, uploaderName: userName, storagePath, createdAt: serverTimestamp(),
        });
        resolve(url);
      }
    );
  });
}

export async function uploadEventCover(
  eventId: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storagePath = `events/${eventId}/cover_${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => { resolve(await getDownloadURL(task.snapshot.ref)); }
    );
  });
}

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const storagePath = `users/${uid}/profile.jpg`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed", () => {}, reject, async () => {
      resolve(await getDownloadURL(task.snapshot.ref));
    });
  });
}

export async function deletePhoto(eventId: string, photoId: string, storagePath: string) {
  await deleteObject(ref(storage, storagePath));
  await deleteDoc(doc(db, "events", eventId, "photos", photoId));
}
