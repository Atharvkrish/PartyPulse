# PartyPulse — Deployment Instructions

## Firebase Setup (required before deploying)

### 1. Enable Firebase services

In your [Firebase Console](https://console.firebase.google.com/project/partypulse-dc24f):

- **Authentication**: Enable Email/Password and Phone sign-in providers
- **Firestore**: Create database in production mode, then paste the `firestore.rules` file
- **Storage**: Create storage bucket, then paste the `storage.rules` file

### 2. Apply Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,storage
```

---

## Deploy to Firebase Hosting

```bash
# Build the app
pnpm --filter @workspace/partypulse run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

Your app will be live at: `https://partypulse-dc24f.web.app`

---

## Deploy to Vercel

1. Push this project to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Set **Root Directory** to `artifacts/partypulse`
4. Set **Build Command** to `pnpm run build`
5. Set **Output Directory** to `dist/public`
6. Add all 6 environment variables in Vercel dashboard:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
7. Click **Deploy**

### Vercel SPA rewrites

Create `artifacts/partypulse/public/vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Phone Auth Setup

Phone authentication requires a verified domain in Firebase Console:
- Go to Authentication → Settings → Authorized domains
- Add your Vercel/Firebase Hosting domain

For local testing, `localhost` is pre-authorized.
