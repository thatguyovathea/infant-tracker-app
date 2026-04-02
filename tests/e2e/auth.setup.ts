/**
 * Auth setup — gets a Supabase session directly via API, injects it into
 * localStorage, then saves browser storage state for all other tests.
 *
 * Usage: populate TEST_EMAIL and TEST_PASSWORD in .env.test.local
 */
import { test as setup, expect } from "@playwright/test"
import path from "path"

export const AUTH_STATE = path.resolve(__dirname, "../.auth/user.json")

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.test.local")
}
const STORAGE_KEY = "infant-tracker-auth"

setup("authenticate", async ({ page }) => {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD

  if (!email || !password) {
    throw new Error("Set TEST_EMAIL and TEST_PASSWORD in .env.test.local")
  }

  // Get session token directly from Supabase API (avoids timing issues with browser flow)
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase auth failed: ${res.status} ${body}`)
  }

  const session = await res.json()

  // Navigate to app root to establish the origin in Playwright
  await page.goto("/")
  await page.waitForLoadState("domcontentloaded")

  // Inject session into localStorage under the app's storage key
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value))
  }, { key: STORAGE_KEY, value: session })

  // Navigate to dashboard to verify auth is working
  await page.goto("/dashboard")
  await page.waitForURL("**/dashboard", { timeout: 15_000 })
  expect(page.url()).toContain("/dashboard")

  // Save storage state (now includes the injected session)
  await page.context().storageState({ path: AUTH_STATE })
})
