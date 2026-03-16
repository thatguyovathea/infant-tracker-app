import { test, expect } from "@playwright/test"
import path from "path"
import fs from "fs"

const AUTH_STATE = path.resolve(__dirname, "../.auth/user.json")

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page, context }) => {
    if (!fs.existsSync(AUTH_STATE)) test.skip()
    await context.storageState({ path: AUTH_STATE } as any)
  })

  test("loads and shows log buttons", async ({ page }) => {
    await page.goto("/dashboard")
    // Wait for the page to settle past any loading state
    await page.waitForLoadState("networkidle")

    // Quick-log buttons should be visible
    await expect(page.getByRole("button", { name: /feeding/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("button", { name: /sleep/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /diaper/i })).toBeVisible()
  })

  test("navigates to feeding log from dashboard", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: /feeding/i }).first().click()
    await expect(page).toHaveURL(/\/log\/feeding/, { timeout: 8_000 })
  })

  test("navigates to sleep log from dashboard", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: /sleep/i }).first().click()
    await expect(page).toHaveURL(/\/log\/sleep/, { timeout: 8_000 })
  })

  test("navigates to diaper log from dashboard", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: /diaper/i }).first().click()
    await expect(page).toHaveURL(/\/log\/diaper/, { timeout: 8_000 })
  })

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForURL("**/login", { timeout: 8_000 })
    expect(page.url()).toContain("/login")
  })
})
