# Supabase Setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run `supabase/schema.sql`.
3. In Supabase Auth:
   - set your site URL to `https://chanduprasad007.github.io/Fit-Pulse/`
   - add `https://chanduprasad007.github.io/Fit-Pulse/` as a redirect URL
   - enable email sign-in
4. Open `supabase-config.js` and fill in:
   - `url`
   - `anonKey`
   - `redirectTo` if you want to force a specific Pages URL
5. Commit and push the updated config to GitHub.

Notes:

- The anon key is safe to expose in the frontend when RLS is enabled correctly.
- Do not put the service role key in this app.
