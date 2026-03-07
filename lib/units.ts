"use client"

import { useState, useEffect } from "react"

export type UnitSystem = "metric" | "imperial"

const KEY = "infant-tracker-units"

export function useUnits() {
  const [units, setUnitsState] = useState<UnitSystem>("metric")

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (stored === "metric" || stored === "imperial") setUnitsState(stored)
  }, [])

  function setUnits(u: UnitSystem) {
    localStorage.setItem(KEY, u)
    setUnitsState(u)
  }

  return { units, setUnits }
}

// Weight
export function kgToLbs(kg: number) { return kg * 2.20462 }
export function lbsToKg(lbs: number) { return lbs / 2.20462 }

// Length
export function cmToIn(cm: number) { return cm / 2.54 }
export function inToCm(inches: number) { return inches * 2.54 }

// Display helpers
export function formatWeight(kg: number, units: UnitSystem) {
  if (units === "imperial") return `${kgToLbs(kg).toFixed(1)} lbs`
  return `${kg} kg`
}

export function formatLength(cm: number, units: UnitSystem) {
  if (units === "imperial") return `${cmToIn(cm).toFixed(1)} in`
  return `${cm} cm`
}

export function weightLabel(units: UnitSystem) { return units === "imperial" ? "lbs" : "kg" }
export function lengthLabel(units: UnitSystem) { return units === "imperial" ? "in" : "cm" }
