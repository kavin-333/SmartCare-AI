# SmartCare AI

SmartCare AI is a React/Vite frontend with an Express API, MongoDB persistence,
and optional Gemini and Twilio integrations.

## Local development

1. Install the frontend dependencies with `npm ci`.
2. Install the backend dependencies with `npm ci --prefix server`.
3. Copy `server/.env.example` to `server/.env` and configure the required values.
   Generate a JWT secret with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

4. Start the API with `npm run dev --prefix server` and the frontend with
   `npm run dev`.

Never commit `.env` files or place backend credentials in `VITE_*` variables;
Vite embeds those values in public browser assets.

## Deploy to Vercel

Import this GitHub repository into Vercel and keep the project root set to the
repository root. `vercel.json` builds the frontend and routes `/api/*` to the
Express function. Its install command installs both the root and server
dependencies. GitHub Actions runs the production build and backend lint/syntax
checks on pushes and pull requests; Vercel's GitHub integration handles preview
and production deployments.

Add these values under the Vercel project's **Settings → Environment Variables**
for the environments that need them:

- `MONGODB_URI` — production MongoDB connection string, restricted to the
  application's database and network access.
- `JWT_SECRET` — a unique, randomly generated secret of at least 32 bytes. Do
  not reuse the example value or a local-development secret.
- `GEMINI_API_KEY` — required only for Gemini-powered features.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` — required
  only for Twilio features.
- `PUBLIC_BASE_URL` — the deployed HTTPS URL when Twilio webhooks are enabled.
- `CORS_ORIGINS` — comma-separated exact origins only when the API is called
  cross-origin. Same-origin Vercel deployments do not need this variable.

Set secrets in Vercel's environment settings, not in GitHub source, workflow
files, or frontend `VITE_*` variables. Do not enable production traffic until
the required database and integration secrets are configured. This application
may process health information; use only infrastructure and operational
controls appropriate for the data and applicable compliance obligations.
