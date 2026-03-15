"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  onResult: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScannerModal({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState("Point camera at a barcode")

  useEffect(() => {
    let stopped = false
    let stopControls: (() => void) | null = null

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser")
        const reader = new BrowserMultiFormatReader()
        if (!videoRef.current || stopped) return

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result, err) => {
            if (result && !stopped) {
              stopped = true
              stopControls?.()
              onResult(result.getText())
            }
          }
        )
        stopControls = () => controls.stop()
        if (!stopped) setHint("Point camera at a barcode")
      } catch (err) {
        if (!stopped) {
          setError(
            err instanceof Error && err.name === "NotAllowedError"
              ? "Camera permission denied"
              : "Camera unavailable — enter manually"
          )
        }
      }
    }

    start()
    return () => {
      stopped = true
      stopControls?.()
    }
  }, [onResult])

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <p className="text-white font-semibold text-base">Scan barcode</p>
        <button onClick={onClose} className="text-white/80 text-sm font-medium px-3 py-1.5 rounded-lg bg-white/10">
          Cancel
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

        {/* Aim guide overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-4">
          <div className="w-72 h-44 relative">
            {/* Corner markers */}
            {[
              "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
              "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
              "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
              "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
            ].map((cls, i) => (
              <div key={i} className={`absolute w-6 h-6 border-white ${cls}`} />
            ))}
          </div>
          <p className="text-white/70 text-sm">{hint}</p>
        </div>
      </div>

      {error && (
        <div className="p-5 shrink-0">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}
    </div>
  )
}
