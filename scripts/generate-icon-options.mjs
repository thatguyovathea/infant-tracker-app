import sharp from "sharp"
import { writeFileSync, mkdirSync } from "fs"

mkdirSync("assets/icon-options", { recursive: true })

const size = 1024

// ── Option A: Clean Bottle — soft blue gradient, minimal modern bottle ──
const svgA = `
<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgA" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#5B9CF6"/>
      <stop offset="100%" stop-color="#3B6FD4"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="230" fill="url(#bgA)"/>
  <!-- Bottle body -->
  <rect x="370" y="370" width="284" height="380" rx="100" fill="white" opacity="0.95"/>
  <!-- Bottle neck -->
  <rect x="430" y="260" width="164" height="130" rx="50" fill="white" opacity="0.9"/>
  <!-- Nipple -->
  <rect x="468" y="210" width="88" height="70" rx="35" fill="white" opacity="0.75"/>
  <!-- Milk fill -->
  <rect x="370" y="560" width="284" height="190" rx="0 0 100 100" fill="#DAEEFF" opacity="0.85"/>
  <!-- Tick marks -->
  <rect x="408" y="490" width="44" height="10" rx="5" fill="#5B9CF6" opacity="0.5"/>
  <rect x="408" y="540" width="56" height="10" rx="5" fill="#5B9CF6" opacity="0.5"/>
  <rect x="408" y="590" width="44" height="10" rx="5" fill="#5B9CF6" opacity="0.5"/>
</svg>`

// Baby footprint — G1-smooth throughout.
// Arch peak at y=122 (high up), returns GRADUALLY to inner heel by y=200.
// This prevents the "speech bubble" bump by spreading the return over 78 y-units.
// Heel bottom at (85,216). Mirror scale(-1,1) for right foot.
const footPath = `M 28 6 C 36 2,92 -8,124 8 C 150 22,160 54,158 84 C 156 114,134 122,132 148 C 130 172,145 192,155 200 C 165 208,125 216,85 216 C 58 216,28 208,14 192 C 5 180,4 158,4 130 C 4 102,4 70,8 46 C 12 24,20 10,28 6 Z`
// 5 toes above ball top (y≈2–8), outer to inner
const toe1 = `<ellipse cx="18"  cy="-22" rx="16" ry="18"/>` // big toe
const toe2 = `<ellipse cx="45"  cy="-35" rx="14" ry="16"/>`
const toe3 = `<ellipse cx="74"  cy="-36" rx="12" ry="14"/>`
const toe4 = `<ellipse cx="100" cy="-26" rx="10" ry="12"/>`
const toe5 = `<ellipse cx="120" cy="-14" rx="8"  ry="10"/>` // pinky

// ── Option B: Baby Footprint — warm peach, two human-shaped footprints ──
const svgB = `
<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF8C69"/>
      <stop offset="100%" stop-color="#E8604A"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="230" fill="url(#bgB)"/>

  <!-- Left foot (large) -->
  <g transform="translate(380,825) rotate(-12) scale(1.35) translate(-85,-216)" fill="white" opacity="0.95">
    <path d="${footPath}"/>
    ${toe1}${toe2}${toe3}${toe4}${toe5}
  </g>

  <!-- Right foot (smaller, mirrored) -->
  <g transform="translate(648,705) rotate(14) scale(-1.0,1.0) translate(-85,-216)" fill="white" opacity="0.82">
    <path d="${footPath}"/>
    ${toe1}${toe2}${toe3}${toe4}${toe5}
  </g>
</svg>`

// ── Option C: Moon & Stars — deep indigo, crescent moon, soft stars ──
const svgC = `
<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgC" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2D1B6E"/>
      <stop offset="100%" stop-color="#1A0F42"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="230" fill="url(#bgC)"/>
  <!-- Crescent moon -->
  <circle cx="512" cy="512" r="260" fill="white" opacity="0.95"/>
  <circle cx="620" cy="430" r="220" fill="#2D1B6E"/>
  <!-- Stars -->
  <circle cx="720" cy="240" r="18" fill="white" opacity="0.9"/>
  <circle cx="790" cy="320" r="12" fill="white" opacity="0.7"/>
  <circle cx="260" cy="300" r="14" fill="white" opacity="0.8"/>
  <circle cx="200" cy="200" r="10" fill="white" opacity="0.6"/>
  <circle cx="820" cy="500" r="10" fill="white" opacity="0.6"/>
  <circle cx="300" cy="750" r="12" fill="white" opacity="0.5"/>
  <circle cx="750" cy="750" r="8" fill="white" opacity="0.5"/>
  <!-- Small bottle silhouette below moon -->
  <rect x="454" y="680" width="116" height="160" rx="36" fill="white" opacity="0.6"/>
  <rect x="476" y="636" width="72" height="58" rx="22" fill="white" opacity="0.5"/>
  <rect x="492" y="614" width="40" height="36" rx="14" fill="white" opacity="0.4"/>
</svg>`

async function gen(svg, name) {
  const buf = await sharp(Buffer.from(svg)).png().toBuffer()
  writeFileSync(`assets/icon-options/${name}.png`, buf)
  console.log(`✓ ${name}.png`)
}

await gen(svgA, "option-A-bottle")
await gen(svgB, "option-B-footprint")
await gen(svgC, "option-C-moon")
console.log("\nAll options saved to assets/icon-options/")
