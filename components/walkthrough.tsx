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
    body: "One tap to log a feeding, sleep, or diaper change. Tap Sleep once to start, tap again to end \u2014 we\u2019ll track the duration.",
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
    body: "Scan any food or diaper barcode to auto-log it. We\u2019ll look up the product and check for allergens \u2014 no typing needed.",
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
    const arrowLeft = Math.max(12, Math.min(rect.left + rect.width / 2 - left - 8, tooltipWidth - 28))
    if (config.position === "above") {
      setArrowStyle({
        position: "absolute" as const,
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
        position: "absolute" as const,
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
