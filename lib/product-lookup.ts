export type FoodProduct    = { name: string; allergens: string[] }
export type GeneralProduct = { name: string; brand: string }

type CachedResult = {
  ts:      number
  food:    FoodProduct    | null
  general: GeneralProduct | null
  // true = we actually fetched general (food-hit short-circuits it)
  generalFetched: boolean
}

// ─── TTLs ────────────────────────────────────────────────────────────────────
const HIT_TTL  = 365 * 24 * 60 * 60 * 1000  // 1 year   — product data is stable; new formulations get new barcodes
const MISS_TTL =  30 * 24 * 60 * 60 * 1000  // 30 days  — give unindexed products time to appear in the APIs
const MAX_ENTRIES = 300

// ─── Storage key ─────────────────────────────────────────────────────────────
const STORE_KEY = "infant-tracker-barcode-cache"

// ─── Tier 1: in-memory Map (session lifetime) ─────────────────────────────
const mem = new Map<string, CachedResult>()

// ─── Tier 2: localStorage helpers ─────────────────────────────────────────
function readStore(): Record<string, CachedResult> {
  try {
    if (typeof localStorage === "undefined") return {}
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}")
  } catch { return {} }
}

function writeStore(store: Record<string, CachedResult>) {
  try {
    if (typeof localStorage === "undefined") return
    // Trim to MAX_ENTRIES, keeping the most-recently-seen barcodes
    const entries = Object.entries(store).sort((a, b) => b[1].ts - a[1].ts)
    const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES))
    localStorage.setItem(STORE_KEY, JSON.stringify(trimmed))
  } catch {}
}

function ttlFor(entry: CachedResult) {
  return (entry.food || entry.general) ? HIT_TTL : MISS_TTL
}

// ─── Cache read (mem → localStorage) ─────────────────────────────────────
function getCached(barcode: string): CachedResult | null {
  // Tier 1
  const m = mem.get(barcode)
  if (m) {
    if (Date.now() - m.ts < ttlFor(m)) return m
    mem.delete(barcode)
  }
  // Tier 2
  const store = readStore()
  const entry  = store[barcode]
  if (entry) {
    if (Date.now() - entry.ts < ttlFor(entry)) {
      mem.set(barcode, entry)   // promote to memory
      return entry
    }
    delete store[barcode]
    writeStore(store)
  }
  return null
}

// ─── Cache write ─────────────────────────────────────────────────────────
function setCached(barcode: string, result: Omit<CachedResult, "ts">) {
  const entry: CachedResult = { ...result, ts: Date.now() }
  mem.set(barcode, entry)
  const store = readStore()
  store[barcode] = entry
  writeStore(store)
}

// ─── Internal fetcher — runs at most once per barcode ────────────────────
// Logic:
//   1. Try Open Food Facts (free, great baby-food coverage)
//   2. If food found  → cache & return immediately (skip UPC API)
//   3. If food missed → try UPC Item DB (diapers / general products)
//   4. Cache whatever we got (even a double-miss), but NOT if both APIs threw
//      (network error ≠ product not found — don't poison the cache)
async function fetchAndCache(barcode: string): Promise<CachedResult> {
  // ── Open Food Facts ──────────────────────────────────────────────────────
  let food: FoodProduct | null = null
  let offFailed = false
  try {
    const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
    if (res.ok) {
      const data = await res.json()
      if (data.status === 1 && data.product?.product_name) {
        food = {
          name:      data.product.product_name,
          allergens: (data.product.allergens_tags ?? [])
            .map((t: string) => t.replace(/^en:/, "")),
        }
      }
    }
  } catch (err) {
    console.error("[product-lookup] Open Food Facts fetch failed:", err)
    offFailed = true
  }

  // Short-circuit: food hit → no need to call UPC API
  if (food) {
    const result: CachedResult = { food, general: null, generalFetched: false, ts: Date.now() }
    setCached(barcode, result)
    return result
  }

  // ── UPC Item DB ──────────────────────────────────────────────────────────
  let general: GeneralProduct | null = null
  let upcFailed = false
  try {
    const res  = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`)
    if (res.ok) {
      const data = await res.json()
      const item = data.items?.[0]
      if (item?.title) {
        general = { name: item.title, brand: item.brand ?? "" }
      }
    }
  } catch (err) {
    console.error("[product-lookup] UPC Item DB fetch failed:", err)
    upcFailed = true
  }

  const result: CachedResult = { food: null, general, generalFetched: true, ts: Date.now() }
  // Only cache if at least one API responded (even with a product-not-found).
  // If both threw, it was a network error — skip caching so the next scan retries.
  if (!offFailed || !upcFailed) setCached(barcode, result)
  return result
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function lookupFood(barcode: string): Promise<FoodProduct | null> {
  const cached = getCached(barcode)
  if (cached) return cached.food
  return (await fetchAndCache(barcode)).food
}

export async function lookupGeneral(barcode: string): Promise<GeneralProduct | null> {
  const cached = getCached(barcode)
  // Only use cached general if we actually fetched it (food-hit entries skip it)
  if (cached?.generalFetched) return cached.general
  return (await fetchAndCache(barcode)).general
}

// ─── Cache inspection (optional, useful for debugging) ───────────────────
export function getCacheStats(): { entries: number; hits: string[] } {
  const store = readStore()
  return {
    entries: Object.keys(store).length,
    hits:    Object.entries(store)
               .filter(([, v]) => v.food || v.general)
               .map(([k]) => k),
  }
}
