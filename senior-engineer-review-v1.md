# Senior Engineer Code Review: Care Tracking (v1.0.0)

**Reviewer**: AI Code Reviewer (comprehensive static analysis)
**Date**: 2026-04-02
**Codebase**: `/Users/rando/v0-infant-tracker-app`
**Commit scope**: Full codebase as of current HEAD

---

## Executive Summary

Care Tracking is a functional infant activity tracking app built with Next.js 16 (static export) + Capacitor 8 for iOS + Supabase backend. The app covers a solid feature set -- quick logging, activity history, family management, push notifications, barcode scanning, offline support, and data export -- and has shipped to App Store Connect.

**The app works.** That is its strongest quality. A solo developer built a real, deployable product with working auth, RLS, push notifications, offline queuing, and 49 E2E tests. That is genuinely impressive.

However, the codebase has accumulated significant technical debt that will make maintenance painful and feature development slow. The dashboard page is a 943-line monolith with 22 `useState` hooks. Type safety is undermined by 15 `eslint-disable` directives that suppress `any` warnings. There are 27 unused Radix UI packages in `package.json` adding 5.3 MB of dead `node_modules`. Several instances violate the project's own documented critical pattern (`.limit(1)` before `.maybeSingle()`). The push notification token save uses `createClient()` instead of `getAuthedClient()`, contradicting the project's most important architectural rule.

**Overall rating: 62/100 -- Ship with conditions.** No showstoppers, but the critical fixes below should be addressed before adding more features or onboarding another developer.

---

## Category 1: Architecture & Project Structure

**Verdict: 3/5**

### Assessment

The project follows Next.js App Router conventions with a flat page structure. All pages are `"use client"` which is correct for a Capacitor static export -- there are no server components, which avoids a whole class of hydration bugs.

The file organization is logical:
- `app/` -- pages, each self-contained
- `lib/` -- shared utilities and Supabase clients
- `components/` -- reusable UI (walkthrough, barcode scanner, session guard, edge swipe)
- `components/ui/` -- shadcn/ui primitives
- `supabase/functions/` -- edge functions
- `scripts/` -- SQL migrations

### Strengths
- Clear separation between auth client (`client.ts`) and data client (`authed-client.ts`)
- SQL migrations are numbered and sequential (001-023)
- Capacitor config is minimal and correct

### Weaknesses

**W1: God component -- `app/dashboard/page.tsx` (943 lines)**
This single file contains: quick-log state, activity feed fetching, stale-while-revalidate cache, realtime subscription, offline queue sync, weekly sparkline chart rendering, drawer drag gesture (imperative DOM manipulation with 15 `useRef` hooks), daily detail sheets, baby picker, barcode scan handler, walkthrough integration, and push notification registration. This file is doing the work of at least 8 components.

**W2: No shared type definitions**
Types like `Baby`, `FeedingLog`, `SleepLog`, `DiaperLog`, `QuickPrefs` are defined inline in multiple files. There is no `types/` directory or shared type module. This means the same shape is hand-duplicated across dashboard, history, family, log forms, and edit pages.

**W3: No data access layer**
Every page directly constructs Supabase queries. There are no repository functions, no query builders, no shared data-fetching hooks. The same `family_members` lookup (`select("family_id").eq("user_id", ...).limit(1).maybeSingle()`) appears in at least 10 files.

### Gap Analysis
- Extract dashboard into sub-components: `QuickLogCircles`, `ActivityDrawer`, `SparklineCharts`, `DailyDetailSheet`, `BabyPicker`
- Create `types/database.ts` with all shared interfaces
- Create `lib/queries.ts` with reusable query functions (`getMyFamilyId()`, `getMyBabies()`, `getActivityFeed()`)

---

## Category 2: Authentication & Security

**Verdict: 3.5/5**

### Assessment

Auth is built on Supabase GoTrueClient with a thoughtful dual-client pattern. The `getAuthedClient()` pattern exists specifically to work around Capacitor WKWebView's inability to reliably pass auth headers. Security hardening has been applied (CSP, session timeout, invite code expiration, rate limiting via SQL).

### Strengths
- `getAuthedClient()` pattern is well-designed for the Capacitor constraint
- RLS uses SECURITY DEFINER functions (`get_my_family_id()`, `is_family_member()`) to avoid infinite recursion -- this is the correct Supabase pattern
- Session timeout at 30 minutes with PII cleanup on expiry (`session-timeout-guard.tsx`)
- Delete-account edge function restricts CORS to app origins
- SQL-level rate limiting on inserts (scripts 017, 018)
- Invite code expiration (script 015)
- Family member limits (script 019)
- Gitleaks pre-commit hook

### Weaknesses

**W4: `push-notifications.ts` uses `createClient()` for DB write (line 31)**
```typescript
const supabase = createClient()
// ...
await supabase.from("device_tokens").upsert(...)
```
This directly violates the project's most critical documented pattern. `CLAUDE.md` line 35-36 states: "ALL Supabase DB reads/writes must use `getAuthedClient()`... Only use `createClient()` for auth calls." This upsert likely succeeds only because the token is in `localStorage` and the client happens to send it, but it is fragile and inconsistent.

**W5: `getAuthedClient()` does not handle token refresh proactively**
The cached client is keyed on `access_token`. If the token expires mid-session, `getAuthedClient()` will return `null` only after `getSession()` returns no session. There is no `onAuthStateChange` listener that invalidates the cache on token refresh. If Supabase's auto-refresh fires and gets a new token, the authed client continues using the old (expired) token until the next call to `getAuthedClient()`.

**W6: CSP allows `unsafe-inline` for both scripts and styles**
```html
<meta http-equiv="Content-Security-Policy" content="... script-src 'self' 'unsafe-inline' ... style-src 'self' 'unsafe-inline' ...">
```
This is documented as a known limitation of Next.js static export, which is fair. But it means CSP provides minimal XSS protection. Worth noting for anyone who believes CSP is a strong defense here -- it is not.

**W7: Settings page delete-account flow does not verify password**
The delete button sends a request to the edge function with just the auth token. There is no re-authentication step (password re-entry or second factor). A stolen session token is sufficient to delete the account.

### Gap Analysis
- Fix `push-notifications.ts` to use `getAuthedClient()`
- Add `onAuthStateChange` listener in `authed-client.ts` to clear cache on token refresh
- Consider adding password re-verification before account deletion

---

## Category 3: Data Layer & Supabase Usage

**Verdict: 3/5**

### Assessment

Supabase is used competently. RLS policies are comprehensive (23 migration scripts). The offline queue is a practical solution for Capacitor's unreliable connectivity. The stale-while-revalidate cache on the dashboard is a good UX pattern.

### Strengths
- Offline queue with retry logic and max 5 attempts (`lib/offline-queue.ts`)
- Stale-while-revalidate pattern with versioned cache key (`dash-cache-v3`)
- Notification inserts are fire-and-forget with `.catch()` -- correct for non-critical side effects
- `Promise.allSettled` for notification read-marking (handles partial failures)
- Family-scoped realtime subscription

### Weaknesses

**W8: Multiple violations of the `.limit(1)` critical pattern**
`CLAUDE.md` line 44-46 documents this as a critical requirement. The following queries use `.maybeSingle()` or `.single()` WITHOUT `.limit(1)`:

| File | Line | Query |
|------|------|-------|
| `app/dashboard/page.tsx` | 59 | `user_preferences...maybeSingle()` |
| `app/dashboard/page.tsx` | 206 | `profiles...maybeSingle()` |
| `app/log/edit/page.tsx` | 327 | `from(table)...eq("id", id).maybeSingle()` |
| `app/log/diaper/page.tsx` | 45 | `profiles...maybeSingle()` |
| `app/log/feeding/page.tsx` | 56 | `profiles...maybeSingle()` |
| `app/log/sleep/page.tsx` | 51 | `profiles...maybeSingle()` |
| `app/settings/page.tsx` | 46 | `profiles...maybeSingle()` |
| `app/settings/defaults/page.tsx` | 69 | `user_preferences...maybeSingle()` |
| `app/onboarding/page.tsx` | 33 | `families...single()` |
| `app/onboarding/baby/page.tsx` | 43 | `family_members...maybeSingle()` |

That is 10 violations of a pattern the project itself calls "critical." While most of these query by primary key (`id`) or user_id (which should be unique), the documented rationale -- "users with duplicate test rows get PGRST116" -- applies equally to all tables.

**W9: History page fetches all three log types for "all" filter**
In `app/history/page.tsx`, when filter is "all", the code fetches `PAGE_SIZE` rows from each of the three tables (feeding, sleep, diaper), merges them client-side, sorts by date, then takes `PAGE_SIZE`. This means 3x the necessary data transfer and becomes worse as tables grow.

**W10: No database-level pagination**
Pagination is cursor-based by date (`started_at < cursor`), which is correct, but the merge-and-sort-client-side approach for "all" filter means the app cannot reliably show exactly `PAGE_SIZE` results -- it fetches `PAGE_SIZE` from each table and truncates.

**W11: Offline queue has no conflict resolution**
If a user logs an event offline, then logs the same event on another device, both records will be created when the queue syncs. There is no deduplication or idempotency key.

### Gap Analysis
- Fix all 10 `.limit(1)` violations
- Create a unified `activity_feed` database view or function that handles pagination server-side
- Add idempotency keys to offline queue entries

---

## Category 4: Code Quality & TypeScript Usage

**Verdict: 2.5/5**

### Assessment

TypeScript is configured with `strict: true`, which is good. But the codebase systematically undermines this with `eslint-disable` directives and inline `any` types.

### Strengths
- `strict: true` in `tsconfig.json`
- Consistent use of async/await (no callback hell)
- Error boundaries in try/catch blocks with user-facing error messages
- `try/finally` pattern in history page to always reset loading spinners

### Weaknesses

**W12: 15 `eslint-disable` directives suppressing `@typescript-eslint/no-explicit-any`**
Distribution:
- `app/log/edit/page.tsx`: 5 occurrences
- `app/history/page.tsx`: 5 occurrences
- `app/dashboard/page.tsx`: 3 occurrences
- `app/family/page.tsx`: 1 occurrence
- `app/trends/page.tsx`: 1 occurrence

These are not edge cases or third-party type gaps. They are core data types (log records, chart data, Supabase responses) that should have proper interfaces.

**W13: No shared type definitions**
The `Baby` type is manually defined in at least 4 files. `QuickPrefs` is defined in at least 3 files. Log record shapes are never formally typed -- they flow as `any` from Supabase queries to component props.

**W14: Giant function bodies**
The `load()` function inside `DashboardPage` is approximately 100 lines. The `handleQuickLog()` function is approximately 120 lines. The `DashboardPage` component itself is 900+ lines with 22 `useState` hooks and 15 `useRef` hooks.

**W15: Inline SVG components**
`GroupIcon` in `app/dashboard/page.tsx` (lines 19-30) is defined inline in the dashboard file. It should live in `components/icons/` or similar.

**W16: Duplicate CSS files**
Both `app/globals.css` and `styles/globals.css` exist. The latter appears to be an old version with different color values (neutral instead of slate/indigo). It is not imported anywhere visible, but its presence is confusing.

### Gap Analysis
- Create `types/database.ts` with interfaces for all Supabase table rows
- Replace all 15 `eslint-disable` directives with proper types
- Extract dashboard into 5-8 sub-components
- Delete `styles/globals.css` if unused

---

## Category 5: UI/UX Implementation

**Verdict: 4/5**

### Assessment

The UI is well-polished for a solo-developer project. The three-mode theme system (light/dim/dark) is thoughtful. The dashboard's imperative drag gesture is technically ambitious and avoids React re-render jank.

### Strengths
- Coherent color system: Slate/Indigo theme with event-specific colors (sky/violet/emerald)
- Three theme modes with oklch colors in CSS custom properties
- Safe area handling for iPhone notch/Dynamic Island (`env(safe-area-inset-*)`)
- 120Hz ProMotion support (`CADisableMinimumFrameDurationOnPhone`)
- Tap delay elimination (`touch-action: manipulation`)
- Frosted glass effects in dark mode
- Walkthrough with spotlight overlay using `clip-path` -- creative implementation
- Dashboard drag gesture uses imperative DOM manipulation (no React re-renders during drag)

### Weaknesses

**W17: `edge-swipe-back.tsx` always navigates to `/dashboard`**
```typescript
router.push("/dashboard")
```
This is not a "back" gesture -- it is a "go to dashboard" gesture. Real back navigation should use `router.back()` or maintain a navigation stack.

**W18: Walkthrough uses entirely inline styles**
`components/walkthrough.tsx` has no Tailwind classes -- everything is `style={{ ... }}`. This is inconsistent with the rest of the codebase and harder to maintain.

**W19: No loading skeleton or shimmer states**
Pages show a "Loading..." text string while fetching. The dashboard uses stale cache to avoid this, but all other pages (history, family, settings, notifications) show plain text loading indicators.

### Gap Analysis
- Fix edge swipe to use `router.back()` or a proper navigation stack
- Convert walkthrough inline styles to Tailwind where possible
- Add skeleton loading states to history, family, and notifications pages

---

## Category 6: Testing

**Verdict: 3/5**

### Assessment

49 E2E tests with Playwright is a solid foundation for a solo project. The tests cover happy paths, auth redirects, and some edge cases (offline, concurrent ops, boundaries).

### Strengths
- Auth setup shares browser state across tests (`auth.setup.ts`)
- Security tests cover route protection, CSP headers, XSS via query params, PII cleanup
- Edge case tests cover offline queuing, concurrent submissions, boundary values
- Tests dismiss walkthrough via `localStorage.setItem` -- pragmatic approach

### Weaknesses

**W20: Zero unit tests**
There are no unit tests for any utility function. `lib/offline-queue.ts`, `lib/product-lookup.ts`, `lib/session-timeout.ts`, `lib/units.ts` all have pure-function logic that is trivially unit-testable but untested.

**W21: No integration tests for Supabase queries**
All database interactions are tested only through E2E browser tests. There are no tests that verify RLS policies actually block cross-family access (the SQL script `test_rls_isolation.sql` exists but must be run manually).

**W22: E2E tests do not verify data persistence**
The log form tests explicitly state "they do NOT submit (to avoid creating real DB records during testing)." The dashboard quick-log test clicks buttons but only checks for a success flash, not that data was actually written.

**W23: No CI pipeline**
Tests are run manually via `set -a && source .env.test.local && set +a && npx playwright test`. There is no GitHub Actions workflow, no pre-push hook, no automated test execution.

### Gap Analysis
- Add unit tests for `offline-queue.ts`, `product-lookup.ts`, `session-timeout.ts`, `units.ts` (Jest or Vitest)
- Add a GitHub Actions workflow that runs tests on push
- Consider a test Supabase project for integration tests

---

## Category 7: iOS / Capacitor Integration

**Verdict: 4/5**

### Assessment

The Capacitor integration is clean. The config is minimal, the WKWebView auth workaround (`getAuthedClient()`) is well-documented, and the app is correctly locked to portrait.

### Strengths
- Portrait lock in both `Info.plist` and `capacitor.config.ts` -- belt and suspenders
- `scrollEnabled: true` for native bounce scroll
- `CADisableMinimumFrameDurationOnPhone` for 120Hz
- Push notifications via APNs with proper JWT signing
- `applicationIconBadgeNumber = 0` on `applicationDidBecomeActive`
- Barcode scanning via `@zxing/browser` (works in WKWebView)
- iOS share sheet for CSV export

### Weaknesses

**W24: `canScan()` checks `navigator.mediaDevices` but WKWebView may not expose it consistently**
```typescript
export function canScan(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices
}
```
This is a best-effort check. WKWebView's camera access depends on `NSCameraUsageDescription` in Info.plist and the iOS permission prompt, not just the presence of `navigator.mediaDevices`.

**W25: No Capacitor plugin for haptic feedback**
Quick-log taps have no haptic response. For a mobile-first app, this is a missed UX opportunity. `@capacitor/haptics` is not in dependencies.

### Gap Analysis
- Consider adding `@capacitor/haptics` for quick-log feedback
- Test `canScan()` on older iOS versions (14, 15) to verify WKWebView compatibility

---

## Category 8: Performance

**Verdict: 3/5**

### Assessment

The dashboard's stale-while-revalidate cache is the standout performance feature. But there are several areas where unnecessary work is done.

### Strengths
- Dashboard SWR cache eliminates loading screen on repeat opens
- `useMemo` for sparkline chart data
- Imperative DOM manipulation for drawer drag (avoids React re-render during gesture)
- Realtime subscription scoped to `family_id` (not all rows)

### Weaknesses

**W26: Dashboard re-fetches all data on every mount**
Despite the SWR cache, the `load()` function always runs on mount and fetches all babies, all activity logs (3 queries), weekly counts (3 queries), and profiles. That is 8+ Supabase queries on every dashboard visit, even if data has not changed. The cache only prevents a loading spinner -- it does not prevent the network requests.

**W27: History page merges 3 tables client-side**
As noted in W9, fetching `PAGE_SIZE` from each table and merging is 3x the necessary bandwidth for the "all" filter.

**W28: Recharts bundle size**
Recharts is a heavy charting library. The dashboard imports `BarChart`, `Bar`, `XAxis`, `Cell`, `ResponsiveContainer` for simple sparkline bars. A custom SVG component would be ~50 lines and save significant bundle weight.

**W29: No image optimization for baby avatars**
Baby photos are stored as data URLs in localStorage. The `baby-avatar.ts` file resizes to 200x200, which is reasonable, but data URLs in localStorage are base64-encoded (33% larger than binary) and are parsed synchronously on every page that reads them.

**W30: 27 unused Radix UI packages (5.3 MB in node_modules)**
Only 4 Radix packages are actually imported (`react-slot`, `react-separator`, `react-label`, `react-tabs`). The other 23 are dead weight. Additionally, `react-hook-form`, `zod`, `cmdk`, `vaul`, `input-otp`, and `react-day-picker` are in `package.json` but never imported anywhere.

### Gap Analysis
- Add ETags or `If-Modified-Since` to dashboard data fetching, or use Supabase realtime for live updates instead of refetch-on-mount
- Remove 23 unused Radix packages and 6 other unused deps from `package.json`
- Consider replacing Recharts with lightweight custom SVG sparklines

---

## Category 9: DevOps & Deployment

**Verdict: 2.5/5**

### Assessment

The deployment pipeline is entirely manual. There is no CI, no automated testing, no automated builds. SQL migrations are run by hand in the Supabase SQL editor.

### Strengths
- Gitleaks pre-commit hook prevents secret commits
- Clear documented workflow in `CLAUDE.md` (`npm run build` -> `npx cap sync ios` -> Xcode)
- `.env.test.local` pattern keeps test credentials out of repo

### Weaknesses

**W31: No CI/CD pipeline**
No GitHub Actions, no automated tests on push, no automated builds. Everything is manual.

**W32: SQL migrations are manual**
23 numbered SQL scripts in `scripts/` must be run manually in the Supabase SQL editor. There is no migration tool (no `supabase db push`, no Prisma, no Drizzle). If a migration is missed or run out of order, there is no rollback mechanism.

**W33: No environment separation**
One Supabase project appears to serve both development and production. The `.env.test.local` file points to the same project (based on context). There is no staging environment.

**W34: Build output (`out/`) is likely not gitignored**
Capacitor syncs from `out/`. If this directory is committed to git, it adds significant repo bloat.

### Gap Analysis
- Add GitHub Actions workflow: lint -> test -> build on every push
- Adopt Supabase CLI for migrations (`supabase db push`)
- Create a separate Supabase project for development/testing
- Verify `out/` is in `.gitignore`

---

## Category 10: Production Readiness

**Verdict: 3/5**

### Assessment

The app has been submitted to App Store Connect and has Sentry error tracking. But several production concerns remain.

### Strengths
- Sentry integration for error tracking (`lib/sentry.ts`, `components/sentry-init.tsx`)
- Privacy policy at `/privacy`
- Account deletion feature (Apple requirement)
- Offline support with queue sync
- Session timeout with PII cleanup

### Weaknesses

**W35: `registrationError` listener is a no-op (line 18, push-notifications.ts)**
```typescript
PushNotifications.addListener("registrationError", () => {})
```
If push registration fails, it is silently swallowed. At minimum this should log to Sentry.

**W36: No retry mechanism for failed Supabase writes (outside offline queue)**
The offline queue handles network failures, but Supabase errors (RLS violations, constraint violations, server errors) on direct writes are shown to the user as a string and that is it. There is no retry, no queuing, no recovery.

**W37: Dashboard realtime subscription may leak**
In `app/dashboard/page.tsx`, the realtime subscription is set up inside `load()`, which runs on every mount. If the component remounts (e.g., React StrictMode in dev, or navigation), multiple subscriptions could be created. The cleanup in `useEffect` return calls `supabase.removeAllChannels()`, but `supabase` here is from `createClient()` (singleton), so it removes channels from a different client than the one that may have created them via `getAuthedClient()`.

**W38: No health check or uptime monitoring**
There is no way to know if the Supabase backend or edge functions are down, other than user reports.

### Gap Analysis
- Log push registration errors to Sentry
- Verify realtime subscription cleanup handles the dual-client pattern correctly
- Add a simple health check endpoint or use Supabase's built-in monitoring

---

## Would I Ship This?

**Yes, with conditions.**

The app is functional and has been through real-device testing. For a v1.0 aimed at a small user base (family and friends beta), it is shippable. The security model is reasonable -- RLS is comprehensive, sessions time out, account deletion works, and the auth pattern handles the Capacitor WKWebView limitation correctly.

However, I would not add significant new features (inventory tracking, gender-based theming) until the following are addressed:

1. The 10 `.limit(1)` violations are fixed (15 minutes of work, prevents a known production bug)
2. `push-notifications.ts` is migrated to `getAuthedClient()` (5 minutes)
3. The dashboard is decomposed into sub-components (2-3 hours, prevents future velocity collapse)
4. Shared types are extracted (1-2 hours, enables safe refactoring)
5. Unused dependencies are removed (10 minutes, reduces supply chain risk and bundle size)

---

## Critical Fixes: Top 10

| Priority | Issue | Effort | Risk if Ignored |
|----------|-------|--------|-----------------|
| **1** | W8: Fix 10 missing `.limit(1)` before `.maybeSingle()`/`.single()` | 15 min | PGRST116 error redirects users to onboarding |
| **2** | W4: `push-notifications.ts` uses `createClient()` for DB write | 5 min | Token save may silently fail under certain auth states |
| **3** | W30: Remove 29 unused npm dependencies | 10 min | Supply chain attack surface, 5.3 MB dead weight |
| **4** | W5: `getAuthedClient()` cache not invalidated on token refresh | 30 min | 401 errors mid-session after token expires |
| **5** | W37: Realtime subscription may leak on remount | 30 min | Memory leak, duplicate event processing |
| **6** | W1: Decompose 943-line dashboard into sub-components | 2-3 hrs | Unmaintainable; any dashboard change is high-risk |
| **7** | W13: Extract shared type definitions | 1-2 hrs | Type drift across files, unsafe refactoring |
| **8** | W16: Delete duplicate `styles/globals.css` | 2 min | Developer confusion |
| **9** | W35: Log push registration errors to Sentry | 5 min | Invisible failures in production |
| **10** | W23: Add GitHub Actions CI pipeline | 1 hr | Regressions ship undetected |

---

## Overall Rating

### 62/100

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Architecture & Structure | 3/5 | 15% | 9.0 |
| Auth & Security | 3.5/5 | 15% | 10.5 |
| Data Layer | 3/5 | 12% | 7.2 |
| Code Quality & TypeScript | 2.5/5 | 12% | 6.0 |
| UI/UX | 4/5 | 10% | 8.0 |
| Testing | 3/5 | 10% | 6.0 |
| iOS/Capacitor | 4/5 | 8% | 6.4 |
| Performance | 3/5 | 8% | 4.8 |
| DevOps | 2.5/5 | 5% | 2.5 |
| Production Readiness | 3/5 | 5% | 3.0 |
| **Total** | | **100%** | **63.4** |

Rounded: **62/100** (accounting for the severity of the `.limit(1)` violations against the project's own documented standards).

**Grade: C+ -- Functional but needs hardening before scale.**

---

## What's Done Well

Credit where due. These are genuinely good engineering decisions:

1. **The `getAuthedClient()` pattern.** Solving WKWebView's auth header problem with a separate Supabase client, cached per access token, is a clean and effective workaround. This is the kind of platform-specific fix that shows real debugging skill.

2. **RLS with SECURITY DEFINER functions.** Using `get_my_family_id()` and `is_family_member()` to avoid RLS infinite recursion is the correct Supabase pattern. Many developers get this wrong.

3. **Imperative drag gesture on the dashboard drawer.** Using `useRef` for DOM manipulation during drag to avoid React re-renders shows understanding of the performance boundary between React state and direct DOM access. This is a pattern senior engineers use.

4. **Stale-while-revalidate cache.** Showing cached data immediately while fetching fresh data in the background is excellent UX for a mobile app with potentially slow connections.

5. **Offline queue with retry budgeting.** The 5-retry max with `bumpRetry()` prevents infinite retry loops. This is a detail many offline implementations miss.

6. **Two-tier barcode cache.** In-memory Map for hot lookups + localStorage for persistence, with separate TTLs for hits (1 year) and misses (30 days), and the rule that network errors are not cached at all. This is thoughtful cache design.

7. **Security hardening breadth.** Session timeout, invite code expiration, rate limiting, family member limits, atomic admin transfer, CORS restrictions on delete-account, audit logging -- the SQL migrations show a systematic approach to security that goes beyond the minimum.

8. **49 E2E tests for a solo project.** Most solo projects have zero tests. Having structured E2E coverage for auth, forms, edge cases, and security is above the norm.

9. **Fire-and-forget notifications with `.catch()`.** Notification inserts are non-critical side effects that should not block the user's action. Using `.then()` with `.catch(console.error)` is the correct pattern here.

10. **Portrait lock in two places.** Both `Info.plist` and `capacitor.config.ts` enforce portrait. If one is accidentally changed, the other still enforces it. Defense in depth.

---

*Review generated from full static analysis of all source files. No source code was modified during this review.*
