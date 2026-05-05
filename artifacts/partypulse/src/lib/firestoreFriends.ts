import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  status: "pending" | "accepted" | "declined";
  createdAt: Timestamp;
}

export async function sendFriendRequest(
  fromId: string,
  fromName: string,
  toId: string,
  toName: string
) {
  // Guard: don't create duplicate pending requests
  const existing = await getDocs(
    query(
      collection(db, "friendRequests"),
      where("fromId", "==", fromId),
      where("toId", "==", toId),
      where("status", "==", "pending")
    )
  );
  if (!existing.empty) return;

  await addDoc(collection(db, "friendRequests"), {
    fromId,
    fromName,
    toId,
    toName,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function acceptFriendRequest(requestId: string, fromId: string, toId: string) {
  await updateDoc(doc(db, "friendRequests", requestId), { status: "accepted" });
  // Add each other to friends arrays
  await updateDoc(doc(db, "users", toId), { friends: arrayUnion(fromId) });
  await updateDoc(doc(db, "users", fromId), { friends: arrayUnion(toId) });
}

export async function declineRequest(requestId: string) {
  await updateDoc(doc(db, "friendRequests", requestId), { status: "declined" });
}

export async function unfriend(userId: string, friendId: string) {
  await updateDoc(doc(db, "users", userId), { friends: arrayRemove(friendId) });
  await updateDoc(doc(db, "users", friendId), { friends: arrayRemove(userId) });
}

export function subscribeIncomingRequests(
  userId: string,
  cb: (requests: FriendRequest[]) => void
) {
  const q = query(
    collection(db, "friendRequests"),
    where("toId", "==", userId),
    where("status", "==", "pending")
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest)))
  );
}

export function subscribeOutgoingRequests(
  userId: string,
  cb: (requests: FriendRequest[]) => void
) {
  const q = query(
    collection(db, "friendRequests"),
    where("fromId", "==", userId),
    where("status", "==", "pending")
  );
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest)))
  );
}

// Returns: "friends" | "pending_sent" | "pending_received" | "none"
export async function getFriendStatus(
  currentUid: string,
  targetUid: string,
  friendsList: string[]
): Promise<"friends" | "pending_sent" | "pending_received" | "none"> {
  if (friendsList.includes(targetUid)) return "friends";

  const sentSnap = await getDocs(
    query(
      collection(db, "friendRequests"),
      where("fromId", "==", currentUid),
      where("toId", "==", targetUid),
      where("status", "==", "pending")
    )
  );
  if (!sentSnap.empty) return "pending_sent";

  const receivedSnap = await getDocs(
    query(
      collection(db, "friendRequests"),
      where("fromId", "==", targetUid),
      where("toId", "==", currentUid),
      where("status", "==", "pending")
    )
  );
  if (!receivedSnap.empty) return "pending_received";

  return "none";
}
