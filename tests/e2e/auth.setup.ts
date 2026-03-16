/**
 * Auth setup — logs in once and saves the browser storage state.
 * Other tests load this state so they skip the login flow.
 *
 * Usage: populate TEST_EMAIL and TEST_PASSWORD in .env.test.local
 */
import { test as setup, expect } from "@playwright/test"
import path from "path"

export const AUTH_STATE = path.resolve(__dirname, "../.auth/user.json")

setup("authenticate", async ({ page }) => {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD

  if (!email || !password) {
    throw new Error("Set TEST_EMAIL and TEST_PASSWORD in .env.test.local")
  }

  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()

  // Wait until redirected to dashboard
  await page.waitForURL("**/dashboard", { timeout: 15_000 })
  expect(page.url()).toContain("/dashboard")

  await page.context().storageState({ path: AUTH_STATE })
})
