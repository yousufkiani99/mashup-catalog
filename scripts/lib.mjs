// Shared helpers for sign.mjs and verify.mjs. Node built-ins only.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
/** Game keys of Rockstar Games titles (GTA, Red Dead, Max Payne, Bully, L.A. Noire, Manhunt). */
const ROCKSTAR_GAME = /^(gta|rdr|red-dead|max-payne|bully|la-noire|manhunt)(-|$)/

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
  if (json.schemaVersion !== 1) problems.push('schemaVersion must be 1')
  for (const key of REQUIRED_KEYS) if (!(key in json)) problems.push(`is missing "${key}"`)
  for (const key of ARRAY_KEYS) if (key in json && !Array.isArray(json[key])) problems.push(`"${key}" must be a list`)
  if (Array.isArray(json.credits) && json.credits.length === 0) problems.push('needs at least one credit')
  // Rockstar's mod guidelines (2026) ask for non-commercial modding: their games' mashups stay free.
  if (
    json.tier !== 'free' &&
    Array.isArray(json.games) &&
    json.games.some((g) => g && typeof g.key === 'string' && ROCKSTAR_GAME.test(g.key))
  )
    problems.push('uses a Rockstar game, so its tier must be "free"')
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

/** The index object, with a fixed key order so the bytes are stable. */
export function buildIndex(files, generatedAt) {
  return {
    schemaVersion: 1,
    generatedAt,
    recipes: files.map((f) => ({ id: f.id, path: f.path, sha256: sha256Hex(f.bytes) }))
  }
}

/** index.json bytes: 2-space JSON, LF line endings, trailing newline. */
export function indexBytes(index) {
  return Buffer.from(JSON.stringify(index, null, 2) + '\n', 'utf8')
}
