"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type ColorTheme = "coral" | "sky"

export const COLOR_THEMES: { value: ColorTheme; label: string; preview: string }[] = [
  { value: "coral", label: "Coral",    preview: "oklch(0.65 0.16 25)" },
  { value: "sky",   label: "Sky Blue", preview: "oklch(0.60 0.19 220)" },
]

const COLOR_THEME_KEY = "infant-tracker-color-theme"

const ColorThemeContext = createContext<{
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}>({ colorTheme: "coral", setColorTheme: () => {} })

function applyTheme(theme: ColorTheme) {
  if (theme === "coral") {
    document.documentElement.removeAttribute("data-theme")
  } else {
    document.documentElement.setAttribute("data-theme", theme)
  }
}

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("coral")

  useEffect(() => {
    const stored = localStorage.getItem(COLOR_THEME_KEY) as ColorTheme | null
    if (stored && COLOR_THEMES.find(t => t.value === stored)) {
      setColorThemeState(stored)
      applyTheme(stored)
    }
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
