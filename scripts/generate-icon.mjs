import sharp from "sharp"
import { writeFileSync } from "fs"

const size = 1024

// Baby footprint — G1-smooth throughout.
// Arch peak at y=122, returns gradually to inner heel by y=200.
// Heel bottom at (85,216). Mirror scale(-1,1) for right foot.
const footPath = `M 28 6 C 36 2,92 -8,124 8 C 150 22,160 54,158 84 C 156 114,134 122,132 148 C 130 172,145 192,155 200 C 165 208,125 216,85 216 C 58 216,28 208,14 192 C 5 180,4 158,4 130 C 4 102,4 70,8 46 C 12 24,20 10,28 6 Z`
const toes = `
  <ellipse cx="18"  cy="-22" rx="16" ry="18"/>
  <ellipse cx="45"  cy="-35" rx="14" ry="16"/>
  <ellipse cx="74"  cy="-36" rx="12" ry="14"/>
  <ellipse cx="100" cy="-26" rx="10" ry="12"/>
  <ellipse cx="120" cy="-14" rx="8"  ry="10"/>`

const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF8C69"/>
      <stop offset="100%" stop-color="#E8604A"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="230" fill="url(#bg)"/>

  <!-- Left foot (large) -->
  <g transform="translate(380,825) rotate(-12) scale(1.35) translate(-85,-216)" fill="white" opacity="0.95">
    <path d="${footPath}"/>${toes}
  </g>

  <!-- Right foot (smaller, mirrored) -->
  <g transform="translate(648,705) rotate(14) scale(-1.0,1.0) translate(-85,-216)" fill="white" opacity="0.82">
    <path d="${footPath}"/>${toes}
  </g>
</svg>`

const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
writeFileSync("assets/icon.png", pngBuffer)
console.log("✓ Icon generated at assets/icon.png (1024x1024)")

const splashSvg = `
<svg width="2732" height="2732" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FF8C69"/>
      <stop offset="100%" stop-color="#E8604A"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>

  <!-- Left foot (large) -->
  <g transform="translate(380,825) rotate(-12) scale(1.35) translate(-85,-216)" fill="white" opacity="0.95">
    <path d="${footPath}"/>${toes}
  </g>

  <!-- Right foot (smaller, mirrored) -->
  <g transform="translate(648,705) rotate(14) scale(-1.0,1.0) translate(-85,-216)" fill="white" opacity="0.82">
    <path d="${footPath}"/>${toes}
  </g>
</svg>`

const splashBuffer = await sharp(Buffer.from(splashSvg)).resize(2732, 2732).png().toBuffer()
writeFileSync("assets/splash.png", splashBuffer)
console.log("✓ Splash generated at assets/splash.png (2732x2732)")
