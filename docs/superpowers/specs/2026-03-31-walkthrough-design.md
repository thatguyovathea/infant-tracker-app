# First-Time User Walkthrough — Design Spec

**Date:** 2026-03-31
**Goal:** One-time post-install walkthrough that introduces new users to the Care Tracking dashboard features.

## Summary

A 7-step guided tour shown once after first install. Starts with a centered welcome modal, followed by 6 tooltip callouts pointing at specific dashboard elements. Stored in localStorage so it never repeats.

## Decisions

| Decision | Choice |
|---|---|
| Steps | 7 |
| Welcome modal style | Centered floating card with translucent dimmed backdrop |
| Tooltip style | Solid indigo (#1e1b4b background, #4338ca border, #6366F1 accent) |
| Persistence | localStorage key `walkthrough-completed` |
| Trigger | First dashboard load where `walkthrough-completed` is not set |
| Skip option | "Skip, I'll figure it out" on welcome, "Skip tour" on every tooltip |
| Progress indicator | 7 dots at bottom of each tooltip |

## Step Sequence

### Step 1: Welcome Modal
- **Type:** Centered card over translucent backdrop (`rgba(15,23,42,0.85)` + `backdrop-filter: blur(8px)`)
- **Content:** App icon (🌙) + "Welcome to Care Tracking" + "Track feedings, sleep, and diaper changes — all in one place."
- **Actions:** "Let's take a quick tour" button → advances to step 2. "Skip, I'll figure it out" → dismisses walkthrough entirely.

### Step 2: Quick-Log Buttons
- **Type:** Tooltip with arrow pointing at Eat/Sleep/Change circles
- **Content:** "One tap to log a feeding, sleep, or diaper change. Tap Sleep once to start, tap again to end — we'll track the duration."
- **Points at:** The event circles area (bottom section of dashboard)

### Step 3: Activity Drawer
- **Type:** Tooltip with arrow pointing at "Recent Activity" handle
- **Content:** "Swipe up to see today's activity. Tap any entry to edit or delete it."
- **Points at:** The drawer handle/label area

### Step 4: Weekly Charts
- **Type:** Tooltip with arrow pointing at sparkline chart area
- **Content:** "Your baby's weekly trends at a glance. Tap a chart to see daily breakdowns."
- **Points at:** The Feedings/Sleep 7-day chart section

### Step 5: Family & Adding Babies
- **Type:** Tooltip with arrow pointing at family icon (leftmost bottom nav)
- **Content:** "Manage your family here. Add more children, share an invite code with your partner, and add photos to each profile."
- **Points at:** Family icon in bottom nav bar

### Step 6: Barcode Scanner
- **Type:** Tooltip with arrow pointing at barcode icon (bottom nav)
- **Content:** "Scan any food or diaper barcode to auto-log it. We'll look up the product and check for allergens — no typing needed."
- **Points at:** Barcode scan icon in bottom nav bar

### Step 7: Settings & Done
- **Type:** Tooltip with arrow pointing at gear icon (top right)
- **Content:** "Customize your theme, set quick-log defaults, and export your data anytime. You're all set!"
- **Actions:** "Done" button (instead of "Next") → dismisses walkthrough, sets localStorage flag
- **Points at:** Settings gear icon

## Architecture

### New Files
- `components/walkthrough.tsx` — single component containing all walkthrough logic
- `lib/walkthrough.ts` — localStorage helpers (`hasCompletedWalkthrough()`, `markWalkthroughComplete()`)

### Modified Files
- `app/dashboard/page.tsx` — import and render `<Walkthrough />` component, pass refs for target elements

### Component Design

**`Walkthrough` component:**
- Receives refs to dashboard elements (event circles, drawer handle, charts, bottom nav icons, gear icon)
- Manages internal `step` state (0-6, where 0 = welcome modal)
- Renders either the welcome modal (step 0) or a positioned tooltip (steps 1-6)
- Tooltip positions itself relative to the target ref using `getBoundingClientRect()`
- On mount, checks `hasCompletedWalkthrough()` — if true, renders nothing
- On dismiss (skip or complete), calls `markWalkthroughComplete()` and unmounts

**Tooltip positioning:**
- Calculate target element position via ref.current.getBoundingClientRect()
- Position tooltip above or below target depending on available space
- Arrow points toward the target element
- Dark overlay covers everything except the highlighted element (spotlight cutout)

**Spotlight effect:**
- Full-screen overlay with a transparent cutout around the current target element
- Uses CSS `clip-path` or box-shadow with large spread to create the cutout
- Clicking the overlay outside the tooltip advances to next step (same as "Next" button)

### localStorage API

```typescript
const WALKTHROUGH_KEY = "walkthrough-completed"

export function hasCompletedWalkthrough(): boolean {
  return localStorage.getItem(WALKTHROUGH_KEY) === "true"
}

export function markWalkthroughComplete(): void {
  localStorage.setItem(WALKTHROUGH_KEY, "true")
}
```

## Visual Specs

### Welcome Modal (Step 1)
- Backdrop: `rgba(15, 23, 42, 0.85)` + `backdrop-filter: blur(8px)`
- Card: `background: #1e1b4b`, `border: 1px solid #4338ca`, `border-radius: 24px`
- Icon: 72px rounded square with lavender gradient
- Title: 22px bold white
- Subtitle: 14px rgba(255,255,255,0.6)
- Button: `background: #6366F1`, 15px bold, `border-radius: 12px`
- Skip text: 12px rgba(255,255,255,0.35)

### Tooltips (Steps 2-7)
- Background: `#1e1b4b`
- Border: `1px solid #4338ca`
- Border radius: `16px`
- Box shadow: `0 8px 32px rgba(99, 102, 241, 0.2)`
- Step label: 11px uppercase tracking-wide `#A5B4FC`
- Title: 16px bold white
- Body: 13px `rgba(255,255,255,0.7)` line-height 1.5
- Next button: `background: #6366F1`, 13px bold, `border-radius: 8px`
- Skip text: 12px `rgba(255,255,255,0.4)`
- Progress dots: 6px circles, active = `#6366F1`, inactive = `rgba(255,255,255,0.3)`
- Arrow: 16px rotated square matching tooltip background, pointing toward target

## Out of Scope
- Walkthrough replay from settings (can add later)
- Animated transitions between steps (keep it simple for v1)
- Different walkthrough for returning users
- Localization
