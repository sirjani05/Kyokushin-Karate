# Osu Dojo Network

A Tauri 2 desktop app for Kyokushin students and Senseis. It uses React, TypeScript, Vite, and Supabase Auth, Postgres, and Storage. The Supabase publishable key is used in the desktop frontend; database access is restricted by row-level security (RLS).

## Included workflows

- Email/password sign-up, sign-in, password-reset email, and sign-out.
- Public dojo directory with city, region, and postal-code search.
- Sensei dojo profile, public contact information, weekly class schedule, and monthly pricing.
- Student free-trial requests and private request-status tracking.
- Sensei lead pipeline with status updates and real counts from Supabase.
- Private tournament-video and belt-story uploads, publication state, signed media URLs, student video bookmarks, and consent checks for published grading stories.
- Student belt-progression history, recorded by the Sensei after a trial lead is enrolled.
- Supabase RLS policies, private storage buckets, and OS credential-store session persistence in the Tauri desktop app.

The UI shows empty and error states rather than inserting sample records or fabricated metrics.

## Requirements

- Node.js 20.19+ or 22.12+ for the installed Vite toolchain.
- Rust stable and Cargo for Tauri.
- Platform-specific Tauri prerequisites: [Windows](https://tauri.app/start/prerequisites/#windows), [macOS](https://tauri.app/start/prerequisites/#macos), or [Linux](https://tauri.app/start/prerequisites/#linux).
- On Linux, an available Secret Service/keyring provider is needed for secure session persistence. If the desktop credential service is unavailable, the app reports the error rather than storing the token in plaintext.

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL` to the project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's publishable key. The legacy anon key is also accepted as `VITE_SUPABASE_ANON_KEY`.
3. Never put a `service_role` key in a `VITE_` variable or the desktop application.
4. Apply `supabase/migrations/20261006000000_initial_schema.sql` using the Supabase SQL Editor, or link this repository to the project and run `supabase db push` with the Supabase CLI.
5. In Supabase Auth settings, enable email/password sign-in and configure email delivery and redirect URLs for the desktop app. Password reset email sending is wired; completing the reset requires a redirect target that can return the user to the app.
6. Restart Vite after changing `.env`.

The migration creates the tables, indexes, signup profile trigger, RLS policies, and private Storage buckets. It does not insert sample dojo or student data.

### Sensei onboarding

Public sign-up creates a student profile. Users cannot grant themselves the Sensei role from the client. A trusted project administrator must promote a verified account, for example:

```sql
update public.profiles
set role = 'sensei'
where id = (
  select id
  from auth.users
  where email = 'sensei@example.com'
);
```

Run this only in the Supabase SQL Editor as a project administrator, replacing the email with the intended account. Then sign out and back in to refresh the user's profile.

## Data privacy and access

- Unpublished dojos and media are available to their owning Sensei only.
- Published dojo listings, schedule/pricing details, tournament metadata, and consented belt stories can be read publicly.
- Trial requests include student contact details and are readable only by that student and the Sensei assigned to the dojo. A database trigger assigns the Sensei; the client cannot choose the lead owner.
- Students can read their own belt history and bookmarks. Senseis can add progression only for a student enrolled through one of their dojos.
- The `profiles.role` column is not client-updatable. Role changes require a trusted administrator.
- Media buckets are private. The app uploads generated UUID paths and requests short-lived signed URLs only for media allowed by RLS. Bucket size and MIME restrictions are enforced by Supabase Storage.
- Deleting an Auth account cascades its profile and related database rows, but it does not automatically remove Storage objects. Account deletion and storage cleanup need a trusted server-side/admin cleanup process before being offered in the UI.

## Development and builds

```sh
npm install
npm run dev
npm run build
npm run tauri dev
npm run tauri build
```

`npm run build` runs TypeScript checking and bundles the frontend. Tauri writes platform bundles below `src-tauri/target/release/bundle/`:

- Windows: NSIS `.exe` and/or MSI, depending on available platform tooling.
- macOS: `.dmg`.
- Linux: AppImage and other configured bundle formats; Linux system dependencies vary by distribution.

The Tauri bundle targets are set to `all`. Code signing and notarization are not configured; macOS distribution outside local development requires Apple Developer credentials and notarization. Windows publisher identity and signing likewise require the maintainer's own credentials.

The Tauri frontend stores Supabase auth sessions through the operating-system credential store (Windows Credential Manager, macOS Keychain, or Linux Secret Service). It does not save passwords. Browser-only Vite development keeps the session in `sessionStorage`; it is not the desktop persistence path.

## Current boundaries

- Directory search is text-based over loaded published rows; it does not use GPS, a map, geospatial radius search, or server-side pagination.
- Offline mode is read-only and uses the current in-memory query cache. It does not queue or sync offline writes across restarts.
- Lead counts are real database counts for the rows returned to the signed-in Sensei; there are no fabricated growth metrics or automatic notification delivery.
- The password-reset email is sent through Supabase Auth. A custom deep-link callback for setting a new password in the Tauri window must be configured before production rollout.
- Sensei accounts are promoted by an administrator; public self-service dojo registration and role approval are intentionally not available.

## Security configuration

Tauri capabilities expose only the core defaults. Three narrowly validated native commands read, write, and delete the Supabase auth-token entry in the system credential store. The Tauri Content Security Policy limits connections to Supabase-hosted project domains and local development endpoints; update that allowlist if using a self-hosted Supabase domain.
