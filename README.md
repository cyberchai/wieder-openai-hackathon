# GPT Checkout (MVP)

Minimal demo: Google Sign-In (Firebase) + GPT-5 planner API that turns natural language café orders into strict JSON.

## Setup
1. Copy `.env.local.example` to `.env.local` and fill values:
   - Get Firebase web config + enable Google Sign-In
   - Create a service account (JSON) and paste values into server envs
   - Add your `OPENAI_API_KEY`

  ## Firebase client notes

  This project initializes the Firebase Web SDK on the client. The client uses the following NEXT_PUBLIC environment variables (you can also rely on the fallback values already committed in the repo):

  - NEXT_PUBLIC_FIREBASE_API_KEY
  - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  - NEXT_PUBLIC_FIREBASE_PROJECT_ID
  - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  - NEXT_PUBLIC_FIREBASE_APP_ID
  - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

  Analytics is initialized only in the browser (not during SSR) and will be a no-op on the server or when analytics is not supported.

2. Install & run
```bash
npm i
npm run dev
Open http://localhost:3000
Flow
Sign in with Google
Enter: Large oat latte + chocolate croissant at 12:30 pickup
Receive strict JSON plan

## After generating
- Replace `.env.local.example` with a real `.env.local` and run:
  ```bash
  npm i
  npm run dev
End of prompt. Create all files and confirm the app starts.
