# HarvestLink

Responsive farm-to-market marketplace prototype. Public sections include Home, About, Catalogue, Farmer Profiles and Contact. Dialogs provide registration/sign-in, product details and cart. Farmer workspaces support listing create/edit/remove; administrator workspaces support farmer/listing approval, order status updates, and printable receipts. The client includes a sample catalogue when running without credentials.

## Run

Open `index.html` in a browser or run a static server from this folder (`python -m http.server 8000`) and visit `http://localhost:8000`.

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
3. The Project URL and browser-safe publishable key are configured at the top of `app.js`. Only the publishable (anon) key belongs in the browser.
4. Enable email authentication and configure allowed redirect URLs for local/public domains.
5. For an existing project that already ran the old schema, run [`supabase/migration_approvals.sql`](supabase/migration_approvals.sql) in the SQL Editor before deploying the updated app. Register your account, then run the final promotion statement in that file after replacing `your-admin-email@example.com` (the promotion can be run again after signup); it returns `id`, `role`, and `is_approved` for verification. Farmer profiles remain pending until an admin approves them in the in-app Dashboard.

Admins can approve or reject farmer accounts and produce listings in the in-app Dashboard. Pending farmers see an approval message and can create listings after approval. The session is managed by Supabase Auth and restored after refresh.

Only the public publishable/anon key belongs in the browser. Never publish the service-role key or database password. Supabase Auth and Row Level Security protect data; the browser uses Supabase's parameterized PostgREST API.

## Data model

The ER diagram is in [`docs/er-diagram.md`](docs/er-diagram.md). The schema includes Users, Categories, Produce, Orders, and Order_Items, role fields, approval state, constraints, and RLS policies.

## Deploy

Deploy this static folder to Netlify, Vercel, or GitHub Pages. Add the deployed domain to Supabase Auth's allowed redirect URLs. Use HTTPS.
