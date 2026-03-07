## Session Rules
- At the END of every session, automatically update this CLAUDE.md file to reflect:
  1. What was built or changed this session
  2. Any new dependencies added
  3. Updated status of what is complete vs incomplete
- Do this without being asked, every single time before the session ends.

# Project: v0 Infant Tracker App

## Repo
https://github.com/thatguyovathea/v0-infant-tracker-app

## What this is
An infant tracking app for parents to log and monitor baby activity.
Built with v0.app and deployed via Next.js. Also compiled as an iOS
app via Capacitor.

## Tech Stack
- Next.js 16 (App Router, static export via `output: "export"`)
- TypeScript
- Tailwind CSS
- Supabase (database + auth + RLS)
- Radix UI (component library)
- Capacitor 8 (iOS mobile wrapper — assets in `out/`, synced via `npx cap sync ios`)
- Recharts (charts/data visualization)
- date-fns

## Dev workflow
- Build: `npm run build`
- Sync to iOS: `npx cap sync ios`
- Open Xcode: `npx cap open ios`
- Run on device: select device in Xcode → Run (▶)

## Critical pattern: getAuthedClient()
ALL Supabase DB reads/writes must use `getAuthedClient()` from `@/lib/supabase/authed-client`.
Standard `createClient()` does NOT reliably pass auth headers in Capacitor WKWebView.
Only use `createClient()` for auth calls (getSession, signIn, signOut).

## Critical pattern: .limit(1).maybeSingle()
All `family_members` queries that use `.maybeSingle()` MUST also have `.limit(1)` before it.
Without it, users with duplicate test rows get PGRST116 and are redirected to onboarding.

## RLS Architecture
Supabase has SECURITY DEFINER functions to avoid infinite recursion:
- `get_my_family_id()` — returns the calling user's family_id (used in family_members policies)
- `is_family_member(check_family_id)` — checks if calling user belongs to a family (used in babies, notifications policies)

## What is complete ✅
1. **Auth** — login, signup, session management
2. **Onboarding** — create family or join with invite code (RLS fixed)
3. **Baby profiles** — add, edit, delete, age display, notes
4. **Quick logging** — one-tap feeding, sleep start/end, diaper from dashboard
5. **Detailed log forms** — /log/feeding, /log/sleep, /log/diaper with full fields
6. **History** — paginated log list with filters, edit, delete (`.limit(1)` fix applied)
7. **Trends** — bar charts for sleep/feeding/diapers over 7/14/30 days
8. **In-app notifications** — bell icon with unread badge, realtime subscription, notifications list page
9. **Quick-log defaults synced to Supabase** — user_preferences table, loads remote first, falls back to localStorage
10. **Data export** — /export page, CSV via iOS share sheet, filter by date range + baby (tested on device ✅)
11. **Offline support** — queue to localStorage when offline/network fails, auto-sync on reconnect, pending badge in header
12. **Family page** — view members, invite code, leave family
13. **Settings** — display name, theme (light/dark/system), links to defaults/family/export
14. **UI polish** — sky blue/slate color palette (light + dark mode), dark mode frosted glass fix, 💩 diaper emoji, 3-person family icon, larger header icons (w-8 h-8), daily summary tiles fixed dimensions
15. **Web push notifications** — VAPID-based push for Chrome/Firefox/Safari 16+; service worker, manifest, SW registration, `registerWebPush()`, edge function restructured to run web push independently of APNs

## What is incomplete / pending ⏳
1. **Push notifications (APNs)** — Edge function written (`supabase/functions/send-push/index.ts`), needs:
   - Apple Developer account APNs key (.p8 file, Key ID, Team ID)
   - `npx supabase login && supabase link && supabase functions deploy send-push`
   - Secrets: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_SANDBOX`
   - Supabase Database Webhook: notifications table INSERT → send-push function URL
2. **Web push — needs env setup to go live**:
   - Run `node scripts/generate-vapid-keys.mjs` → copy output to `.env.local`
   - Deploy edge function: `supabase functions deploy send-push`
   - Set secrets: `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com`
   - Verify `push_subscriptions` table has columns: `endpoint`, `keys_p256dh`, `keys_auth`, `user_id`

## Key files
- `app/dashboard/page.tsx` — main screen, quick-log, activity feed, offline queue, realtime
- `app/history/page.tsx` — paginated log history
- `app/notifications/page.tsx` — notifications list
- `app/export/page.tsx` — CSV export
- `app/trends/page.tsx` — charts
- `app/family/page.tsx` — family management
- `app/settings/page.tsx` — user settings
- `lib/supabase/authed-client.ts` — critical auth pattern for Capacitor
- `lib/offline-queue.ts` — offline queue read/write/sync
- `lib/push-notifications.ts` — APNs token registration + web push (`registerWebPush`)
- `supabase/functions/send-push/index.ts` — Edge function for APNs + web push delivery
- `public/sw.js` — service worker: handles push events, shows notifications, handles click
- `public/manifest.json` — PWA manifest (required for push permission prompt)
- `components/sw-register.tsx` — registers service worker on every page load
- `scripts/generate-vapid-keys.mjs` — one-time VAPID key pair generator
- `scripts/` — SQL migration files (run manually in Supabase SQL editor)

## Supabase tables
- `profiles` — user display names
- `families` — family groups with invite codes
- `family_members` — user ↔ family membership
- `babies` — baby profiles
- `feeding_logs`, `sleep_logs`, `diaper_logs` — activity logs
- `notifications` — in-app notification rows
- `device_tokens` — APNs device tokens (platform: ios)
- `user_preferences` — per-user quick-log defaults (quick_prefs JSONB)
- `baby_notes` — freeform notes per baby
- `push_subscriptions` — web push subscriptions (endpoint, keys_p256dh, keys_auth, user_id)
