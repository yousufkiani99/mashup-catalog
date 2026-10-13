// Shared helpers for sign.mjs and verify.mjs. Node built-ins only.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** A free tester key's id (mashup-app scripts/make-tester-key.mjs, decision D28). */
export const TESTER_ID = /^[a-z0-9]{6,32}$/
/** Ids of switched-off tester keys, one JSON list: ["k7f3q9xa2b", ...]. Optional. */
export const REVOKED_TESTER_KEYS_FILE = 'revoked-tester-keys.json'
/** The app's own links (support, Terms, Privacy, ...), copied into index.json as "links". Optional. */
export const LINKS_FILE = 'links.json'
/** The store (itch.io, D49) and the price, copied into index.json as "purchase". Optional. */
export const PURCHASE_FILE = 'purchase.json'
/** Experiment switches (mashup-app src/shared/experiments.ts), copied as "experiments". Optional. */
export const EXPERIMENTS_FILE = 'experiments.json'
/** The weekly #clips winner (mashup-app src/shared/featured.ts), copied as "featuredClip". Optional. */
export const FEATURED_CLIP_FILE = 'featured-clip.json'

/**
 * Which links the app knows and what each may be: an https address, or mailto:<one email address>.
 * Keep in step with LINK_KEYS in mashup-app's src/shared/links.ts (the app drops anything else).
 */
export const LINK_KEYS = {
  support: ['https'],
  website: ['https'],
  terms: ['https'],
  privacy: ['https'],
  refunds: ['https'],
  contact: ['mailto'],
  requests: ['https', 'mailto'],
  reportRelay: ['https'],
  clips: ['https'],
  reviews: ['https']
}
const MAILTO = /^mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

/** An https address with a real host name and no user name or password (as the app checks it). */
export function isHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2000 || !value.startsWith('https://') || /\s/.test(value)) return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && !u.username && !u.password && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)
  } catch {
    return false
  }
}

export function isMailto(value) {
  return typeof value === 'string' && value.length <= 320 && MAILTO.test(value)
}

/** Problems with a links object (unknown keys, wrong kinds of address). */
export function linksProblems(links) {
  if (!links || typeof links !== 'object' || Array.isArray(links)) return ['must be a JSON object of links']
  const problems = []
  for (const [key, value] of Object.entries(links)) {
    const kinds = Object.prototype.hasOwnProperty.call(LINK_KEYS, key) ? LINK_KEYS[key] : null
    if (!kinds) {
      problems.push(`"${key}" isn't a link the app knows (${Object.keys(LINK_KEYS).join(', ')})`)
      continue
    }
    const ok = (kinds.includes('https') && isHttpsUrl(value)) || (kinds.includes('mailto') && isMailto(value))
    if (!ok) {
      const want = kinds.map((k) => (k === 'https' ? 'an https:// address' : 'mailto:<email address>')).join(' or ')
      problems.push(`"${key}" must be ${want} (got ${JSON.stringify(value)})`)
    }
  }
  return problems
}

/** The links in LINK_KEYS order (stable index bytes), leaving out empty values. */
export function normalizeLinks(links) {
  const out = {}
  for (const key of Object.keys(LINK_KEYS)) if (links && links[key] !== undefined && links[key] !== '') out[key] = links[key]
  return out
}

/**
 * The keys of purchase.json, in index order. The store (mashup-app src/shared/store.ts, Round 7,
 * D49: itch.io, "collected by itch.io"), then the price (src/shared/pricing.ts):
 *   provider           "itch"        the only store the app knows (a new store = a new value + app code)
 *   itchUser           "yousufkiani" the itch.io account that sells the unlock (<itchUser>.itch.io)
 *   itchGameId         5148785       the project's id (itch.io > Edit game: the number in the address);
 *                                    it switches on unlocking (download keys); null or missing: off
 *   itchOauthClientId  "…"           the OAuth application's client id (public, not a secret); null
 *                                    or missing until known: "Sign in with itch.io" stays hidden
 *   purchaseUrl        "https://<itchUser>.itch.io/mashup-launcher/purchase"   where Buy goes;
 *                                    left out until the itch.io page is published (Buy buttons say
 *                                    "Coming soon" until then; keys and sign-in already work)
 *   priceCents         499           one-time price in cents, as the itch.io page charges it
 *   currency           "USD"         only USD
 *   earlyPriceEndsBy   "2026-12-31"  the early price goes up ON OR BEFORE this day ("goes up by")
 *   sale               { "priceCents": 349, "startsAt": "2026-10-14T16:00:00Z",
 *                        "endsAt": "2026-10-25T03:59:59Z", "label": "Launch sale" }   optional
 *                                    (mashup-app Round 8, D52): mirrors an itch.io sale. Below
 *                                    priceCents, exact UTC times ("Z"), endsAt after startsAt, at
 *                                    most 14 days, label letters and spaces only. The app and site
 *                                    show the sale price and "Launch sale: $3.49 until Oct 24, then
 *                                    $4.99" only inside [startsAt, endsAt), then go back by themselves
 * Keep in step with STORE_KEYS / parseStore and PRICING_KEYS / parsePricing in mashup-app. No codes,
 * offers, affiliates or test mode (D40, D41 superseded by D49; itch.io's limited-use coupon codes
 * exist but aren't used: no scarcity copy, and the app can't see redemptions).
 */
export const PURCHASE_KEYS = [
  'provider',
  'itchUser',
  'itchGameId',
  'itchOauthClientId',
  'purchaseUrl',
  'priceCents',
  'currency',
  'earlyPriceEndsBy',
  'sale'
]
/** The sale's keys, in order. */
export const SALE_KEYS = ['priceCents', 'startsAt', 'endsAt', 'label']
/** A sale is at most this long (mashup-app src/shared/pricing.ts MAX_SALE_MS). */
export const MAX_SALE_MS = 14 * 24 * 60 * 60 * 1000
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const SALE_LABEL = /^[A-Za-z][A-Za-z ]{2,23}$/

/** A real UTC instant, written with a "Z" (as the app's isUtcTime). */
function isUtcTime(v) {
  if (typeof v !== 'string' || !UTC_TIME.test(v)) return false
  const t = Date.parse(v)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 19) === v.slice(0, 19)
}

/**
 * Problems with purchase.json's optional "sale" (checked exactly as the app reads it; the app drops
 * a bad sale whole, so the catalog refuses one).
 */
export function saleProblems(sale, priceCents) {
  if (!sale || typeof sale !== 'object' || Array.isArray(sale)) return ['"sale" must be an object like { "priceCents": 349, "startsAt": "…Z", "endsAt": "…Z" }']
  const problems = []
  for (const key of Object.keys(sale)) if (!SALE_KEYS.includes(key)) problems.push(`"sale.${key}" isn't one of ${SALE_KEYS.join(', ')}`)
  const p = sale.priceCents
  if (!(typeof p === 'number' && Number.isSafeInteger(p) && p > 0)) problems.push('"sale.priceCents" must be the sale price in cents, e.g. 349')
  else if (typeof priceCents === 'number' && p >= priceCents) problems.push(`"sale.priceCents" (${p}) must be below "priceCents" (${priceCents})`)
  else if (typeof priceCents !== 'number') problems.push('"sale" needs "priceCents" (the regular price) set too')
  const okStart = isUtcTime(sale.startsAt)
  const okEnd = isUtcTime(sale.endsAt)
  if (!okStart) problems.push('"sale.startsAt" must be an exact UTC time like "2026-10-14T16:00:00Z"')
  if (!okEnd) problems.push('"sale.endsAt" must be an exact UTC time like "2026-10-25T03:59:59Z"')
  if (okStart && okEnd) {
    const ms = Date.parse(sale.endsAt) - Date.parse(sale.startsAt)
    if (ms <= 0) problems.push('"sale.endsAt" must be after "sale.startsAt"')
    else if (ms > MAX_SALE_MS) problems.push('a sale is at most 14 days ("sale.endsAt" - "sale.startsAt")')
  }
  if (sale.label !== undefined && !(typeof sale.label === 'string' && SALE_LABEL.test(sale.label)))
    problems.push('"sale.label" must be 3 to 24 letters and spaces, e.g. "Launch sale" (or leave it out)')
  return problems
}
/** Lemon Squeezy fields from before D49: refused with a pointer, so they can't creep back in. */
const OLD_LS_KEYS = ['storeId', 'productId', 'checkoutUrl', 'testMode', 'offer', 'affiliatePercent']
const ITCH_USER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/
const CLIENT_ID = /^[A-Za-z0-9_-]{6,128}$/

function isDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === v
}

/** A field that isn't known yet: missing, null or "". */
const unset = (v) => v === undefined || v === null || v === ''

/** An https page on <user>.itch.io itself (no port), as the app's isItchPageUrl checks it. */
export function isItchPageUrl(value, user) {
  if (!isHttpsUrl(value)) return false
  const u = new URL(value)
  const host = u.hostname.toLowerCase()
  if (u.port !== '' || !host.endsWith('.itch.io') || host.split('.').length !== 3) return false
  return !user || host === `${String(user).toLowerCase()}.itch.io`
}

/** Problems with the price in purchase.json (each checked like the app reads it). */
export function pricingProblems(p) {
  const problems = []
  const cents = (v, max) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= max
  if (p.priceCents !== undefined && !cents(p.priceCents, 100000)) problems.push('"priceCents" must be the price in cents, e.g. 499')
  if (p.currency !== undefined && p.currency !== 'USD') problems.push('"currency" must be "USD" (no regional pricing)')
  if (p.earlyPriceEndsBy !== undefined && !isDay(p.earlyPriceEndsBy)) problems.push('"earlyPriceEndsBy" must be a day like "2026-12-31"')
  if (!unset(p.sale)) problems.push(...saleProblems(p.sale, p.priceCents))
  return problems
}

/** Problems with a purchase object: the itch.io store fields and the price. */
export function purchaseProblems(purchase) {
  if (!purchase || typeof purchase !== 'object' || Array.isArray(purchase)) return ['must be a JSON object']
  const problems = []
  for (const key of Object.keys(purchase)) {
    if (OLD_LS_KEYS.includes(key)) problems.push(`"${key}" was a Lemon Squeezy setting; the store is itch.io now (D49): remove it`)
    else if (!PURCHASE_KEYS.includes(key)) problems.push(`"${key}" isn't one of ${PURCHASE_KEYS.join(', ')}`)
  }
  problems.push(...pricingProblems(purchase))
  const p = purchase
  const storeFields = ['itchUser', 'itchGameId', 'itchOauthClientId', 'purchaseUrl'].filter((k) => !unset(p[k]))
  if (p.provider === undefined) {
    if (storeFields.length) problems.push('set "provider": "itch" together with the itch.io fields')
    return problems
  }
  if (p.provider !== 'itch') {
    problems.push('"provider" must be "itch" (the only store the app knows)')
    return problems
  }
  if (unset(p.itchUser) || !ITCH_USER.test(p.itchUser)) problems.push('"itchUser" must be the itch.io account name, as in https://<itchUser>.itch.io')
  if (!unset(p.itchGameId) && !(typeof p.itchGameId === 'number' && Number.isSafeInteger(p.itchGameId) && p.itchGameId > 0))
    problems.push('"itchGameId" must be the project\'s number from itch.io (Edit game: the number in the address), no quotes')
  if (!unset(p.itchOauthClientId) && !(typeof p.itchOauthClientId === 'string' && CLIENT_ID.test(p.itchOauthClientId)))
    problems.push('"itchOauthClientId" must be the OAuth application\'s Client ID from itch.io')
  if (!unset(p.purchaseUrl) && !isItchPageUrl(p.purchaseUrl, ITCH_USER.test(p.itchUser ?? '') ? p.itchUser : null))
    problems.push('"purchaseUrl" must be an https:// page on <itchUser>.itch.io, e.g. https://<itchUser>.itch.io/mashup-launcher/purchase')
  return problems
}

/** The purchase settings in a fixed key order, leaving out values that aren't known yet. */
export function normalizePurchase(purchase) {
  const out = {}
  for (const key of PURCHASE_KEYS) if (purchase && !unset(purchase[key])) out[key] = purchase[key]
  if (out.sale && typeof out.sale === 'object') {
    const sale = {}
    for (const key of SALE_KEYS) if (out.sale[key] !== undefined) sale[key] = out.sale[key]
    out.sale = sale
  }
  return out
}

/**
 * An optional JSON object file at the repo root (links.json, purchase.json). Returns { value, problems }:
 * value is undefined when the file doesn't exist or holds an empty object.
 */
export function readOptionalObject(root, name, problemsOf, normalize) {
  const file = join(root, name)
  if (!existsSync(file)) return { value: undefined, problems: [] }
  let value
  try {
    value = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    return { value: undefined, problems: [`isn't valid JSON: ${err.message}`] }
  }
  const problems = problemsOf(value)
  if (problems.length > 0) return { value: undefined, problems }
  const normalized = normalize(value)
  return { value: Object.keys(normalized).length > 0 ? normalized : undefined, problems: [] }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** {"afterPlayOffer": {"active": true|false, "startsOn": "YYYY-MM-DD", "endsBy": "YYYY-MM-DD"}} (both dates required while active) and nothing else. */
export function experimentsProblems(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['must be a JSON object']
  const problems = []
  for (const key of Object.keys(value)) if (key !== 'afterPlayOffer') problems.push(`"${key}" isn't an experiment the app knows (afterPlayOffer)`)
  const a = value.afterPlayOffer
  if (a !== undefined) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) problems.push('"afterPlayOffer" must be an object')
    else {
      for (const key of Object.keys(a)) if (!['active', 'startsOn', 'endsBy'].includes(key)) problems.push(`afterPlayOffer "${key}" isn't active, startsOn or endsBy`)
      if (typeof a.active !== 'boolean') problems.push('afterPlayOffer "active" must be true or false')
      for (const k of ['startsOn', 'endsBy']) {
        if (a[k] !== undefined && (typeof a[k] !== 'string' || !DAY.test(a[k]) || Number.isNaN(Date.parse(a[k]))))
          problems.push(`afterPlayOffer "${k}" must be a date like 2026-12-15`)
        else if (a.active === true && a[k] === undefined) problems.push(`afterPlayOffer needs "${k}" while active (the app runs it only between the two dates)`)
      }
      if (typeof a.startsOn === 'string' && typeof a.endsBy === 'string' && a.startsOn > a.endsBy)
        problems.push('afterPlayOffer "startsOn" must be on or before "endsBy"')
    }
  }
  return problems
}

export function normalizeExperiments(value) {
  if (!value || !value.afterPlayOffer) return {}
  const a = value.afterPlayOffer
  return {
    afterPlayOffer: {
      active: a.active,
      ...(a.startsOn !== undefined ? { startsOn: a.startsOn } : {}),
      ...(a.endsBy !== undefined ? { endsBy: a.endsBy } : {})
    }
  }
}

// The same Rockstar check as mashup-app's src/shared/publisher.ts (keys, store names, publisher,
// publisherRestricted). Featured clips are never Rockstar mashups (they show where the unlock is sold, D27).
const ROCKSTAR_KEY =
  /^(gta|grand-?theft|rdr|red-?dead|max-?payne|bully|canis-?canem|la-?noire|manhunt|midnight-?club|the-?warriors|table-?tennis)/
const ROCKSTAR_NAME =
  /(\bgta|grand theft auto|red dead|\brdr\s*\d*\b|max\s*payne|\bbully\b|canis canem edit|l\.?\s?a\.?\s?noire|\bmanhunt|midnight club|the warriors|table tennis|rockstar games)/i

/** The recipe (parsed JSON) uses a Rockstar game or says it must never be shown where we sell. */
export function usesRockstarGame(recipe) {
  if (!recipe || !Array.isArray(recipe.games)) return true
  if (recipe.publisherRestricted === true) return true
  return recipe.games.some(
    (g) =>
      (typeof g?.publisher === 'string' && /rockstar/i.test(g.publisher)) ||
      ROCKSTAR_KEY.test(String(g?.key ?? '').toLowerCase()) ||
      (typeof g?.name === 'string' && ROCKSTAR_NAME.test(g.name))
  )
}

/** Owners whose GitHub release files the app's video player may play (src/shared/clips.ts). */
const VIDEO_OWNERS = ['yousufkiani99']
const PERMISSION = /^(own recording|written, \d{4}-\d{2}-\d{2}|Discord ⭐ \(author opt-in\), \d{4}-\d{2}-\d{2})$/

/** An https://github.com/<ours>/<repo>/releases/download/<tag>/<name>.mp4 address, nothing else. */
export function isReleaseVideo(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return false
  if (url.hostname.toLowerCase() !== 'github.com') return false
  const parts = url.pathname.split('/')
  return (
    parts.length === 7 &&
    VIDEO_OWNERS.includes(parts[1].toLowerCase()) &&
    /^[A-Za-z0-9._-]{1,100}$/.test(parts[2]) &&
    parts[3] === 'releases' &&
    parts[4] === 'download' &&
    parts[5].length > 0 &&
    /\.mp4$/i.test(parts[6])
  )
}

/**
 * The featured clip: {mashupId, src, credit: {name, url}, permission}. Permission is "own recording",
 * "written, YYYY-MM-DD" or "Discord ⭐ (author opt-in), YYYY-MM-DD" (the poster's own ⭐ on their #clips post);
 * a credit (name + https link) is needed unless it's our own recording. `recipes`: this catalog's
 * recipes as { id, json } (the mashup must be one of them, and never a Rockstar one).
 */
export function featuredClipProblems(value, recipes) {
  const recipeIds = recipes ? recipes.map((r) => r.id) : undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['must be a JSON object']
  const problems = []
  for (const key of Object.keys(value))
    if (!['mashupId', 'src', 'credit', 'permission'].includes(key)) problems.push(`"${key}" isn't mashupId, src, credit or permission`)
  if (typeof value.mashupId !== 'string' || !KEBAB.test(value.mashupId)) problems.push('"mashupId" must be a recipe id')
  else if (recipeIds && !recipeIds.includes(value.mashupId)) problems.push(`"mashupId" ${value.mashupId} isn't in recipes/`)
  else if (recipes && usesRockstarGame(recipes.find((r) => r.id === value.mashupId)?.json))
    problems.push(`"mashupId" ${value.mashupId} uses a Rockstar game: never a featured clip (D27)`)
  if (typeof value.src !== 'string' || !isReleaseVideo(value.src)) problems.push('"src" must be an .mp4 on a GitHub release of ours')
  if (typeof value.permission !== 'string' || !PERMISSION.test(value.permission))
    problems.push('"permission" must be "own recording", "written, YYYY-MM-DD" or "Discord ⭐ (author opt-in), YYYY-MM-DD"')
  const c = value.credit
  if (c !== undefined) {
    if (!c || typeof c !== 'object' || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 60 || !isHttpsUrl(c.url))
      problems.push('"credit" must be {"name": "…", "url": "https://…"}')
  } else if (value.permission !== 'own recording') problems.push('"credit" is needed for a player\'s clip')
  return problems
}

export function normalizeFeaturedClip(value) {
  const out = { mashupId: value.mashupId, src: value.src }
  if (value.credit) out.credit = { name: value.credit.name.trim(), url: value.credit.url }
  out.permission = value.permission
  return out
}

export function readExperiments(root) {
  return readOptionalObject(root, EXPERIMENTS_FILE, experimentsProblems, normalizeExperiments)
}

/** Recipe files as { id, json } for featuredClipProblems (unparseable ones get json null). */
export function recipeJsons(files) {
  return files.map((f) => {
    try {
      return { id: f.id, json: JSON.parse(f.bytes.toString('utf8')) }
    } catch {
      return { id: f.id, json: null }
    }
  })
}

export function readFeaturedClip(root, recipes) {
  return readOptionalObject(root, FEATURED_CLIP_FILE, (v) => featuredClipProblems(v, recipes), normalizeFeaturedClip)
}

export function readLinks(root) {
  return readOptionalObject(root, LINKS_FILE, linksProblems, normalizeLinks)
}

export function readPurchase(root) {
  return readOptionalObject(root, PURCHASE_FILE, purchaseProblems, normalizePurchase)
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Every recipes/*.json file, sorted by name, as { id, path, bytes }. */
export function listRecipeFiles(root) {
  const dir = join(root, 'recipes')
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => ({ id: n.slice(0, -'.json'.length), path: `recipes/${n}`, bytes: readFileSync(join(dir, n)) }))
}

const REQUIRED_KEYS = [
  'schemaVersion',
  'id',
  'title',
  'tagline',
  'description',
  'method',
  'tier',
  'testLabel',
  'games',
  'downloads',
  'steps',
  'launch',
  'saves',
  'requirements',
  'credits',
  'licence',
  'links',
  'media',
  'aiBuilt',
  'knownIssues'
]
const ARRAY_KEYS = ['games', 'downloads', 'steps', 'saves', 'credits', 'knownIssues']

function collectStrings(value, out) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out))
  return out
}

/**
 * Basic shape checks for one recipe file. The app runs the full schema (src/shared/recipe.ts in
 * mashup-app) and refuses anything that fails it; this catches the common mistakes before signing.
 */
export function recipeProblems(file) {
  const problems = []
  const text = file.bytes.toString('utf8')
  if (text.includes('\r')) problems.push('has Windows line endings (CR); save it with LF only')
  if (text.charCodeAt(0) === 0xfeff) problems.push('starts with a byte-order mark; save it as UTF-8 without BOM')
  let json
  try {
    json = JSON.parse(text)
  } catch (err) {
    return [...problems, `isn't valid JSON: ${err.message}`]
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [...problems, 'must be a JSON object']
  if (!KEBAB.test(file.id)) problems.push('file name must be kebab-case, e.g. recipes/skycraft.json')
  if (json.id !== file.id) problems.push(`id is "${json.id}" but the file is named "${file.id}.json"`)
  // Recipe formats the app knows (RECIPE_SCHEMA_VERSIONS in mashup-app's src/shared/recipe.ts).
  if (![1, 2, 3, 4].includes(json.schemaVersion)) problems.push('schemaVersion must be 1, 2, 3 or 4')
  for (const key of REQUIRED_KEYS) if (!(key in json)) problems.push(`is missing "${key}"`)
  for (const key of ARRAY_KEYS) if (key in json && !Array.isArray(json[key])) problems.push(`"${key}" must be a list`)
  if (Array.isArray(json.credits) && json.credits.length === 0) problems.push('needs at least one credit')
  if (
    json.testedSetup !== undefined &&
    (typeof json.testedSetup !== 'string' || !json.testedSetup.trim() || json.testedSetup.length > 60 || /[\r\n<>]/.test(json.testedSetup))
  )
    problems.push('"testedSetup" must be one plain line of up to 60 characters, e.g. "GTX 1060 · Steam"')
  if (Array.isArray(json.downloads)) {
    const ids = new Set()
    for (const d of json.downloads) {
      if (!d || typeof d !== 'object') {
        problems.push('has a download that is not an object')
        continue
      }
      if (ids.has(d.id)) problems.push(`download id "${d.id}" is used twice`)
      ids.add(d.id)
      if (typeof d.url !== 'string' || !d.url.startsWith('https://')) problems.push(`download "${d.id}" needs an https url`)
      if (d.sha256 !== 'TODO' && !/^[0-9a-f]{64}$/.test(String(d.sha256))) {
        problems.push(`download "${d.id}" sha256 must be 64 lowercase hex characters or "TODO"`)
      }
    }
  }
  for (const s of collectStrings(json, [])) {
    if (s.startsWith('http://')) problems.push(`uses a plain http address (${s}); use https`)
    if (s.startsWith('{') && s.includes('..')) problems.push(`path "${s}" must not contain '..'`)
  }
  return problems
}

/** Problems with a revokedTesterKeys list: must be unique tester ids, sorted. */
export function revokedListProblems(list) {
  if (!Array.isArray(list)) return ['must be a list of tester key ids']
  const problems = []
  for (const id of list) {
    if (typeof id !== 'string' || !TESTER_ID.test(id)) problems.push(`"${id}" isn't a tester key id (6-32 lowercase letters/digits)`)
  }
  if (new Set(list).size !== list.length) problems.push('lists an id twice')
  if (list.some((id, i) => i > 0 && String(list[i - 1]) > String(id))) problems.push('must be sorted')
  return problems
}

/**
 * Switched-off tester key ids from revoked-tester-keys.json (sorted, without duplicates), or [] when
 * the file doesn't exist. Returns { ids, problems }.
 */
export function readRevokedTesterKeys(root) {
  const file = join(root, REVOKED_TESTER_KEYS_FILE)
  if (!existsSync(file)) return { ids: [], problems: [] }
  let list
  try {
    list = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    return { ids: [], problems: [`isn't valid JSON: ${err.message}`] }
  }
  if (!Array.isArray(list)) return { ids: [], problems: ['must be a JSON list of tester key ids'] }
  const ids = [...new Set(list.map((id) => (typeof id === 'string' ? id.trim() : id)))].sort()
  return { ids, problems: revokedListProblems(ids) }
}

/**
 * The index object, with a fixed key order so the bytes are stable. `revokedTesterKeys` (sorted
 * tester key ids the app must refuse) is only written when there is at least one, and `links` /
 * `purchase` only when links.json / purchase.json hold something, so the index is byte-for-byte
 * unchanged for catalogs without them. Index stays schemaVersion 1: older apps ignore the fields
 * (their index schema drops unknown keys).
 */
export function buildIndex(files, generatedAt, revokedTesterKeys = [], extra = {}) {
  const index = { schemaVersion: 1, generatedAt }
  if (revokedTesterKeys.length > 0) index.revokedTesterKeys = [...revokedTesterKeys]
  if (extra.links && Object.keys(extra.links).length > 0) index.links = { ...extra.links }
  if (extra.purchase && Object.keys(extra.purchase).length > 0) index.purchase = { ...extra.purchase }
  if (extra.experiments && Object.keys(extra.experiments).length > 0) index.experiments = { ...extra.experiments }
  if (extra.featuredClip) index.featuredClip = { ...extra.featuredClip }
  index.recipes = files.map((f) => ({ id: f.id, path: f.path, sha256: sha256Hex(f.bytes) }))
  return index
}

/** index.json bytes: 2-space JSON, LF line endings, trailing newline. */
export function indexBytes(index) {
  return Buffer.from(JSON.stringify(index, null, 2) + '\n', 'utf8')
}

/** A usable generatedAt from index.json bytes, or undefined. */
export function generatedAtOf(bytes) {
  try {
    const at = JSON.parse(bytes.toString('utf8')).generatedAt
    return typeof at === 'string' && !Number.isNaN(Date.parse(at)) ? at : undefined
  } catch {
    return undefined
  }
}

/** index.json as committed at a git revision, or undefined (no git, unknown revision, no file). */
export function indexBytesAt(root, rev) {
  try {
    return execFileSync('git', ['show', `${rev}:index.json`], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 16 * 1024 * 1024
    })
  } catch {
    return undefined
  }
}

/**
 * The newest generatedAt index.json has had: on disk, and in every commit of HEAD's and
 * origin/main's history. After a `git revert` the file on disk is older than the newest signed
 * list, which apps that saw it would refuse; the signer must sign newer than this.
 * Returns { at, where } or undefined when there is nothing to compare with.
 */
export function newestSignedGeneratedAt(root) {
  let best
  const consider = (at, where) => {
    if (at && (!best || Date.parse(at) > Date.parse(best.at))) best = { at, where }
  }
  const onDisk = join(root, 'index.json')
  if (existsSync(onDisk)) consider(generatedAtOf(readFileSync(onDisk)), 'index.json')
  let revs = []
  try {
    revs = execFileSync(
      'git',
      ['rev-list', '--ignore-missing', '--max-count=1000', 'HEAD', 'origin/main', '--', 'index.json'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    )
      .split('\n')
      .filter(Boolean)
  } catch {
    // Not a git checkout: only the file on disk counts.
  }
  for (const rev of revs) {
    const bytes = indexBytesAt(root, rev)
    if (bytes) consider(generatedAtOf(bytes), `commit ${rev.slice(0, 7)}`)
  }
  return best
}
