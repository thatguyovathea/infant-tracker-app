# App Store Launch — "Care Tracking" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the infant tracker app for App Store submission — new icon, splash screens, app rename, privacy policy page, version bump, and clean build.

**Architecture:** Static Next.js 16 app (output: "export") wrapped in Capacitor 8 for iOS. All pages are "use client" with client-side auth checks. The `/privacy` page is the only unauthenticated route. Assets live in `ios/App/App/Assets.xcassets/` and get synced via `npx cap sync ios`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Capacitor 8, sips (macOS image tool)

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Modify | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | New app icon (1024x1024) |
| Modify | `assets/icon.png` | Source-of-truth icon copy |
| Modify | `public/apple-icon.png` | Web apple-touch-icon (180x180) |
| Modify | `ios/App/App/Assets.xcassets/Splash.imageset/Default@1x~universal~anyany.png` | Light splash 1x |
| Modify | `ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany.png` | Light splash 2x |
| Modify | `ios/App/App/Assets.xcassets/Splash.imageset/Default@3x~universal~anyany.png` | Light splash 3x |
| Modify | `ios/App/App/Assets.xcassets/Splash.imageset/Default@1x~universal~anyany-dark.png` | Dark splash 1x |
| Modify | `ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany-dark.png` | Dark splash 2x |
| Modify | `ios/App/App/Assets.xcassets/Splash.imageset/Default@3x~universal~anyany-dark.png` | Dark splash 3x |
| Modify | `assets/splash.png` | Source-of-truth splash copy |
| Modify | `capacitor.config.ts` | Rename appName to "Care Tracking" |
| Modify | `ios/App/App/Info.plist` | CFBundleDisplayName → "Care Tracking" |
| Modify | `package.json` | name → "care-tracking", version → "1.0.0" |
| Modify | `app/layout.tsx` | Update metadata title to "Care Tracking" |
| Modify | `ios/App/App.xcodeproj/project.pbxproj` | MARKETING_VERSION → 1.0.0 |
| Create | `app/privacy/page.tsx` | Privacy policy page (no auth required) |

---

### Task 1: Swap App Icon

**Files:**
- Modify: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- Modify: `assets/icon.png`
- Modify: `public/apple-icon.png`

- [ ] **Step 1: Copy new icon to Xcode asset catalog**

```bash
cp "/Users/rando/v0-infant-tracker-app/babyb app icon.png" "/Users/rando/v0-infant-tracker-app/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
```

- [ ] **Step 2: Copy to assets/icon.png (source-of-truth)**

```bash
cp "/Users/rando/v0-infant-tracker-app/babyb app icon.png" "/Users/rando/v0-infant-tracker-app/assets/icon.png"
```

- [ ] **Step 3: Generate 180x180 apple-touch-icon**

```bash
sips -z 180 180 --out "/Users/rando/v0-infant-tracker-app/public/apple-icon.png" "/Users/rando/v0-infant-tracker-app/babyb app icon.png"
```

- [ ] **Step 4: Verify all three files**

```bash
sips -g pixelWidth -g pixelHeight "/Users/rando/v0-infant-tracker-app/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
sips -g pixelWidth -g pixelHeight "/Users/rando/v0-infant-tracker-app/assets/icon.png"
sips -g pixelWidth -g pixelHeight "/Users/rando/v0-infant-tracker-app/public/apple-icon.png"
```

Expected: 1024x1024, 1024x1024, 180x180

- [ ] **Step 5: Commit**

```bash
cd /Users/rando/v0-infant-tracker-app
git add ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png assets/icon.png public/apple-icon.png
git commit -m "feat: swap app icon to lavender moon-baby design"
```

---

### Task 2: Generate Splash Screens

**Files:**
- Modify: `ios/App/App/Assets.xcassets/Splash.imageset/Default@1x~universal~anyany.png`
- Modify: `ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany.png`
- Modify: `ios/App/App/Assets.xcassets/Splash.imageset/Default@3x~universal~anyany.png`
- Modify: `ios/App/App/Assets.xcassets/Splash.imageset/Default@1x~universal~anyany-dark.png`
- Modify: `ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany-dark.png`
- Modify: `ios/App/App/Assets.xcassets/Splash.imageset/Default@3x~universal~anyany-dark.png`
- Modify: `assets/splash.png`

The splash screen is a 2732x2732 image with a solid color background and the icon's moon-baby motif centered. We use a Node.js script with `sharp` (already installed as devDependency) to composite the icon onto a colored canvas.

- [ ] **Step 1: Create splash generation script**

Create file `/Users/rando/v0-infant-tracker-app/scripts/generate-splash.mjs`:

```javascript
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SPLASH_SIZE = 2732;
const ICON_SIZE = 600; // icon rendered at this size in center of splash

// Colors extracted from the new icon
const LIGHT_BG = "#e8dff0"; // soft pastel lavender (matches icon background)
const DARK_BG = "#3b2d4a"; // deep purple for dark mode

async function generateSplash(bgColor, outputPath) {
  // Create solid color background
  const bg = sharp({
    create: {
      width: SPLASH_SIZE,
      height: SPLASH_SIZE,
      channels: 4,
      background: bgColor,
    },
  }).png();

  // Resize icon to fit centered on splash
  const icon = await sharp(path.join(root, "babyb app icon.png"))
    .resize(ICON_SIZE, ICON_SIZE)
    .toBuffer();

  // Composite icon onto center of background
  const offset = Math.round((SPLASH_SIZE - ICON_SIZE) / 2);
  await bg
    .composite([{ input: icon, left: offset, top: offset }])
    .toFile(outputPath);

  console.log(`Generated: ${path.basename(outputPath)}`);
}

const splashDir = path.join(
  root,
  "ios/App/App/Assets.xcassets/Splash.imageset"
);

// Light variants (all same size — Capacitor uses single universal asset)
await generateSplash(LIGHT_BG, path.join(splashDir, "Default@1x~universal~anyany.png"));
await generateSplash(LIGHT_BG, path.join(splashDir, "Default@2x~universal~anyany.png"));
await generateSplash(LIGHT_BG, path.join(splashDir, "Default@3x~universal~anyany.png"));

// Dark variants
await generateSplash(DARK_BG, path.join(splashDir, "Default@1x~universal~anyany-dark.png"));
await generateSplash(DARK_BG, path.join(splashDir, "Default@2x~universal~anyany-dark.png"));
await generateSplash(DARK_BG, path.join(splashDir, "Default@3x~universal~anyany-dark.png"));

// Source-of-truth copy
await generateSplash(LIGHT_BG, path.join(root, "assets/splash.png"));

console.log("Done — all splash screens generated.");
```

- [ ] **Step 2: Run the splash generation script**

```bash
cd /Users/rando/v0-infant-tracker-app && node scripts/generate-splash.mjs
```

Expected output:
```
Generated: Default@1x~universal~anyany.png
Generated: Default@2x~universal~anyany.png
Generated: Default@3x~universal~anyany.png
Generated: Default@1x~universal~anyany-dark.png
Generated: Default@2x~universal~anyany-dark.png
Generated: Default@3x~universal~anyany-dark.png
Generated: splash.png
Done — all splash screens generated.
```

- [ ] **Step 3: Verify splash dimensions**

```bash
sips -g pixelWidth -g pixelHeight "/Users/rando/v0-infant-tracker-app/ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany.png"
sips -g pixelWidth -g pixelHeight "/Users/rando/v0-infant-tracker-app/ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany-dark.png"
```

Expected: 2732x2732 for both.

- [ ] **Step 4: Visually verify a splash image looks correct**

Open one to check:
```bash
open "/Users/rando/v0-infant-tracker-app/ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany.png"
```

Confirm: lavender background with moon-baby icon centered.

- [ ] **Step 5: Commit**

```bash
cd /Users/rando/v0-infant-tracker-app
git add ios/App/App/Assets.xcassets/Splash.imageset/ assets/splash.png scripts/generate-splash.mjs
git commit -m "feat: generate lavender splash screens to match new icon"
```

---

### Task 3: Rename App to "Care Tracking"

**Files:**
- Modify: `capacitor.config.ts` (line 5: appName)
- Modify: `ios/App/App/Info.plist` (line 9-10: CFBundleDisplayName)
- Modify: `package.json` (lines 2-3: name, version)
- Modify: `app/layout.tsx` (line 17: metadata title)

- [ ] **Step 1: Update capacitor.config.ts**

Change line 5 from:
```typescript
  appName: "Infant Tracker",
```
to:
```typescript
  appName: "Care Tracking",
```

- [ ] **Step 2: Update Info.plist CFBundleDisplayName**

Change the value after `<key>CFBundleDisplayName</key>` from:
```xml
	<string>Infant Tracker</string>
```
to:
```xml
	<string>Care Tracking</string>
```

- [ ] **Step 3: Update package.json name**

Change:
```json
  "name": "my-project",
```
to:
```json
  "name": "care-tracking",
```

- [ ] **Step 4: Update layout.tsx metadata title**

In `app/layout.tsx`, change line 17 from:
```typescript
  title: 'Infant Tracker',
```
to:
```typescript
  title: 'Care Tracking',
```

- [ ] **Step 5: Verify changes**

```bash
grep -n "Care Tracking" /Users/rando/v0-infant-tracker-app/capacitor.config.ts /Users/rando/v0-infant-tracker-app/ios/App/App/Info.plist /Users/rando/v0-infant-tracker-app/app/layout.tsx
grep -n '"care-tracking"' /Users/rando/v0-infant-tracker-app/package.json
```

Expected: one match per file showing the new name.

- [ ] **Step 6: Commit**

```bash
cd /Users/rando/v0-infant-tracker-app
git add capacitor.config.ts ios/App/App/Info.plist package.json app/layout.tsx
git commit -m "feat: rename app from Infant Tracker to Care Tracking"
```

---

### Task 4: Add Privacy Policy Page

**Files:**
- Create: `app/privacy/page.tsx`

This page must be accessible without authentication. Since there's no middleware, and all auth checks in this app are client-side (`useEffect` → `getSession()` → redirect), simply omitting that pattern makes the page public.

- [ ] **Step 1: Create the privacy policy page**

Create file `app/privacy/page.tsx`:

```tsx
"use client"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 30, 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">What We Collect</h2>
            <p>
              Care Tracking collects the following information to provide core app functionality:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Email address (for account creation and login)</li>
              <li>Display name (optional, shown to family members)</li>
              <li>Baby profiles (name, date of birth, notes)</li>
              <li>Activity logs (feeding, sleep, and diaper change records)</li>
              <li>Device tokens (for push notification delivery on iOS)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">How We Store Your Data</h2>
            <p>
              All data is stored in a Supabase-hosted PostgreSQL database. Data is encrypted in
              transit via TLS. Your data is associated with your account and accessible only to
              you and members of your family group.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Family Sharing</h2>
            <p>
              When you create or join a family group, all members of that group can view and log
              activity for shared baby profiles. Family groups are private and require an invite
              code to join.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Camera Usage</h2>
            <p>
              The app uses your device camera solely for barcode scanning to look up food products.
              No images are captured, stored, or transmitted. Camera access is requested only when
              you initiate a barcode scan.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Push Notifications</h2>
            <p>
              If you enable push notifications, your iOS device token is stored to deliver
              notifications when family members log activities. You can disable notifications
              at any time in your device settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Third Parties</h2>
            <p>
              Care Tracking does not use third-party analytics, advertising, or tracking services.
              Barcode lookups query the Open Food Facts and UPC Item DB public APIs — only the
              barcode number is sent, no personal information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Data Sales</h2>
            <p>We do not sell, rent, or share your personal data with any third party.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Data Deletion</h2>
            <p>
              You can delete your account and all associated data at any time by contacting us.
              Upon deletion, all your personal information, baby profiles, and activity logs are
              permanently removed from our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Contact</h2>
            <p>
              For privacy questions or data deletion requests, contact us at:{" "}
              <a href="mailto:privacy@caretracking.app" className="text-primary underline">
                privacy@caretracking.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the page builds without errors**

```bash
cd /Users/rando/v0-infant-tracker-app && npm run build 2>&1 | tail -20
```

Expected: build succeeds, `/privacy` appears in the route list.

- [ ] **Step 3: Commit**

```bash
cd /Users/rando/v0-infant-tracker-app
git add app/privacy/page.tsx
git commit -m "feat: add privacy policy page at /privacy (no auth required)"
```

---

### Task 5: Version Bump

**Files:**
- Modify: `package.json` (line 3: version)
- Modify: `ios/App/App.xcodeproj/project.pbxproj` (lines 310, 334: MARKETING_VERSION)

- [ ] **Step 1: Update package.json version**

Change:
```json
  "version": "0.1.0",
```
to:
```json
  "version": "1.0.0",
```

- [ ] **Step 2: Update MARKETING_VERSION in Xcode project**

In `ios/App/App.xcodeproj/project.pbxproj`, change both occurrences (lines 310 and 334) from:
```
MARKETING_VERSION = 1.0;
```
to:
```
MARKETING_VERSION = 1.0.0;
```

Note: `CURRENT_PROJECT_VERSION = 1;` on lines 302 and 326 stays at 1 — this is the build number.

- [ ] **Step 3: Verify**

```bash
grep "MARKETING_VERSION" /Users/rando/v0-infant-tracker-app/ios/App/App.xcodeproj/project.pbxproj
grep '"version"' /Users/rando/v0-infant-tracker-app/package.json
```

Expected: `1.0.0` in all locations.

- [ ] **Step 4: Commit**

```bash
cd /Users/rando/v0-infant-tracker-app
git add package.json ios/App/App.xcodeproj/project.pbxproj
git commit -m "chore: bump version to 1.0.0 for App Store release"
```

---

### Task 6: Build & Sync

- [ ] **Step 1: Run Next.js build**

```bash
cd /Users/rando/v0-infant-tracker-app && npm run build
```

Expected: static export completes to `/out` directory with no errors. The `/privacy` route should appear in the output.

- [ ] **Step 2: Sync to Capacitor iOS project**

```bash
cd /Users/rando/v0-infant-tracker-app && npx cap sync ios
```

Expected: syncs web assets + plugins without errors.

- [ ] **Step 3: Verify the privacy page exists in the synced output**

```bash
ls /Users/rando/v0-infant-tracker-app/ios/App/App/public/privacy/
```

Expected: `index.html` exists (static export of the privacy page).

- [ ] **Step 4: Verify the new icon is in the synced iOS project**

```bash
sips -g pixelWidth -g pixelHeight /Users/rando/v0-infant-tracker-app/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
```

Expected: 1024x1024 (the new lavender icon, not the old coral one).

- [ ] **Step 5: Commit any sync-generated changes**

```bash
cd /Users/rando/v0-infant-tracker-app
git add -A
git status
# If there are changes from cap sync:
git commit -m "chore: build and sync to iOS for App Store submission"
```

---

### Task 7: Final Verification & Push

- [ ] **Step 1: Verify all names are consistent**

```bash
grep -n "Infant Tracker" /Users/rando/v0-infant-tracker-app/capacitor.config.ts /Users/rando/v0-infant-tracker-app/ios/App/App/Info.plist /Users/rando/v0-infant-tracker-app/app/layout.tsx /Users/rando/v0-infant-tracker-app/package.json
```

Expected: **no matches** — all should say "Care Tracking" now.

- [ ] **Step 2: Verify version is 1.0.0**

```bash
grep "MARKETING_VERSION" /Users/rando/v0-infant-tracker-app/ios/App/App.xcodeproj/project.pbxproj
node -e "console.log(require('/Users/rando/v0-infant-tracker-app/package.json').version)"
```

Expected: `1.0.0` everywhere.

- [ ] **Step 3: Push to remote**

```bash
cd /Users/rando/v0-infant-tracker-app && git push origin main
```

- [ ] **Step 4: Print App Store Connect checklist for user**

After push, remind the user of the manual steps they need to complete:

1. Open App Store Connect → create new app "Care Tracking" with bundle ID `com.infanttracker.app`
2. Set category: Health & Fitness (primary), Lifestyle (secondary)
3. Set subtitle: "Baby feeding, sleep & diaper"
4. Paste the description from the spec
5. Add keywords: `baby,infant,tracker,feeding,sleep,diaper,breastfeeding,newborn,family,parenting`
6. Set privacy policy URL to the deployed `/privacy` page
7. Take 5 screenshots from iPhone 15 Pro Max simulator (Cmd+S)
8. Create a demo account in Supabase for Apple reviewers
9. In Xcode: Product → Archive → Distribute → App Store Connect → Upload
10. In App Store Connect: select build, submit for review
