## Session Rules
- At the END of every session, automatically:
  1. Update this CLAUDE.md file to reflect what was built/changed, new dependencies, and updated status
  2. Stage all modified/new files (`git add`), commit with a descriptive message, and `git push origin main`
  3. Do this without being asked, every single time before the session ends.

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
- @zxing/browser (barcode scanning via WKWebView camera)

## Dev workflow
- Build: `npm run build`
- Sync to iOS: `npx cap sync ios`
- Open Xcode: `npx cap open ios`
- Run on device: select device in Xcode → Run (▶)

## Critical pattern: getAuthedClient()
ALL Supabase DB reads/writes must use `getAuthedClient()` from `@/lib/supabase/authed-client`.
Standard `createClient()` does NOT reliably pass auth headers in Capacitor WKWebView.
Only use `createClient()` for auth calls (getSession, signIn, signOut).

## Supabase client singletons
- `createClient()` is a module-level singleton — returns the same GoTrueClient instance every call
- `getAuthedClient()` is cached per access token — only recreates when token refreshes
- Both patterns are required to avoid "Multiple GoTrueClient instances" warnings

## Critical pattern: .limit(1).maybeSingle()
All `family_members` queries that use `.maybeSingle()` MUST also have `.limit(1)` before it.
Without it, users with duplicate test rows get PGRST116 and are redirected to onboarding.

## RLS Architecture
Supabase has SECURITY DEFINER functions to avoid infinite recursion:
- `get_my_family_id()` — returns the calling user's family_id (used in family_members policies)
- `is_family_member(check_family_id)` — checks if calling user belongs to a family (used in babies, notifications policies)

## Color system
Single Slate/Indigo theme across 3 modes (light/dim/dark). Event colors: feeding=sky, sleep=violet, diaper=emerald. No coral or sky palette — `lib/color-theme.tsx` now has only `"slate"`. Do not re-add old teal/rose/purple event colors.

## Critical pattern: portrait-only
App is locked to portrait on iPhone and iPad via `Info.plist` and `capacitor.config.ts`. Do not add landscape orientations back without a full layout redesign.

## What is complete ✅
1. **Auth** — login, signup, session management
2. **Onboarding** — create family or join with invite code (RLS fixed)
3. **Baby profiles** — add, edit, delete, age display, notes
4. **Quick logging** — one-tap feeding, sleep start/end, diaper from dashboard
5. **Detailed log forms** — /log/feeding, /log/sleep, /log/diaper with full fields
6. **History** — paginated log list with filters, edit, delete (`.limit(1)` fix applied)
7. **Trends** — `/trends` page exists but is no longer linked from the UI (replaced by dashboard sparklines). Feed→Sleep correlation is implemented there but deferred post-launch.
8. **In-app notifications** — bell icon with unread badge, realtime subscription, notifications list page
9. **Quick-log defaults synced to Supabase** — user_preferences table, loads remote first, falls back to localStorage
10. **Data export** — /export page, CSV via iOS share sheet, filter by date range + baby (tested on device ✅)
11. **Offline support** — queue to localStorage when offline/network fails, auto-sync on reconnect, pending badge in header
12. **Family page** — view members, invite code, leave family
13. **Settings** — display name, theme (light/dark/system), links to defaults/family/export
14. **UI polish** — sky blue/slate color palette (light + dark mode), dark mode frosted glass fix, 💩 diaper emoji, 3-person family icon, larger header icons, 30vw event circles (up from 28vw), family icon is now a dropdown (Family + Edit defaults), detail pencil links removed from bottom bar
17. **Dashboard drawer drag gesture** — imperative DOM animation (no React re-renders during drag); drag-up grows content via `maxHeight`; drag-down slides entire drawer (handle + content) via `translateY` so the handle follows the finger; snap with 300ms ease-out transition; tap-to-toggle preserved
15. **Barcode scanning** — @zxing/browser via WKWebView camera; scan icon in dashboard header; auto-categorizes (food → /log/feeding, other → /log/diaper); allergen tags in feeding form; two-tier cache (memory + localStorage, 1yr TTL for hits, 30d for misses); Open Food Facts + UPC Item DB lookup
16. **Push notifications** — APNs JWT auth (.p8 key), device token registration via Capacitor, Supabase Edge Function `send-push`, triggered by DB webhook on notifications INSERT. Tested and working on device 2026-03-13.

## What is incomplete / pending ⏳
- Nothing currently pending

## Audit completed (2026-03-13) ✅
Full codebase audit — no critical issues found. 3 warnings fixed:
- Notification inserts in log/feeding, log/sleep, log/diaper now have `.catch(err => console.error(...))` instead of swallowing errors silently
- Push token retry loop (`lib/push-notifications.ts`) guarded with `savingToken` flag to prevent concurrent executions
- Export date (`app/export/page.tsx`) changed from `setHours` to `setUTCHours` for correct UTC midnight boundary

## Future / planned
- **Inventory tracking** — stock levels for diapers + food, restock notifications, Google Shopping deep-link for deals (full plan in `~/.claude/projects/-Users-rando/memory/inventory-tracking-plan.md`)
- **Feed→Sleep correlation** — post-launch; code in `app/trends/page.tsx`, decide whether to surface in dashboard or revive trends page

## Key files
- `app/dashboard/page.tsx` — main screen, quick-log, activity feed, offline queue, realtime, barcode scan
- `app/history/page.tsx` — paginated log history
- `app/notifications/page.tsx` — notifications list
- `app/export/page.tsx` — CSV export
- `app/trends/page.tsx` — charts
- `app/family/page.tsx` — family management
- `app/settings/page.tsx` — user settings
- `lib/barcode-scanner.ts` — `canScan()` check (uses navigator.mediaDevices)
- `lib/product-lookup.ts` — `lookupFood()` + `lookupGeneral()` with two-tier cache
- `components/barcode-scanner-modal.tsx` — full-screen camera scanner using @zxing/browser
- `lib/supabase/authed-client.ts` — critical auth pattern for Capacitor
- `lib/offline-queue.ts` — offline queue read/write/sync
- `lib/push-notifications.ts` — APNs token registration (iOS only)
- `supabase/functions/send-push/index.ts` — Edge function for APNs delivery
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
