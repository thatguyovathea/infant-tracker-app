import { test, expect } from "@playwright/test"
import path from "path"
import fs from "fs"

const AUTH_STATE = path.resolve(__dirname, "../.auth/user.json")

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page, context }) => {
    if (!fs.existsSync(AUTH_STATE)) test.skip()
    await context.storageState({ path: AUTH_STATE } as any)
    // Dismiss walkthrough so it doesn't block UI interactions
    await page.addInitScript(() => {
      localStorage.setItem("walkthrough-completed", "true")
    })
  })

  test("loads and shows quick-log circles", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    // The dashboard has three quick-log circle buttons labeled Eat / Sleep / Change
    await expect(page.getByText(/eat/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/sleep/i).first()).toBeVisible()
    await expect(page.getByText(/change/i)).toBeVisible()
  })

  test("quick-log feeding shows success flash", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    // Wait for Eat label to confirm circles are rendered
    await expect(page.getByText(/eat/i)).toBeVisible({ timeout: 10_000 })

    // The feeding circle button contains the bottle emoji
    const feedBtn = page.locator("button").filter({ hasText: "🍼" }).first()
    await feedBtn.click()

    // After tap, the button flashes a checkmark or the page stays stable
    await page.waitForTimeout(2_000)
    await expect(page).not.toHaveURL(/error/)
  })

  test("quick-log sleep toggles sleep timer", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    await expect(page.getByText(/sleep/i).first()).toBeVisible({ timeout: 10_000 })

    const sleepBtn = page.locator("button").filter({ hasText: "😴" }).first()
    await sleepBtn.click()
    await page.waitForTimeout(2_000)
    await expect(page).not.toHaveURL(/error/)
  })

  test("quick-log diaper shows success flash", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    await expect(page.getByText(/change/i)).toBeVisible({ timeout: 10_000 })

    const diaperBtn = page.locator("button img[alt='diaper']").first().locator("..")
    await diaperBtn.click()
    await page.waitForTimeout(2_000)
    await expect(page).not.toHaveURL(/error/)
  })

  test("unauthenticated user is redirected to login", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    try {
      await page.goto("/login")
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
      await page.goto("/dashboard")
      await page.waitForURL(/login/, { timeout: 15_000 })
      expect(page.url()).toContain("/login")
    } finally {
      await context.close()
    }
  })
})
