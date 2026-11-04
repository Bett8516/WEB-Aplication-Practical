# HarvestLink

Responsive farm-to-market marketplace prototype. Public sections include Home, About, Catalogue, Farmer Profiles and Contact. Dialogs provide registration/sign-in, product details and cart. Farmer workspaces support listing create/edit/remove; administrator workspaces support farmer/listing approval, order status updates, and printable receipts. The client includes a sample catalogue when running without credentials.

## Run

Open `index.html` in a browser or run a static server from this folder (`python -m http.server 8000`) and visit `http://localhost:8000`.

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
3. The Project URL and browser-safe publishable key are configured at the top of `app.js`. Only the publishable (anon) key belongs in the browser.
4. In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://harvestlink-sand.vercel.app` and add that URL to the allowed redirect URLs. Signup links in the app explicitly return to this live site. If email confirmation is enabled, users must confirm before signing in.
5. For an existing project that already ran the old schema, run [`supabase/migration_approvals.sql`](supabase/migration_approvals.sql) in the SQL Editor before deploying the updated app. Register your account, then run the final promotion statement in that file after replacing `your-admin-email@example.com` (the promotion can be run again after signup); it returns `id`, `role`, and `is_approved` for verification. Farmer profiles remain pending until an admin approves them in the in-app Dashboard.
6. Run [`supabase/migration_marketplace.sql`](supabase/migration_marketplace.sql) after `schema.sql` (and after the approval migration on an existing project). It creates the admin-editable starter allocation, per-farmer stock, persistent buyer carts, RLS policies, and atomic checkout functions. It also performs an idempotent starter-stock backfill; [`supabase/backfill_farmer_products.sql`](supabase/backfill_farmer_products.sql) is available to safely repeat that backfill after new default products are added.

Admins can approve or reject farmer accounts and produce listings in the in-app Dashboard. Pending farmers see an approval message and can create listings after approval. The session is managed by Supabase Auth and restored after refresh.

The farmer workspace receives five starter goods from `default_allocation` (50 units each on initial setup). Admins can change future defaults in Dashboard; each farmer can adjust their own available stock and price or remove a starter item. Buyer carts stay in localStorage for guests and sync to Supabase for signed-in buyers. Checkout validates and locks stock in a database transaction, collects a Kenyan phone number and delivery location, records the order, and reduces stock. Payment is currently pay on delivery; M-Pesa is a placeholder.

This repository is a static HTML/CSS/JavaScript app, not a Next.js project. The feature is implemented in the existing `app.js`, `index.html`, and CSS files; no library was added.

Only the public publishable/anon key belongs in the browser. Never publish the service-role key or database password. Supabase Auth and Row Level Security protect data; the browser uses Supabase's parameterized PostgREST API.

## Data model

The ER diagram is in [`docs/er-diagram.md`](docs/er-diagram.md). The schema includes Users, Categories, Produce, Orders, and Order_Items, role fields, approval state, constraints, and RLS policies.

## Deploy

Deploy this static folder to Netlify, Vercel, or GitHub Pages. Add the deployed domain to Supabase Auth's allowed redirect URLs. Use HTTPS.
