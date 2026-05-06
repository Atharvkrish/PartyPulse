"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMessageCreated = exports.onActivityCreated = exports.onFriendRequestCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const firestore_2 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
const messaging = (0, messaging_1.getMessaging)();
function chunkArray(arr, size) {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
}
async function getTokensForUsers(uids) {
    var _a, _b;
    if (!uids.length)
        return [];
    const docs = await Promise.all(uids.map((uid) => db.doc(`users/${uid}`).get()));
    const tokens = [];
    for (const d of docs) {
        const arr = (_b = (_a = d.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens) !== null && _b !== void 0 ? _b : [];
        tokens.push(...arr);
    }
    return [...new Set(tokens)]; // deduplicate
}
async function sendToTokens(tokens, title, body, url, type) {
    if (!tokens.length)
        return;
    const chunks = chunkArray(tokens, 500);
    await Promise.all(chunks.map((chunk) => {
        const message = {
            tokens: chunk,
            notification: { title, body },
            data: { url, type },
            webpush: {
                notification: { icon: "/favicon.svg", badge: "/favicon.svg" },
                fcmOptions: { link: url },
            },
        };
        return messaging.sendEachForMulticast(message);
    }));
}
// ── Trigger 1: Friend request sent ─────────────────────────────────────────
exports.onFriendRequestCreated = (0, firestore_1.onDocumentCreated)("friendRequests/{requestId}", async (event) => {
    var _a;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const { toId, fromName } = data;
    const tokens = await getTokensForUsers([toId]);
    await sendToTokens(tokens, "New Friend Request 🎉", `${fromName} wants to be your friend!`, "/profile", "friend_request");
});
// ── Trigger 2: Friend creates an event ─────────────────────────────────────
exports.onActivityCreated = (0, firestore_1.onDocumentCreated)("activities/{activityId}", async (event) => {
    var _a, _b, _c;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data || data.type !== "created_event")
        return;
    const { actorId, actorName, eventTitle, eventId } = data;
    // Get creator's friends
    const creatorDoc = await db.doc(`users/${actorId}`).get();
    const friends = (_c = (_b = creatorDoc.data()) === null || _b === void 0 ? void 0 : _b.friends) !== null && _c !== void 0 ? _c : [];
    if (!friends.length)
        return;
    const tokens = await getTokensForUsers(friends);
    await sendToTokens(tokens, "New Event! 🎊", `${actorName} created "${eventTitle}"`, `/events/${eventId}`, "new_event");
});
// ── Trigger 3: Chat mention (@username) ────────────────────────────────────
exports.onMessageCreated = (0, firestore_1.onDocumentCreated)("events/{eventId}/messages/{messageId}", async (event) => {
    var _a, _b, _c;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const { text, userName, userId } = data;
    const eventId = event.params.eventId;
    // Find @mentions
    const mentions = ((_b = text.match(/@(\w+)/g)) !== null && _b !== void 0 ? _b : []).map((m) => m.slice(1).toLowerCase());
    if (!mentions.length)
        return;
    // Look up mentioned users by displayName (case-insensitive prefix match)
    const usersSnap = await db.collection("users").get();
    const mentionedUids = [];
    for (const userDoc of usersSnap.docs) {
        const name = ((_c = userDoc.data().displayName) !== null && _c !== void 0 ? _c : "").toLowerCase();
        if (mentions.some((m) => name.startsWith(m)) && userDoc.id !== userId) {
            mentionedUids.push(userDoc.id);
        }
    }
    if (!mentionedUids.length)
        return;
    const tokens = await getTokensForUsers(mentionedUids);
    await sendToTokens(tokens, `${userName} mentioned you 💬`, text.length > 80 ? text.slice(0, 77) + "…" : text, `/events/${eventId}`, "mention");
});
//# sourceMappingURL=index.js.map