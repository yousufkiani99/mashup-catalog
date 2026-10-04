# Mashup Library catalog

The list of mashups the Mashup Library app can install. Each mashup has a **recipe**: a small JSON
file that says which games it needs, where to download each piece from its official source, where
the pieces go, how to start the games, and which save folders to back up first.

A recipe is instructions and links only. It never contains anyone's files.

## The no-rehosting rule

Nothing in this repo is a copy of a game, a mod, a loader or a tool, and nothing ever will be.
Every file a recipe needs is downloaded on the player's PC, at install time, from where its creator
publishes it (their GitHub release, their Nexus page, or their own site). Each download is pinned
by its URL and SHA-256, so the app refuses a file that isn't exactly the one we checked. Every
mashup also stays free to install by hand from its creator; recipes link to that route.

Only exception (decision D11 in the app's PROJECT_STATE.md): a public build copy of an MIT or
Apache mashup that has no ready download, unless its creator objects. Loaders and game files: never.

## How it fits together

| File                       | What                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| `recipes/<id>.json`        | One recipe per mashup (format: `src/shared/recipe.ts` in the app)          |
| `index.json`               | Every recipe's path and the SHA-256 of its file                            |
| `index.json.sig`           | ed25519 signature (base64) over the exact bytes of `index.json`            |
| `public-key.pem`           | The public key; the same key is built into the app                         |
| `scripts/sign.mjs`         | Rebuilds `index.json` and signs it                                         |
| `scripts/verify.mjs`       | Checks the signature and every recipe's SHA-256, like the app does         |
| `.github/workflows/sign.yml` | Signs automatically when recipes change on `main`                        |

The app downloads `index.json` and `index.json.sig`, checks the signature with its built-in key,
then downloads each recipe and checks it against the SHA-256 in the signed index. Anything that
fails is refused. An unsigned or changed catalog can't reach players.

## Changing a recipe

1. Edit or add `recipes/<id>.json` (the file name must match its `id`; save with LF line endings).
2. Sign: `node scripts/sign.mjs --key <path to the private key>`, then push to `main`. CI verifies it.
3. Or sign locally: `node scripts/sign.mjs --key <path to the private key>`, then
   `node scripts/verify.mjs`.

`sha256: "TODO"` marks a download nobody has hashed yet. The app reads such a recipe but won't
install it until every download has a real SHA-256.

## The signing key

- The **private key never goes in git or GitHub**. It lives with the founder, outside every repo.
  Recipes are signed locally with `scripts/sign.mjs`; CI only verifies.
- If the private key leaks: make a new key pair, put the new public key in `public-key.pem` and
  in the app (`src/shared/catalog-key.ts`), ship an app update, and re-sign.

## Licence

See [LICENSE](LICENSE). Recipes are instructions and links only; each linked file keeps its own
creator's licence.
