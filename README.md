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
| `links.json` (optional)    | The app's own links (support, Terms, …): see "Links and the shop" below    |
| `purchase.json` (optional) | Lemon Squeezy store/product IDs and checkout link: see below               |
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

## Switching off a tester key

Free tester keys (mashup-app decision D28) are made with mashup-app's
`scripts/make-tester-key.mjs`, which prints each key's id. To switch one off, add its id to
`revoked-tester-keys.json` (a JSON list, e.g. `["k7f3q9xa2b"]`; create the file if it isn't there)
and sign again. `sign.mjs` copies the ids into `index.json` as `revokedTesterKeys`; the app locks
that key on its next catalog check, for good on that PC. `verify.mjs` checks both match.

## Links and the shop (fill in later)

The app's own links and the Lemon Squeezy IDs live in this repo, so they reach every player with the
next signed catalog and **no app update**. Until a value is filled in, the app hides its button (or
shows only the email), and buying says "Coming soon".

**Links: `links.json`** (create it at the top of this repo). Every key is optional; fill in what
exists. Each value must be an `https://` address, or `mailto:` plus one email address where shown.

| Key           | What it is                                      | Shown as                                              |
| ------------- | ----------------------------------------------- | ----------------------------------------------------- |
| `support`     | Discord invite (https)                          | "Get help" (Settings, error screens, Play failure)    |
| `contact`     | Contact and takedown email (`mailto:you@…`)     | "Email us" + the address, when `support` isn't set    |
| `website`     | The website (https)                             | (kept for later screens)                              |
| `terms`       | Terms of service (https)                        | Unlock screen and Settings fine print                 |
| `privacy`     | Privacy policy (https)                          | Unlock screen and Settings fine print                 |
| `refunds`     | Refund policy (https)                           | Unlock screen and Settings fine print                 |
| `requests`    | Mashup request form (https) or `mailto:`        | "Request a mashup" in the library                     |
| `reportRelay` | Where "Report a problem" sends reports (https)  | Not shown; used by the reports feature                |

```json
{
  "support": "https://discord.gg/XXXXXXX",
  "contact": "mailto:hello@example.com",
  "website": "https://example.com/",
  "terms": "https://example.com/terms",
  "privacy": "https://example.com/privacy",
  "refunds": "https://example.com/refunds",
  "requests": "https://example.com/requests",
  "reportRelay": "https://relay.example.com/report"
}
```

**The shop: `purchase.json`**. From the Lemon Squeezy dashboard: the store ID (Settings → Stores, the
number next to the store name), the product ID of the one-click unlock (Products → the product → its ID,
not a variant ID) and its checkout link (Products → Share). Numbers without quotes. Set both IDs
together; the checkout link needs them (the app checks every bought key against them, and a key for any
other store or product never unlocks).

```json
{ "storeId": 12345, "productId": 67890, "checkoutUrl": "https://yourstore.lemonsqueezy.com/buy/…" }
```

Then sign as usual (`node scripts/sign.mjs --key <path>`). `sign.mjs` refuses a bad link or ID and
copies both files into `index.json` as `links` and `purchase`; `verify.mjs` checks they match. Older
apps (0.2.5 and before) ignore both. IDs built into the app (`LICENCE_CONFIG` in mashup-app's
`src/main/licence/config.ts`) always win over these, so a wrong catalog can't move a build that has
them. Changing the product ID later locks every key bought for the old product at its next check.

## The signing key

- The **private key never goes in git or GitHub**. It lives with the founder, outside every repo.
  Recipes are signed locally with `scripts/sign.mjs`; CI only verifies.
- If the private key leaks: make a new key pair, put the new public key in `public-key.pem` and
  in the app (`src/shared/catalog-key.ts`), ship an app update, and re-sign.

## Licence

See [LICENSE](LICENSE). Recipes are instructions and links only; each linked file keeps its own
creator's licence.

## Same-day changes if a rights holder asks (kill switch)

The app reads this catalog every time it starts, so these reach every player without an app update:

- **Make a mashup free:** set its `"tier"` to `"free"`, then sign and push.
- **Take a mashup out:** `git mv recipes/<id>.json held/`, then sign and push. It disappears from the app and
  stays gone offline (the app keeps the newest signed list it has seen).
- Sign: `node scripts/sign.mjs --key <path to the private key>`, check: `node scripts/verify.mjs`.
- **Undoing a change with `git revert`:** always run `sign.mjs` again before pushing. The revert brings
  back an older signed `index.json`, and apps that saw the newer list ignore an older one. `sign.mjs`
  notices and signs it again with a newer time; CI (`verify.mjs`) fails a push whose `index.json`
  isn't newer than the one before it.

`sign.mjs` always dates a new signature after the newest `index.json` in the repo's history (run
`git pull` first so it sees the latest), and refuses to sign if this PC's clock is more than a day
behind that date: fix the date and time in Windows settings, then sign again. It never signs with a
date more than a day ahead of this PC's clock.

**If a list was signed with a wrong date in the future** (and this PC's date and time are right):
`node scripts/sign.mjs --key <path> --allow-reset-date` signs with this PC's time anyway, and
`verify.mjs` accepts it because the list before it is dated more than a day ahead. Apps don't keep a
list dated more than a day ahead of their own clock as the newest one, so they take the reset list
at once; only a PC that already kept the future-dated list (it checked within a day of that date)
keeps it until a list signed after that date arrives. Until that date has passed, `sign.mjs` needs
`--allow-reset-date` each time (the future-dated list is still in the history).
