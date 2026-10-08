#!/usr/bin/env node
// Checks the catalog the way the app does: index.json.sig must verify against public-key.pem, every
// recipe's SHA-256 must match index.json, and index.json must list exactly the files in recipes/.
// The optional "revokedTesterKeys" list must be valid tester key ids and match revoked-tester-keys.json.
// A changed index.json must have a newer generatedAt than the previous one (apps refuse older
// lists), compared with --previous <git revision> (CI passes the commit before the push), or
// origin/main by default. An empty --previous "" (no earlier commit known) skips that check, and so
// does a previous list dated more than a day in the future (signed with a wrong clock; reset with
// sign.mjs --allow-reset-date).
//
//   node scripts/verify.mjs [--previous <rev>]
import { createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  generatedAtOf,
  indexBytesAt,
  listRecipeFiles,
  readRevokedTesterKeys,
  recipeProblems,
  revokedListProblems,
  REVOKED_TESTER_KEYS_FILE,
  sha256Hex
} from './lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []

const args = process.argv.slice(2)
let previousRev = 'origin/main'
for (let i = 0; i < args.length; i++) {
  // CI may pass an empty revision (no commit before this one): nothing to compare with.
  if (args[i] === '--previous') previousRev = args[++i] ?? ''
  else {
    console.error(`verify: unknown option ${args[i]}`)
    process.exit(1)
  }
}

let index
let bytes
try {
  bytes = readFileSync(join(root, 'index.json'))
  const sig = Buffer.from(readFileSync(join(root, 'index.json.sig'), 'utf8').trim(), 'base64')
  const key = createPublicKey(readFileSync(join(root, 'public-key.pem'), 'utf8'))
  if (sig.length !== 64 || !verify(null, bytes, key, sig)) errors.push("index.json.sig doesn't verify against public-key.pem")
  index = JSON.parse(bytes.toString('utf8'))
} catch (err) {
  errors.push(`couldn't read the index: ${err.message}`)
}

if (index) {
  if (index.schemaVersion !== 1) errors.push('index.json schemaVersion must be 1')
  const files = new Map(listRecipeFiles(root).map((f) => [f.path, f]))
  const listed = new Set()
  for (const entry of index.recipes ?? []) {
    listed.add(entry.path)
    const file = files.get(entry.path)
    if (!file) {
      errors.push(`index.json lists ${entry.path}, which doesn't exist`)
      continue
    }
    if (sha256Hex(file.bytes) !== entry.sha256) errors.push(`${entry.path} changed after signing (run sign.mjs)`)
    if (file.id !== entry.id) errors.push(`${entry.path} is listed with id "${entry.id}"`)
    for (const p of recipeProblems(file)) errors.push(`${entry.path} ${p}`)
  }
  for (const path of files.keys()) if (!listed.has(path)) errors.push(`${path} isn't in index.json (run sign.mjs)`)

  const revoked = readRevokedTesterKeys(root)
  for (const p of revoked.problems) errors.push(`${REVOKED_TESTER_KEYS_FILE} ${p}`)
  if ('revokedTesterKeys' in index) {
    for (const p of revokedListProblems(index.revokedTesterKeys)) errors.push(`index.json revokedTesterKeys ${p}`)
    if (Array.isArray(index.revokedTesterKeys) && index.revokedTesterKeys.length === 0) {
      errors.push('index.json revokedTesterKeys is empty (leave it out instead; run sign.mjs)')
    }
  }
  const signed = Array.isArray(index.revokedTesterKeys) ? index.revokedTesterKeys : []
  if (JSON.stringify(signed) !== JSON.stringify(revoked.ids)) {
    errors.push(`index.json revokedTesterKeys doesn't match ${REVOKED_TESTER_KEYS_FILE} (run sign.mjs)`)
  }
}

// generatedAt must move forward, or apps that saw the previous list keep it and ignore this one
// (e.g. after a `git revert` that brought an older signed index.json back).
if (index && bytes) {
  const previous =
    previousRev === '' || /^0+$/.test(previousRev) ? undefined : indexBytesAt(root, previousRev)
  if (!previous) {
    console.log(
      previousRev === ''
        ? 'verify: no previous revision given; skipped the date check'
        : `verify: no index.json at ${previousRev} to compare dates with; skipped that check`
    )
  } else if (!previous.equals(bytes)) {
    const DAY_MS = 24 * 60 * 60 * 1000
    const before = generatedAtOf(previous)
    const now = generatedAtOf(bytes)
    if (!now) errors.push('index.json has no valid generatedAt')
    else if (before && Date.parse(before) > Date.now() + DAY_MS) {
      console.log(
        `verify: ${previousRev}'s generatedAt (${before}) is more than a day in the future (a wrong clock); a reset date is allowed`
      )
    } else if (before && Date.parse(now) <= Date.parse(before)) {
      errors.push(
        `index.json generatedAt (${now}) isn't newer than ${previousRev}'s (${before}); apps would ignore this list. Run sign.mjs again (it signs with a newer time).`
      )
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`verify: ${e}`)
  process.exit(1)
}
const revokedCount = Array.isArray(index.revokedTesterKeys) ? index.revokedTesterKeys.length : 0
console.log(
  `verify: OK, ${index.recipes.length} recipes, ${revokedCount} switched-off tester keys, signed ${index.generatedAt}`
)
