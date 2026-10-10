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
/** Lemon Squeezy store/product IDs and checkout link, copied into index.json as "purchase". Optional. */
export const PURCHASE_FILE = 'purchase.json'

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
  reportRelay: ['https']
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

/** Problems with a purchase object: positive whole-number IDs, both or neither, an https checkout link. */
export function purchaseProblems(purchase) {
  if (!purchase || typeof purchase !== 'object' || Array.isArray(purchase)) return ['must be a JSON object']
  const problems = []
  const isId = (v) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0
  for (const key of Object.keys(purchase)) {
    if (!['storeId', 'productId', 'checkoutUrl'].includes(key)) problems.push(`"${key}" isn't storeId, productId or checkoutUrl`)
  }
  for (const key of ['storeId', 'productId']) {
    if (purchase[key] !== undefined && !isId(purchase[key])) problems.push(`"${key}" must be a whole number from Lemon Squeezy (no quotes)`)
  }
  if ((purchase.storeId === undefined) !== (purchase.productId === undefined)) problems.push('set both storeId and productId, or neither')
  if (purchase.checkoutUrl !== undefined) {
    if (!isHttpsUrl(purchase.checkoutUrl)) problems.push('"checkoutUrl" must be an https:// address')
    if (purchase.storeId === undefined) problems.push('"checkoutUrl" needs storeId and productId too (the app checks every key against them)')
  }
  return problems
}

/** The purchase settings in a fixed key order, leaving out missing values. */
export function normalizePurchase(purchase) {
  const out = {}
  for (const key of ['storeId', 'productId', 'checkoutUrl']) if (purchase && purchase[key] !== undefined) out[key] = purchase[key]
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
