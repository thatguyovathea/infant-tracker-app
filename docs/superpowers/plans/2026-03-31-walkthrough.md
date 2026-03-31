# First-Time User Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 7-step one-time walkthrough (welcome modal + 6 tooltip callouts) shown on first dashboard load after install.

**Architecture:** Two new files (`lib/walkthrough.ts` for localStorage helpers, `components/walkthrough.tsx` for the UI) plus minor changes to `app/dashboard/page.tsx` to attach refs and render the component. The walkthrough uses `getBoundingClientRect()` to position tooltips relative to dashboard elements, with a spotlight overlay that highlights the current target.

**Tech Stack:** React 19, TypeScript, Tailwind CSS (inline styles for walkthrough-specific visuals to avoid polluting the global stylesheet)

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `lib/walkthrough.ts` | localStorage read/write helpers |
| Create | `components/walkthrough.tsx` | Welcome modal + tooltip component, all 7 steps |
| Modify | `app/dashboard/page.tsx` | Add refs to 6 target elements, render `<Walkthrough />` |

---

### Task 1: Create localStorage Helpers

**Files:**
- Create: `lib/walkthrough.ts`

- [ ] **Step 1: Create the walkthrough localStorage module**

```typescript
// lib/walkthrough.ts
const WALKTHROUGH_KEY = "walkthrough-completed"

export function hasCompletedWalkthrough(): boolean {
  try {
    return localStorage.getItem(WALKTHROUGH_KEY) === "true"
  } catch {
    return true // If localStorage unavailable, skip walkthrough
  }
}

export function markWalkthroughComplete(): void {
  try {
    localStorage.setItem(WALKTHROUGH_KEY, "true")
  } catch {
    // localStorage unavailable
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/rando/v0-infant-tracker-app
git add lib/walkthrough.ts
git commit -m "feat: add walkthrough localStorage helpers"
```

---

### Task 2: Create the Walkthrough Component

**Files:**
- Create: `components/walkthrough.tsx`

This is the main component. It renders either the welcome modal (step 0) or a positioned tooltip (steps 1–6) with a spotlight overlay highlighting the target element.

- [ ] **Step 1: Create the walkthrough component**

```tsx
// components/walkthrough.tsx
"use client"

import { useState, useEffect, useCallback, RefObject } from "react"
import { hasCompletedWalkthrough, markWalkthroughComplete } from "@/lib/walkthrough"

type StepConfig = {
  title: string
  body: string
  position: "above" | "below"
}

const STEPS: StepConfig[] = [
  { title: "", body: "", position: "above" }, // Step 0 = welcome modal, not used here
  {
    title: "Quick Logging",
    body: "One tap to log a feeding, sleep, or diaper change. Tap Sleep once to start, tap again to end — we\u2019ll track the duration.",
    position: "above",
  },
  {
    title: "Activity Drawer",
    body: "Swipe up to see today\u2019s activity. Tap any entry to edit or delete it.",
    position: "above",
  },
  {
    title: "Weekly Trends",
    body: "Your baby\u2019s weekly trends at a glance. Tap a chart to see daily breakdowns.",
    position: "below",
  },
  {
    title: "Family & Babies",
    body: "Manage your family here. Add more children, share an invite code with your partner, and add photos to each profile.",
    position: "above",
  },
  {
    title: "Barcode Scanner",
    body: "Scan any food or diaper barcode to auto-log it. We\u2019ll look up the product and check for allergens — no typing needed.",
    position: "above",
  },
  {
    title: "Settings",
    body: "Customize your theme, set quick-log defaults, and export your data anytime. You\u2019re all set!",
    position: "below",
  },
]

type WalkthroughProps = {
  refs: {
    eventCircles: RefObject<HTMLDivElement | null>
    drawerHandle: RefObject<HTMLDivElement | null>
    charts: RefObject<HTMLDivElement | null>
    familyIcon: RefObject<HTMLButtonElement | null>
    scanIcon: RefObject<HTMLButtonElement | null>
    settingsIcon: RefObject<HTMLButtonElement | null>
  }
}

export function Walkthrough({ refs }: WalkthroughProps) {
  const [step, setStep] = useState(-1) // -1 = not started / already completed
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({})
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (hasCompletedWalkthrough()) return
    // Small delay so the dashboard finishes rendering
    const t = setTimeout(() => setStep(0), 600)
    return () => clearTimeout(t)
  }, [])

  const refForStep = useCallback((s: number): RefObject<HTMLElement | null> | null => {
    switch (s) {
      case 1: return refs.eventCircles as RefObject<HTMLElement | null>
      case 2: return refs.drawerHandle as RefObject<HTMLElement | null>
      case 3: return refs.charts as RefObject<HTMLElement | null>
      case 4: return refs.familyIcon as RefObject<HTMLElement | null>
      case 5: return refs.scanIcon as RefObject<HTMLElement | null>
      case 6: return refs.settingsIcon as RefObject<HTMLElement | null>
      default: return null
    }
  }, [refs])

  useEffect(() => {
    if (step < 1) return
    const ref = refForStep(step)
    if (!ref?.current) return

    const rect = ref.current.getBoundingClientRect()
    setSpotlightRect(rect)

    const config = STEPS[step]
    const padding = 12
    const tooltipWidth = 300

    // Center tooltip horizontally over target, clamped to screen edges
    let left = rect.left + rect.width / 2 - tooltipWidth / 2
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12))

    if (config.position === "above") {
      setTooltipStyle({
        position: "fixed",
        left,
        bottom: window.innerHeight - rect.top + padding,
        width: tooltipWidth,
        zIndex: 10002,
      })
    } else {
      setTooltipStyle({
        position: "fixed",
        left,
        top: rect.bottom + padding,
        width: tooltipWidth,
        zIndex: 10002,
      })
    }

    // Arrow pointing at target center
    const arrowLeft = rect.left + rect.width / 2 - left - 8
    if (config.position === "above") {
      setArrowStyle({
        position: "absolute",
        bottom: -8,
        left: arrowLeft,
        width: 16,
        height: 16,
        background: "#1e1b4b",
        border: "1px solid #4338ca",
        borderTop: "none",
        borderLeft: "none",
        transform: "rotate(45deg)",
      })
    } else {
      setArrowStyle({
        position: "absolute",
        top: -8,
        left: arrowLeft,
        width: 16,
        height: 16,
        background: "#1e1b4b",
        border: "1px solid #4338ca",
        borderBottom: "none",
        borderRight: "none",
        transform: "rotate(45deg)",
      })
    }
  }, [step, refForStep])

  const advance = useCallback(() => {
    if (step >= 6) {
      markWalkthroughComplete()
      setStep(-1)
    } else {
      setStep(s => s + 1)
    }
  }, [step])

  const dismiss = useCallback(() => {
    markWalkthroughComplete()
    setStep(-1)
  }, [])

  if (step === -1) return null

  // Step 0: Welcome modal
  if (step === 0) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#1e1b4b", border: "1px solid #4338ca",
            borderRadius: 24, padding: "36px 28px", color: "white",
            textAlign: "center", width: 300, maxWidth: "90vw",
            boxShadow: "0 16px 48px rgba(99, 102, 241, 0.25)",
          }}
        >
          <div
            style={{
              width: 72, height: 72, borderRadius: 18,
              background: "linear-gradient(135deg, #e8dff0, #c4b4d8)",
              margin: "0 auto 20px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36,
            }}
          >
            🌙
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
            Welcome to<br />Care Tracking
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: 28 }}>
            Track feedings, sleep, and diaper changes — all in one place.
          </div>
          <button
            onClick={() => setStep(1)}
            style={{
              background: "#6366F1", color: "white", border: "none",
              padding: "14px 24px", borderRadius: 12, fontSize: 15,
              fontWeight: 600, cursor: "pointer", width: "100%",
            }}
          >
            Let&apos;s take a quick tour
          </button>
          <div
            onClick={dismiss}
            style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 14, cursor: "pointer" }}
          >
            Skip, I&apos;ll figure it out
          </div>
        </div>
      </div>
    )
  }

  // Steps 1-6: Tooltip with spotlight
  const config = STEPS[step]
  const sr = spotlightRect
  const spotlightPad = 8

  return (
    <>
      {/* Spotlight overlay */}
      <div
        onClick={advance}
        style={{
          position: "fixed", inset: 0, zIndex: 10001,
          background: "rgba(15, 23, 42, 0.75)",
          ...(sr ? {
            clipPath: `polygon(
              0% 0%, 0% 100%,
              ${sr.left - spotlightPad}px 100%,
              ${sr.left - spotlightPad}px ${sr.top - spotlightPad}px,
              ${sr.right + spotlightPad}px ${sr.top - spotlightPad}px,
              ${sr.right + spotlightPad}px ${sr.bottom + spotlightPad}px,
              ${sr.left - spotlightPad}px ${sr.bottom + spotlightPad}px,
              ${sr.left - spotlightPad}px 100%,
              100% 100%, 100% 0%
            )`,
          } : {}),
        }}
      />

      {/* Tooltip */}
      <div style={{ ...tooltipStyle, position: "fixed" }}>
        <div
          style={{
            position: "relative",
            background: "#1e1b4b", border: "1px solid #4338ca",
            borderRadius: 16, padding: 20, color: "white",
            boxShadow: "0 8px 32px rgba(99, 102, 241, 0.2)",
          }}
        >
          <div style={arrowStyle} />
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#A5B4FC", marginBottom: 8 }}>
            Step {step + 1} of 7
          </div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
            {config.title}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
            {config.body}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <div onClick={dismiss} style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
              Skip tour
            </div>
            <button
              onClick={advance}
              style={{
                background: "#6366F1", color: "white", border: "none",
                padding: "8px 20px", borderRadius: 8, fontSize: 13,
                fontWeight: 600, cursor: "pointer",
              }}
            >
              {step === 6 ? "Done" : "Next"}
            </button>
          </div>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: i === step ? "#6366F1" : "rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/rando/v0-infant-tracker-app
git add components/walkthrough.tsx
git commit -m "feat: create Walkthrough component with welcome modal + 6 tooltip steps"
```

---

### Task 3: Wire Walkthrough into the Dashboard

**Files:**
- Modify: `app/dashboard/page.tsx`

We need to:
1. Add 5 new refs (eventCircles, charts, familyIcon, scanIcon, settingsIcon) — drawerHandleRef already exists
2. Attach those refs to the correct DOM elements
3. Import and render `<Walkthrough />`

- [ ] **Step 1: Add imports at the top of dashboard/page.tsx**

After the existing imports (around line 16), add:

```typescript
import { Walkthrough } from "@/components/walkthrough"
```

- [ ] **Step 2: Add new refs**

After the existing `useRef` declarations (around line 158), add:

```typescript
const eventCirclesRef = useRef<HTMLDivElement>(null)
const chartsRef = useRef<HTMLDivElement>(null)
const familyIconRef = useRef<HTMLButtonElement>(null)
const scanIconRef = useRef<HTMLButtonElement>(null)
const settingsIconRef = useRef<HTMLButtonElement>(null)
```

- [ ] **Step 3: Attach settingsIcon ref**

On line 572, the settings button:

Change:
```tsx
<button className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted" onClick={() => router.push("/settings")}>
```
To:
```tsx
<button ref={settingsIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted" onClick={() => router.push("/settings")}>
```

- [ ] **Step 4: Attach charts ref**

On line 619, the charts container div:

Change:
```tsx
<div className={`flex flex-col overflow-hidden transition-all duration-300 ${drawerOpen ? "max-h-0 opacity-0" : "flex-1 min-h-0 opacity-100"}`}>
```
To:
```tsx
<div ref={chartsRef} className={`flex flex-col overflow-hidden transition-all duration-300 ${drawerOpen ? "max-h-0 opacity-0" : "flex-1 min-h-0 opacity-100"}`}>
```

- [ ] **Step 5: Attach eventCircles ref**

On line 782, the event circles container:

Change:
```tsx
<div className="relative z-10 shrink-0 border-t bg-background">
  <div className="px-4 pt-3 pb-3 max-w-lg mx-auto w-full">
    <div className="flex justify-evenly items-start">
```
To:
```tsx
<div className="relative z-10 shrink-0 border-t bg-background">
  <div className="px-4 pt-3 pb-3 max-w-lg mx-auto w-full">
    <div ref={eventCirclesRef} className="flex justify-evenly items-start">
```

- [ ] **Step 6: Attach familyIcon ref**

On line 826, the family button:

Change:
```tsx
<button className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => router.push("/family")}>
```
To:
```tsx
<button ref={familyIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => router.push("/family")}>
```

- [ ] **Step 7: Attach scanIcon ref**

On line 833, the barcode scan button (inside the `canScan()` conditional):

Change:
```tsx
<button className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => setScanning(true)}>
```
To:
```tsx
<button ref={scanIconRef} className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted active:opacity-60" onClick={() => setScanning(true)}>
```

- [ ] **Step 8: Render the Walkthrough component**

Add this immediately before the closing `</div>` of the outermost container (before the `{/* Daily detail sheet */}` section, around line 847), after the bottom ribbon `</div>`:

```tsx
<Walkthrough refs={{
  eventCircles: eventCirclesRef,
  drawerHandle: drawerHandleRef,
  charts: chartsRef,
  familyIcon: familyIconRef,
  scanIcon: scanIconRef,
  settingsIcon: settingsIconRef,
}} />
```

- [ ] **Step 9: Commit**

```bash
cd /Users/rando/v0-infant-tracker-app
git add app/dashboard/page.tsx
git commit -m "feat: wire walkthrough component into dashboard with element refs"
```

---

### Task 4: Build, Sync & Verify

- [ ] **Step 1: Build**

```bash
cd /Users/rando/v0-infant-tracker-app && npm run build
```

Expected: clean build, all 20 routes compile.

- [ ] **Step 2: Sync to iOS**

```bash
npx cap sync ios
```

- [ ] **Step 3: Test in simulator**

Rebuild in Xcode (Cmd+R). To test the walkthrough:
- Open Safari → Develop → Simulator → Console
- In the console, run: `localStorage.removeItem("walkthrough-completed")`
- Reload the app (or navigate away and back to dashboard)
- The welcome modal should appear
- Click through all 7 steps and verify tooltips point at the correct elements
- On step 7, clicking "Done" should dismiss and set the localStorage flag
- Reloading should NOT show the walkthrough again

- [ ] **Step 4: Commit build artifacts**

```bash
cd /Users/rando/v0-infant-tracker-app
git add -A
git commit -m "chore: build and sync walkthrough to iOS"
```

- [ ] **Step 5: Push**

```bash
git push origin main
```
