"use client"

import { useState, useEffect } from "react"

const KEY_IMAGE = "dashboard-bg-image"
const KEY_OPACITY = "dashboard-bg-opacity"
const KEY_BLUR = "dashboard-bg-blur"

export type DashboardBg = {
  image: string | null
  opacity: number   // 0.05 – 0.45
  blur: number      // 0 – 12 (px)
}

export function useDashboardBg() {
  const [bg, setBg] = useState<DashboardBg>({ image: null, opacity: 0.15, blur: 4 })

  useEffect(() => {
    const image = localStorage.getItem(KEY_IMAGE)
    const opacity = parseFloat(localStorage.getItem(KEY_OPACITY) ?? "0.15")
    const blur = parseFloat(localStorage.getItem(KEY_BLUR) ?? "4")
    setBg({ image, opacity, blur })
  }, [])

  function setImage(dataUrl: string | null) {
    if (dataUrl) localStorage.setItem(KEY_IMAGE, dataUrl)
    else localStorage.removeItem(KEY_IMAGE)
    setBg(prev => ({ ...prev, image: dataUrl }))
  }

  function setOpacity(opacity: number) {
    localStorage.setItem(KEY_OPACITY, String(opacity))
    setBg(prev => ({ ...prev, opacity }))
  }

  function setBlur(blur: number) {
    localStorage.setItem(KEY_BLUR, String(blur))
    setBg(prev => ({ ...prev, blur }))
  }

  return { bg, setImage, setOpacity, setBlur }
}
