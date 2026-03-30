# App Store Launch — "Care Tracking"

**Date:** 2026-03-30
**Goal:** Ship the infant tracker app to the iOS App Store.

## Summary

The app is feature-complete, tested, and audited. This spec covers the remaining work to get it submitted and approved: new app icon, splash screen, app rename, privacy policy, App Store metadata, and the submission workflow.

## Decisions

| Decision | Choice |
|---|---|
| App name | Care Tracking |
| Bundle ID | `com.infanttracker.app` (keep existing) |
| Pricing | Free (with future IAP planned) |
| Age rating | 4+ |
| Icon style | Minimal/modern, soft pastel lavender, moon-baby silhouette |
| Privacy policy | Self-hosted at `/privacy` route within the app |

## Part 1: Code & Asset Changes (Claude handles)

### 1.1 App Icon Swap

- **Source:** `/Users/rando/v0-infant-tracker-app/babyb app icon.png` (1024x1024 PNG)
- **Target:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- Also update `assets/icon.png` (the source-of-truth copy)
- Also update `public/apple-icon.png` (web favicon/apple-touch-icon) — resize to 180x180

### 1.2 Splash Screen Update

Generate new splash screens from the icon to match the new lavender palette:
- Extract the background color from the new icon
- Create centered splash images at:
  - `Default@1x~universal~anyany.png` (2732x2732, light)
  - `Default@2x~universal~anyany.png` (2732x2732, light)
  - `Default@3x~universal~anyany.png` (2732x2732, light)
  - `Default@1x~universal~anyany-dark.png` (2732x2732, dark variant)
  - `Default@2x~universal~anyany-dark.png` (2732x2732, dark variant)
  - `Default@3x~universal~anyany-dark.png` (2732x2732, dark variant)
- Light: match icon's pastel lavender background with white moon-baby centered
- Dark: darker lavender/purple background with same moon-baby motif

### 1.3 App Rename

Update the display name from "Infant Tracker" to "Care Tracking" in:
- `capacitor.config.ts` → `appName: "Care Tracking"`
- `ios/App/App/Info.plist` → `CFBundleDisplayName` (if present)
- Xcode project display name (via Info.plist)
- `package.json` → `name` field (kebab-case: `care-tracking`)

**Note:** Bundle ID stays `com.infanttracker.app` — changing it would break push notification entitlements and Supabase config.

### 1.4 Privacy Policy Page

Add a new route `/privacy` with a static privacy policy covering:
- What data is collected (email, baby info, feeding/sleep/diaper logs)
- How data is stored (Supabase/PostgreSQL, encrypted in transit)
- Family sharing (data shared within family groups only)
- Camera usage (barcode scanning only, no images stored)
- Push notifications (device tokens stored for delivery)
- No third-party analytics or advertising
- No data sold to third parties
- Contact information for privacy questions
- Data deletion: users can delete their account and all data

This page must be accessible without authentication (for Apple review).

### 1.5 Build & Sync

- `npm run build` — static export to `/out`
- `npx cap sync ios` — sync to Xcode project
- Verify clean build in Xcode (no warnings/errors)

### 1.6 Version Bump

- Set `MARKETING_VERSION` to `1.0.0` and `CURRENT_PROJECT_VERSION` to `1` in Xcode
- Ensure these match what will be set in App Store Connect

## Part 2: App Store Connect Setup (User handles, with guidance)

### 2.1 Create App in App Store Connect

- Log in to https://appstoreconnect.apple.com
- New App → iOS → Bundle ID: `com.infanttracker.app` → Name: "Care Tracking"
- Primary language: English (U.S.)
- SKU: `care-tracking-001`

### 2.2 App Store Metadata

**Category:** Health & Fitness (primary), Lifestyle (secondary)

**Subtitle (30 chars max):** "Baby feeding, sleep & diaper"

**Description (draft):**
Track your baby's feeding, sleep, and diaper changes with ease. Care Tracking helps families stay on top of their infant's daily routine.

- Log feedings (breast, bottle, solid food) with duration and notes
- Track sleep sessions with start/end times
- Record diaper changes
- View activity history and trends
- Share with your partner or family via invite codes
- Real-time notifications when family members log activities
- Export data as CSV
- Scan food barcodes to check allergens
- Works offline — syncs automatically when back online

Simple, private, and built for tired parents.

**Keywords (100 chars max):** baby,infant,tracker,feeding,sleep,diaper,breastfeeding,newborn,family,parenting

**Support URL:** GitHub repo or a simple contact page
**Privacy Policy URL:** `https://<deployed-domain>/privacy`

### 2.3 Screenshots

Required sizes (at minimum):
- **6.7" iPhone** (1290x2796) — iPhone 15 Pro Max simulator
- **6.5" iPhone** (1284x2778) — iPhone 14 Plus simulator (optional but recommended)
- **5.5" iPhone** (1242x2208) — iPhone 8 Plus simulator (required if supporting older devices)

Recommended screenshots (5-8):
1. Dashboard with quick-log buttons
2. Feeding log form
3. Activity history
4. Family sharing / invite code
5. Barcode scanner in action

Take these from the iOS Simulator using Cmd+S.

### 2.4 App Review Information

- Contact info: your name, email, phone
- Demo account: provide test credentials Apple reviewers can use
  - Create a test account in Supabase with a pre-configured family + baby
- Notes for reviewer: "This app requires creating a family or joining one with an invite code during onboarding. A test account is provided with an existing family."

### 2.5 Archive & Upload

1. In Xcode: Product → Archive
2. Window → Organizer → Distribute App → App Store Connect
3. Upload
4. Back in App Store Connect: select the build, submit for review

## Out of Scope

- In-app purchases (future)
- iPad-specific layout optimization
- Android build
- Custom domain for privacy policy (can use GitHub Pages or the app's Vercel/deployed URL)

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Apple rejects for WKWebView (Capacitor) | Capacitor 8 apps are routinely approved; ensure no UIWebView references |
| Push notification entitlement mismatch | Already set to `production` in App.entitlements; match in App Store Connect |
| Privacy policy not accessible | Host at public URL, verify before submission |
| Camera permission without clear purpose | Info.plist already has camera usage description for barcode scanning |
| Name "Care Tracking" already taken | Check availability in App Store Connect before proceeding |
