/**
 * Smoke tests for the three log forms.
 * These verify the forms render and accept input — they do NOT submit
 * (to avoid creating real DB records during testing).
 */
import { test, expect } from "@playwright/test"
import path from "path"
import fs from "fs"

const AUTH_STATE = path.resolve(__dirname, "../.auth/user.json")

test.describe("Log forms (authenticated)", () => {
  test.beforeEach(async ({ page, context }) => {
    if (!fs.existsSync(AUTH_STATE)) test.skip()
    await context.storageState({ path: AUTH_STATE } as any)
    // Dismiss walkthrough so it doesn't block UI interactions
    await page.addInitScript(() => {
      localStorage.setItem("walkthrough-completed", "true")
    })
  })

  test.describe("Feeding log", () => {
    test("renders feeding type selector", async ({ page }) => {
      await page.goto("/log/feeding")
      await page.waitForLoadState("networkidle")
      await expect(page.getByText(/breast/i)).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText(/bottle/i)).toBeVisible()
      await expect(page.getByText(/solid/i)).toBeVisible()
    })

    test("switching to bottle shows amount field", async ({ page }) => {
      await page.goto("/log/feeding")
      await page.waitForLoadState("networkidle")
      await page.getByText(/bottle/i).click()
      // The Amount input has no htmlFor/id pairing, so use placeholder locator
      await expect(page.getByPlaceholder("e.g. 120")).toBeVisible({ timeout: 5_000 })
    })

    test("switching to solid shows food name field", async ({ page }) => {
      await page.goto("/log/feeding")
      await page.waitForLoadState("networkidle")
      await page.getByText(/solid/i).click()
      await expect(page.getByPlaceholder("e.g. Mashed banana")).toBeVisible({ timeout: 5_000 })
    })
  })

  test.describe("Sleep log", () => {
    test("renders sleep form with start time", async ({ page }) => {
      await page.goto("/log/sleep")
      await page.waitForLoadState("networkidle")
      await expect(page.getByText(/sleep/i).first()).toBeVisible({ timeout: 10_000 })
      const timeInput = page.locator("input[type='time'], input[type='number'], input[placeholder*='min'], input[type='datetime-local']").first()
      await expect(timeInput).toBeVisible({ timeout: 8_000 })
    })
  })

  test.describe("Diaper log", () => {
    test("renders diaper type options", async ({ page }) => {
      await page.goto("/log/diaper")
      await page.waitForLoadState("networkidle")
      await expect(page.getByText(/wet/i)).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText(/dirty/i)).toBeVisible()
    })
  })
})

test.describe("Log forms (unauthenticated)", () => {
  test("feeding redirects to login", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    try {
      await page.goto("/login")
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
      await page.goto("/log/feeding")
      await page.waitForURL(/login/, { timeout: 15_000 })
      expect(page.url()).toContain("/login")
    } finally {
      await context.close()
    }
  })

  test("sleep redirects to login", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    try {
      await page.goto("/login")
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
      await page.goto("/log/sleep")
      await page.waitForURL(/login/, { timeout: 15_000 })
      expect(page.url()).toContain("/login")
    } finally {
      await context.close()
    }
  })

  test("diaper redirects to login", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    try {
      await page.goto("/login")
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
      await page.goto("/log/diaper")
      await page.waitForURL(/login/, { timeout: 15_000 })
      expect(page.url()).toContain("/login")
    } finally {
      await context.close()
    }
  })
})
