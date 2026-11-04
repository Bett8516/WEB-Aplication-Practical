# HarvestLink

Responsive farm-to-market marketplace prototype. Public sections include Home, About, Catalogue, Farmer Profiles and Contact. Dialogs provide registration/sign-in, product details and cart. The client includes a sample catalogue when running without credentials.

## Run

Open `index.html` in a browser or run a static server from this folder (`python -m http.server 8000`) and visit `http://localhost:8000`.

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
3. In Project Settings → API, copy Project URL and the publishable (anon) key into `SUPABASE_URL` and `SUPABASE_ANON_KEY` at the top of `app.js`.
4. Enable email authentication and configure allowed redirect URLs for local/public domains.
5. Sign up at least one account. To make an administrator, follow the commented SQL at the bottom of the schema. Farmer profiles default to pending approval; an admin can approve accounts in Supabase Table Editor.

Only the public publishable/anon key belongs in the browser. Never publish the service-role key or database password. Supabase Auth and Row Level Security protect data; the browser uses Supabase's parameterized PostgREST API.

## Data model

The ER diagram is in [`docs/er-diagram.md`](docs/er-diagram.md). The schema includes Users, Categories, Produce, Orders, and Order_Items, role fields, approval state, constraints, and RLS policies.

## Deploy

Deploy this static folder to Netlify, Vercel, or GitHub Pages. Set Supabase URL and public key in `app.js`, then configure the deployed domain in Supabase Auth settings. Use HTTPS.
