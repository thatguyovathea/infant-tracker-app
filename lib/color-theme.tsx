"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type ColorTheme = "slate"

export const COLOR_THEMES: { value: ColorTheme; label: string; preview: string }[] = [
  { value: "slate", label: "Slate", preview: "oklch(0.585 0.233 264)" },
]

const COLOR_THEME_KEY = "infant-tracker-color-theme"

const ColorThemeContext = createContext<{
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}>({ colorTheme: "slate", setColorTheme: () => {} })

function applyTheme(_theme: ColorTheme) {
  // Single theme — no data-theme attribute needed
  document.documentElement.removeAttribute("data-theme")
}

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("slate")

  useEffect(() => {
    // Clear any legacy theme attribute from old coral/sky system
    document.documentElement.removeAttribute("data-theme")
  }, [])

  function setColorTheme(theme: ColorTheme) {
    setColorThemeState(theme)
    localStorage.setItem(COLOR_THEME_KEY, theme)
    applyTheme(theme)
  }

  return (
    <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      {children}
    </ColorThemeContext.Provider>
  )
}

export function useColorTheme() {
  return useContext(ColorThemeContext)
}
