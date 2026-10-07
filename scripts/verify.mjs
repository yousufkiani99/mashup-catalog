#!/usr/bin/env node
// Checks the catalog the way the app does: index.json.sig must verify against public-key.pem, every
// recipe's SHA-256 must match index.json, and index.json must list exactly the files in recipes/.
// The optional "revokedTesterKeys" list must be valid tester key ids and match revoked-tester-keys.json.
//
//   node scripts/verify.mjs
import { createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  listRecipeFiles,
  readRevokedTesterKeys,
  recipeProblems,
  revokedListProblems,
  REVOKED_TESTER_KEYS_FILE,
  sha256Hex
} from './lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []

let index
try {
  const bytes = readFileSync(join(root, 'index.json'))
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

if (errors.length) {
  for (const e of errors) console.error(`verify: ${e}`)
  process.exit(1)
}
const revokedCount = Array.isArray(index.revokedTesterKeys) ? index.revokedTesterKeys.length : 0
console.log(
  `verify: OK, ${index.recipes.length} recipes, ${revokedCount} switched-off tester keys, signed ${index.generatedAt}`
)
