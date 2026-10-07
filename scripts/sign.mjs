#!/usr/bin/env node
// Builds index.json from recipes/*.json and signs it with the catalog's ed25519 key.
//
//   CATALOG_SIGNING_KEY="$(cat key.pem)" node scripts/sign.mjs
//   node scripts/sign.mjs --key /path/to/catalog-signing-key.pem
//
// Options:
//   --key <path>   private key PEM file (otherwise the CATALOG_SIGNING_KEY environment variable)
//   --force        re-sign even when the recipes haven't changed
//
// Switching off a free tester key (mashup-app decision D28): add its id to revoked-tester-keys.json
// (a JSON list, e.g. ["k7f3q9xa2b"]) and sign again. The ids go into index.json as
// "revokedTesterKeys"; the app refuses those keys on its next catalog check.
//
// Writes index.json (stable key order, LF) and index.json.sig (base64 signature over the exact
// bytes of index.json). The private key is only read, never written anywhere.
//
// generatedAt always moves forward: apps refuse a list older than one they've already seen, so a
// new signature is always dated after the newest index.json in this repo's history (HEAD and
// origin/main; run `git pull` first). That also covers a `git revert`: the reverted index.json is
// older than the newest one, so it is signed again with a newer time. The signer refuses to sign
// when this PC's clock is more than a day behind that newest date (a wrong clock).
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildIndex,
  indexBytes,
  listRecipeFiles,
  newestSignedGeneratedAt,
  readRevokedTesterKeys,
  recipeProblems,
  REVOKED_TESTER_KEYS_FILE
} from './lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
  console.error(`sign: ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)
let keyPath
let force = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key') keyPath = args[++i]
  else if (args[i] === '--force') force = true
  else fail(`unknown option ${args[i]}`)
}

const keyPem = keyPath ? readFileSync(keyPath, 'utf8') : process.env.CATALOG_SIGNING_KEY
if (!keyPem || !keyPem.trim()) fail('no signing key: set CATALOG_SIGNING_KEY or pass --key <path>')

let privateKey
try {
  privateKey = createPrivateKey(keyPem)
} catch (err) {
  fail(`the signing key isn't a valid PEM private key (${err.message})`)
}
if (privateKey.asymmetricKeyType !== 'ed25519') fail('the signing key must be an ed25519 key')

// The key must match the public key the app has built in.
const publicPem = readFileSync(join(root, 'public-key.pem'), 'utf8')
const derived = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
if (derived.trim() !== publicPem.trim()) fail("the signing key doesn't match public-key.pem")

const files = listRecipeFiles(root)
let bad = false
for (const file of files) {
  for (const problem of recipeProblems(file)) {
    console.error(`sign: ${file.path} ${problem}`)
    bad = true
  }
}
const revoked = readRevokedTesterKeys(root)
for (const problem of revoked.problems) {
  console.error(`sign: ${REVOKED_TESTER_KEYS_FILE} ${problem}`)
  bad = true
}
if (bad) fail('fix the problems above, then sign again')

const indexPath = join(root, 'index.json')
const sigPath = join(root, 'index.json.sig')
const newest = newestSignedGeneratedAt(root)

// Nothing changed since the last signature: leave both files alone (no empty commits).
if (!force && existsSync(indexPath) && existsSync(sigPath)) {
  try {
    const oldBytes = readFileSync(indexPath)
    const old = JSON.parse(oldBytes.toString('utf8'))
    const same = indexBytes(buildIndex(files, old.generatedAt, revoked.ids)).equals(oldBytes)
    const sig = Buffer.from(readFileSync(sigPath, 'utf8').trim(), 'base64')
    const isNewest = !newest || Date.parse(old.generatedAt) >= Date.parse(newest.at)
    if (same && !isNewest) {
      console.log(
        `sign: index.json (${old.generatedAt}) is older than the one in ${newest.where} (${newest.at}); apps would ignore it, so signing it again with a newer time`
      )
    }
    if (same && isNewest && verify(null, oldBytes, createPublicKey(publicPem), sig)) {
      console.log(
        `sign: index.json is up to date (${files.length} recipes, ${revoked.ids.length} switched-off tester keys); nothing to do`
      )
      process.exit(0)
    }
  } catch {
    // Unreadable old index: sign afresh.
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const nowMs = Date.now()
let generatedAtMs = nowMs
if (newest) {
  const newestMs = Date.parse(newest.at)
  if (nowMs < newestMs - DAY_MS) {
    fail(
      `this PC's clock (${new Date(nowMs).toISOString()}) is more than a day behind the newest signed index.json (${newest.at}, ${newest.where}). Fix the date and time in Windows settings, then sign again.`
    )
  }
  // Strictly newer than every list signed before, even if the clock is a little behind.
  generatedAtMs = Math.max(nowMs, newestMs + 1)
}
const bytes = indexBytes(buildIndex(files, new Date(generatedAtMs).toISOString(), revoked.ids))
const signature = sign(null, bytes, privateKey).toString('base64')
writeFileSync(indexPath, bytes)
writeFileSync(sigPath, signature + '\n')
console.log(`sign: signed index.json with ${files.length} recipes`)
for (const f of files) console.log(`  ${f.path}`)
if (revoked.ids.length > 0) console.log(`  switched-off tester keys: ${revoked.ids.join(', ')}`)
