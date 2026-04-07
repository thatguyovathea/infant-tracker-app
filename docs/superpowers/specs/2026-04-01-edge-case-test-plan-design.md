# Edge Case Test Plan — Care Tracking App
**Date:** 2026-04-01
**Status:** Approved
**Scope:** 15 automated Playwright E2E edge case tests

---

## Overview

Extend the existing Playwright E2E suite with 15 edge case scenarios covering offline behavior, concurrent family usage, boundary conditions, session expiry, and error states. All tests run against `localhost:3000` using the existing auth setup pattern.

---

## Test File Location

`tests/e2e/edge-cases.test.ts`

---

## Edge Cases

### Group 1 — Form & Navigation State

**EC-01: Exit app mid-input, return and resume**
- Open feeding log form, fill in partial data (amount, no notes)
- Navigate to activity page
- Navigate back to dashboard
- Verify: form is either reset cleanly OR data is preserved (no crash, no stale ghost data)
- Pass: no error, consistent UI state

**EC-02: Submit form at midnight boundary (11:59pm → 12:00am)**
- Set system clock to 11:58pm via mocked Date
- Submit a feeding log
- Advance mock time past midnight, submit another
- Verify: both logs appear under correct dates in activity history
- Pass: no date grouping errors

**EC-03: Max-length text in notes field**
- Enter 500+ characters in a notes field on feeding/diaper/sleep form
- Submit the form
- Verify: either truncated gracefully or full text saved, no crash or silent failure
- Pass: app does not crash, data saved or clear error shown

---

### Group 2 — Offline & Network

**EC-04: Network drops during form submit**
- Fill out a feeding log form completely
- Call `page.context().setOffline(true)` before clicking submit
- Verify: item is added to offline queue (check localStorage key `infant-tracker-offline-queue`)
- Pass: pending badge shown, item in queue

**EC-05: Offline queue syncs on reconnect**
- Queue 2 items while offline
- Restore network via `page.context().setOffline(false)`
- Trigger sync (navigate or wait for auto-sync)
- Verify: queue is empty in localStorage, items appear in activity history
- Pass: all queued items appear in Supabase/UI

**EC-06: Offline queue hits max retries (5)**
- Enqueue an item while offline
- Keep network offline through 5 sync attempts
- Verify: item is removed from queue after 5 failures (not stuck forever)
- Pass: queue cleared, no infinite retry loop

---

### Group 3 — Concurrent Family Usage

**EC-07: Two family members log same baby simultaneously**
- Open two browser contexts sharing the same family
- Both submit a feeding log for the same baby at the same time
- Verify: both logs appear in activity history, no data lost, no 500 error
- Pass: 2 separate log entries exist

**EC-08: Invite code used twice by same user**
- Generate a family invite code
- Use it to join (or attempt to join) the same family twice
- Verify: second attempt is rejected gracefully, no duplicate family_members row
- Pass: error shown to user, no duplicate record in DB

---

### Group 4 — Data & State Edge Cases

**EC-09: Baby with no logs — empty state**
- Create a new baby profile with no activity logged
- Navigate to dashboard with that baby selected
- Verify: empty state UI shown (no crashes, no "undefined" text, no blank screens)
- Pass: clean empty state displayed

**EC-10: Delete baby that has existing logs**
- Log at least one activity for a baby
- Delete that baby profile
- Verify: no orphaned logs cause errors, app does not crash on activity history page
- Pass: app stable after deletion, no DB errors in console

**EC-11: Export CSV with zero logs in date range**
- Select a date range with no activity (e.g., 5 years ago)
- Trigger data export
- Verify: empty CSV downloaded (not a crash or error), file is valid
- Pass: CSV generated with headers only, no error

---

### Group 5 — Auth & Session

**EC-12: Session expires mid-use**
- Authenticate, then manually clear the Supabase session from localStorage
- Attempt to log an activity
- Verify: user is redirected to login, not shown a broken/blank screen
- Pass: clean redirect to `/login`

---

### Group 6 — Barcode Scanner

**EC-13: Barcode scan returns no results**
- Mock the Open Food Facts API to return 404 / empty product
- Trigger a barcode scan
- Verify: "product not found" state shown, app does not crash
- Pass: graceful empty state in scanner modal

**EC-14: Barcode scan returns partial data (missing nutrition fields)**
- Mock Open Food Facts to return a product with name but no nutritional data
- Trigger scan
- Verify: product name shown, missing fields shown as blank/N/A (not crash)
- Pass: partial data displayed cleanly

---

### Group 7 — Push Notifications

**EC-15: Push notification permission denied**
- Mock `Notification.permission = 'denied'`
- Navigate to a page that requests push notification registration
- Verify: app handles denial gracefully, no crash, no infinite permission request loop
- Pass: app continues functioning, no error thrown

---

## Test Infrastructure Notes

- Auth state reused from existing `.auth/user.json` setup
- Offline simulation: `page.context().setOffline(true/false)`
- Network mocking: `page.route()` for barcode API calls
- Concurrent sessions: `browser.newContext()` for second family member
- localStorage inspection: `page.evaluate(() => localStorage.getItem(...))`
- Date mocking: inject via `page.addInitScript()` to override `Date`

---

## Pass Criteria

All 15 tests must pass with:
- No unhandled exceptions in browser console
- No blank/broken UI states
- No data loss or silent failures
- Correct user-facing feedback (error messages, empty states, redirects)
