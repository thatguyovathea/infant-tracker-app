import { test, expect } from "@playwright/test"

test.describe("Login page", () => {
  test("shows sign-in form", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
  })

  test("shows error on bad credentials", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("bad@example.com")
    await page.getByLabel("Password").fill("wrongpassword")
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible({ timeout: 10_000 })
  })

  test("redirects to dashboard when already logged in", async ({ page, context }) => {
    // Load saved auth state if available, otherwise skip
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
