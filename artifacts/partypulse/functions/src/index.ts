import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

async function getTokensForUsers(uids: string[]): Promise<string[]> {
  if (!uids.length) return [];
  const docs = await Promise.all(uids.map((uid) => db.doc(`users/${uid}`).get()));
  const tokens: string[] = [];
  for (const d of docs) {
    const arr = (d.data()?.fcmTokens as string[] | undefined) ?? [];
    tokens.push(...arr);
  }
  return [...new Set(tokens)]; // deduplicate
}

async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  url: string,
  type: string
) {
  if (!tokens.length) return;
  const chunks = chunkArray(tokens, 500);
  await Promise.all(
    chunks.map((chunk) => {
      const message: MulticastMessage = {
        tokens: chunk,
        notification: { title, body },
        data: { url, type },
        webpush: {
          notification: { icon: "/favicon.svg", badge: "/favicon.svg" },
          fcmOptions: { link: url },
        },
      };
      return messaging.sendEachForMulticast(message);
    })
  );
}

// ── Trigger 1: Friend request sent ─────────────────────────────────────────
export const onFriendRequestCreated = onDocumentCreated(
  "friendRequests/{requestId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { toId, fromName } = data as {
      toId: string;
      fromName: string;
      fromId: string;
    };

    const tokens = await getTokensForUsers([toId]);
    await sendToTokens(
      tokens,
      "New Friend Request 🎉",
      `${fromName} wants to be your friend!`,
      "/profile",
      "friend_request"
    );
  }
);

// ── Trigger 2: Friend creates an event ─────────────────────────────────────
export const onActivityCreated = onDocumentCreated(
  "activities/{activityId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || data.type !== "created_event") return;

    const { actorId, actorName, eventTitle, eventId } = data as {
      actorId: string;
      actorName: string;
      eventTitle: string;
      eventId: string;
    };

    // Get creator's friends
    const creatorDoc = await db.doc(`users/${actorId}`).get();
    const friends = (creatorDoc.data()?.friends as string[] | undefined) ?? [];
    if (!friends.length) return;

    const tokens = await getTokensForUsers(friends);
    await sendToTokens(
      tokens,
      "New Event! 🎊",
      `${actorName} created "${eventTitle}"`,
      `/events/${eventId}`,
      "new_event"
    );
  }
);

// ── Trigger 3: Chat mention (@username) ────────────────────────────────────
export const onMessageCreated = onDocumentCreated(
  "events/{eventId}/messages/{messageId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { text, userName, userId } = data as {
      text: string;
      userName: string;
      userId: string;
    };
    const eventId = event.params.eventId;

    // Find @mentions
    const mentions = (text.match(/@(\w+)/g) ?? []).map((m) => m.slice(1).toLowerCase());
    if (!mentions.length) return;

    // Look up mentioned users by displayName (case-insensitive prefix match)
    const usersSnap = await db.collection("users").get();
    const mentionedUids: string[] = [];
    for (const userDoc of usersSnap.docs) {
      const name = ((userDoc.data().displayName as string) ?? "").toLowerCase();
      if (mentions.some((m) => name.startsWith(m)) && userDoc.id !== userId) {
        mentionedUids.push(userDoc.id);
      }
    }
    if (!mentionedUids.length) return;

    const tokens = await getTokensForUsers(mentionedUids);
    await sendToTokens(
      tokens,
      `${userName} mentioned you 💬`,
      text.length > 80 ? text.slice(0, 77) + "…" : text,
      `/events/${eventId}`,
      "mention"
    );
  }
);
