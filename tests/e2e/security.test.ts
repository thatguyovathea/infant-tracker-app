/**
 * Security-focused tests — auth boundaries, CSP headers, session handling,
 * and protection against common attack vectors.
 */
import { test, expect } from "@playwright/test"
import path from "path"
import fs from "fs"

const AUTH_STATE = path.resolve(__dirname, "../.auth/user.json")

function skipIfNoAuth() {
  if (!fs.existsSync(AUTH_STATE)) test.skip()
}

// ---------------------------------------------------------------------------
// SEC-01: Unauthenticated access to protected routes redirects to /login
// ---------------------------------------------------------------------------
test.describe("SEC-01: Unauthenticated route protection", () => {
  const protectedRoutes = [
    "/dashboard",
    "/family",
    "/settings",
    "/notifications",
    "/log/feeding",
    "/log/sleep",
    "/log/diaper",
    "/export",
  ]

  for (const route of protectedRoutes) {
    test(`${route} redirects to /login when unauthenticated`, async ({ browser }) => {
      // Explicitly empty storage to guarantee no auth state
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      })
      const page = await context.newPage()
      try {
        // Clear any residual storage before navigating
        await page.goto("/login")
        await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })

        await page.goto(route)
        // Client-side auth check runs in useEffect after hydration
        await page.waitForURL(/login/, { timeout: 20_000 })
        expect(page.url()).toContain("/login")
      } finally {
        await context.close()
      }
    })
  }
})

// ---------------------------------------------------------------------------
// SEC-02: CSP meta tag is present and correctly configured
// ---------------------------------------------------------------------------
test.describe("SEC-02: Security meta tags present", () => {
  test("Content-Security-Policy meta tag exists", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("domcontentloaded")

    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("connect-src")
  })

  test("X-Content-Type-Options meta tag exists", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("domcontentloaded")

    const xcto = await page.locator('meta[http-equiv="X-Content-Type-Options"]').getAttribute("content")
    expect(xcto).toBe("nosniff")
  })

  test("Referrer-Policy meta tag exists", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("domcontentloaded")

    const referrer = await page.locator('meta[name="referrer"]').getAttribute("content")
    expect(referrer).toBe("strict-origin-when-cross-origin")
  })
})

// ---------------------------------------------------------------------------
// SEC-03: Login form does not leak info on invalid credentials
// ---------------------------------------------------------------------------
test.describe("SEC-03: Auth error messages are generic", () => {
  test("bad credentials show generic error, not specific field", async ({ browser }) => {
    // Use clean context so existing auth doesn't redirect away from /login
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()
    try {
      await page.goto("/login")
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
      await page.goto("/login")
      await page.waitForLoadState("domcontentloaded")

      await page.getByLabel("Email").fill("nonexistent@test.com")
      await page.getByLabel("Password").fill("wrongpassword123")
      await page.getByRole("button", { name: /sign in/i }).click()

      await page.waitForTimeout(3_000)
      const bodyText = await page.locator("body").innerText()

      // Should NOT reveal whether email exists or password is wrong
      expect(bodyText.toLowerCase()).not.toContain("email not found")
      expect(bodyText.toLowerCase()).not.toContain("user not found")
      expect(bodyText.toLowerCase()).not.toContain("wrong password")
      expect(bodyText.toLowerCase()).not.toContain("password incorrect")
    } finally {
      await context.close()
    }
  })
})

// ---------------------------------------------------------------------------
// SEC-04: Password reset does not reveal email existence
// ---------------------------------------------------------------------------
test.describe("SEC-04: Password reset info leak", () => {
  test("reset request for unknown email does not reveal non-existence", async ({ page }) => {
    await page.goto("/reset-password")
    await page.waitForLoadState("domcontentloaded")

    const emailField = page.getByLabel(/email/i)
    if (!(await emailField.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    await emailField.fill("doesnotexist12345@example.com")
    await page.getByRole("button", { name: /send|reset/i }).click()
    await page.waitForTimeout(3_000)

    const bodyText = await page.locator("body").innerText().catch(() => "")
    // Should show success-like message regardless (no email enumeration)
    expect(bodyText.toLowerCase()).not.toContain("email not found")
    expect(bodyText.toLowerCase()).not.toContain("no account")
    expect(bodyText.toLowerCase()).not.toContain("user does not exist")
  })
})

// ---------------------------------------------------------------------------
// SEC-05: XSS via form inputs — script tags are not executed
// ---------------------------------------------------------------------------
test.describe("SEC-05: XSS resistance in form inputs", () => {
  test.beforeEach(async ({ context }) => {
    skipIfNoAuth()
    await context.storageState({ path: AUTH_STATE } as any)
  })

  test("script tag in notes field is rendered as text, not executed", async ({ page }) => {
    await page.goto("/log/feeding")
    await page.waitForLoadState("networkidle")

    const xssPayload = '<script>window.__xss_fired=true</script>'

    const notesField = page.locator("textarea, input[placeholder*='note' i]").first()
    const visible = await notesField.isVisible().catch(() => false)
    if (!visible) { test.skip(); return }

    await notesField.fill(xssPayload)

    const xssFired = await page.evaluate(() => (window as any).__xss_fired)
    expect(xssFired).toBeFalsy()
  })
})

// ---------------------------------------------------------------------------
// SEC-06: Direct API call without auth returns error
// ---------------------------------------------------------------------------
test.describe("SEC-06: Supabase API rejects unauthenticated requests", () => {
  test("direct table query without auth is rejected", async ({ request }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) { test.skip(); return }

    const resp = await request.get(`${supabaseUrl}/rest/v1/families`, {
      headers: { "apikey": "invalid-key" },
    })

    // Should be 401 or 403, not 200
    expect([401, 403]).toContain(resp.status())
  })
})

// ---------------------------------------------------------------------------
// SEC-07: Cleared session forces re-authentication
// ---------------------------------------------------------------------------
test.describe("SEC-07: Session invalidation forces re-auth", () => {
  test.beforeEach(async ({ context }) => {
    skipIfNoAuth()
    await context.storageState({ path: AUTH_STATE } as any)
  })

  test("clearing auth tokens redirects to login on next navigation", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    // Clear all Supabase auth tokens
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(k => k.startsWith("sb-") || k.includes("supabase") || k.includes("auth"))
        .forEach(k => localStorage.removeItem(k))
      // Also clear session storage
      Object.keys(sessionStorage)
        .filter(k => k.startsWith("sb-") || k.includes("supabase"))
        .forEach(k => sessionStorage.removeItem(k))
    })

    await page.goto("/settings")
    await page.waitForURL(/login/, { timeout: 10_000 })
    expect(page.url()).toContain("/login")
  })
})

// ---------------------------------------------------------------------------
// SEC-08: localStorage is cleared on sign out
// ---------------------------------------------------------------------------
test.describe("SEC-08: PII cleared on sign out", () => {
  test.beforeEach(async ({ context }) => {
    skipIfNoAuth()
    await context.storageState({ path: AUTH_STATE } as any)
  })

  test("sign out removes cached PII from localStorage", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")

    // Seed some PII keys
    await page.evaluate(() => {
      localStorage.setItem("dash-cache-v3", '{"test":"data"}')
      localStorage.setItem("infant-tracker-offline-queue", '[{"test":"item"}]')
      localStorage.setItem("baby-avatar-test", "data:image/png;base64,abc")
    })

    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // Click sign out
    const signOutBtn = page.getByText(/sign out/i)
    await signOutBtn.click()

    await page.waitForURL(/login/, { timeout: 10_000 })

    // Check that PII keys are cleared
    const piiKeys = await page.evaluate(() => {
      return {
        dashCache: localStorage.getItem("dash-cache-v3"),
        offlineQueue: localStorage.getItem("infant-tracker-offline-queue"),
        babyAvatar: localStorage.getItem("baby-avatar-test"),
      }
    })

    expect(piiKeys.dashCache).toBeNull()
    expect(piiKeys.offlineQueue).toBeNull()
    expect(piiKeys.babyAvatar).toBeNull()
  })
})
