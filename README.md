# SmartCare AI

SmartCare AI is a full-stack healthcare assistance platform featuring a React + Vite frontend, Express API backend, MongoDB persistence, and Gemini AI & Twilio voice integrations.

## Repository Architecture

```text
SmartCare-AI/
├── app/        ← React + Vite frontend
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
│
└── server/     ← Express backend
    ├── routes/
    ├── services/
    ├── models/
    ├── server.js
    ├── package.json
    └── vercel.json
```

---

## Local Development

1. **Install dependencies**:
   ```sh
   npm ci --prefix app
   npm ci --prefix server
   ```

2. **Configure backend environment**:
   Copy `server/.env.example` to `server/.env` and provide your credentials:
   - Generate a strong JWT secret:
     ```sh
     node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
     ```
   - Provide your `MONGODB_URI` (local MongoDB or MongoDB Atlas)

3. **Start local servers**:
   - Backend (Port 8000):
     ```sh
     npm run dev --prefix server
     ```
   - Frontend (Port 5173):
     ```sh
     npm run dev --prefix app
     ```

---

## Deploy to Vercel (Two Separate Projects)

Deploy the frontend and backend as two independent Vercel projects from this single repository:

```text
                 USER
                  │
                  ▼
        React/Vite Frontend
        smart-care-ai-is9e.vercel.app  (Root Directory: app)
                  │
                  │ API requests
                  ▼
        Express Backend
        smart-care-ai-a33e.vercel.app  (Root Directory: server)
                  │
       ┌──────────┼───────────┐
       ▼          ▼           ▼
    MongoDB     Gemini      Twilio
```

### Step 1: Deploy Frontend (`smart-care-ai-is9e`)

1. In Vercel, click **Add New... → Project** and select this repository.
2. Select **app → Import single project**.
3. Configure settings:
   - **Project Name**: `smart-care-ai-is9e` (or your frontend project name)
   - **Root Directory**: `app`
   - **Framework Preset**: `Vite` (auto-detected)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_BASE_URL` = `https://smart-care-ai-a33e.vercel.app` (your live backend Vercel URL)
5. Click **Deploy**.

### Step 2: Deploy Backend (`smart-care-ai-a33e`)

1. In Vercel, click **Add New... → Project** and select the same repository.
2. Select **server → Import single project**.
3. Configure settings:
   - **Project Name**: `smart-care-ai-a33e` (or your backend project name)
   - **Root Directory**: `server`
   - **Framework Preset**: `Other` (Node.js)
4. Add Environment Variables under **Settings → Environment Variables**:
   - `MONGODB_URI` — MongoDB Atlas connection string (`mongodb+srv://...`)
   - `JWT_SECRET` — Random 32+ character secret key
   - `CORS_ORIGINS` — `https://smart-care-ai-is9e.vercel.app` (your frontend Vercel URL)
   - `GEMINI_API_KEY` — Google Gemini API key
   - `GEMINI_MODEL` — `gemini-2.0-flash-lite` (or desired model)
   - `TWILIO_ACCOUNT_SID` — Twilio account SID (optional)
   - `TWILIO_AUTH_TOKEN` — Twilio auth token (optional)
   - `TWILIO_PHONE_NUMBER` — Twilio phone number (optional)
   - `PUBLIC_BASE_URL` — `https://smart-care-ai-a33e.vercel.app` (Twilio webhook callback base URL — must match the live backend)
5. Click **Deploy**.

**Voice assistant note:** Twilio dials the patient, then HTTP-fetches `{PUBLIC_BASE_URL}/api/voice/twiml`. If `PUBLIC_BASE_URL` points at a dead or wrong host, the call connects but you hear a TwiML / application error. Always use the live backend domain above.

---

## Security Notes

- Never commit `.env` files or push secrets to GitHub.
- Do not place sensitive secrets (database credentials, JWT secret, Gemini key, Twilio token) into the frontend `app/` or `VITE_*` variables.
- Use MongoDB Atlas (cloud MongoDB) for production, as Vercel serverless cannot connect to `127.0.0.1:27017`.
