import { test, expect } from "@playwright/test"

test.describe("Login page", () => {
  test("shows sign-in form", async ({ browser }) => {
    // Use clean context so existing auth doesn't redirect away from /login
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    try {
      await page.goto("/login")
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
      await page.goto("/login")
      await page.waitForLoadState("networkidle")

      await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10_000 })
      await expect(page.getByLabel("Email")).toBeVisible()
      await expect(page.getByLabel("Password")).toBeVisible()
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test("shows error on bad credentials", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    try {
      await page.goto("/login")
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
      await page.goto("/login")
      await page.waitForLoadState("networkidle")

      await page.getByLabel("Email").fill("bad@example.com")
      await page.getByLabel("Password").fill("wrongpassword")
      await page.getByRole("button", { name: /sign in/i }).click()
      await expect(page.getByText(/invalid login credentials/i)).toBeVisible({ timeout: 10_000 })
    } finally {
      await context.close()
    }
  })

  test("redirects to dashboard when already logged in", async ({ page, context }) => {
    const fs = await import("fs")
    const AUTH_STATE = require("path").resolve(__dirname, "../.auth/user.json")
    if (!fs.existsSync(AUTH_STATE)) {
      test.skip()
      return
    }
    await context.addCookies(JSON.parse(fs.readFileSync(AUTH_STATE, "utf-8")).cookies ?? [])
    await page.goto("/login")
    await page.waitForURL("**/dashboard", { timeout: 8_000 })
    expect(page.url()).toContain("/dashboard")
  })
})
