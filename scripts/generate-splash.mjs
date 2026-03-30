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
