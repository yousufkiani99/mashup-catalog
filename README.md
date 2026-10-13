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
| `purchase.json` (optional) | The store (itch.io) and the price: see below                               |
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

The app's own links and the store settings live in this repo, so they reach every player with the
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
| `reportRelay` | The app's relay (https)                         | Not shown: "Report a problem", counting, and the itch.io download-key check (Round 7) |
| `clips`       | Discord #clips channel link (https)             | "Open #clips" on the "Share your first clip" card (Round 6); the invite (`support`) if unset |
| `reviews`     | Discord #reviews channel link (https)           | "Write a review" on the card after the third paid play (Round 6); the invite if unset |

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

**The shop: `purchase.json`** (Round 7, mashup-app decision D49: the store is **itch.io**, "collected
by itch.io"; Lemon Squeezy rejected the store on 2026-10-12). Every value comes from the founder's
itch.io dashboard. Fields that aren't known yet can be `null` or left out (they're left out of the
signed index). `itchGameId` switches on unlocking (download keys, and "Sign in with itch.io" with
`itchOauthClientId`), so the founder can test while the itch.io page is a draft; `purchaseUrl`
switches on the Buy buttons (app and website) and is added only when the page is published. Until
then Buy says "Coming soon", and nothing breaks.

| Key                 | Example                                               | What it does                                                                                     |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `provider`          | `"itch"`                                              | The store. The only one the app knows (another store needs app code first)                     |
| `itchUser`          | `"yousufkiani"`                                       | The itch.io account that sells it (`https://<itchUser>.itch.io`)                                 |
| `itchGameId`        | `5148785`                                             | itch.io > Dashboard > Mashup Launcher > Edit game: the number in the address. Unlocking needs it (purchases are checked against it) |
| `itchOauthClientId` | `"…"`                                                 | itch.io > Settings > API keys > OAuth applications: the Client ID (public). "Sign in with itch.io" needs it |
| `purchaseUrl`       | `"https://yousufkiani.itch.io/mashup-launcher/purchase"` | Where every Buy button goes. Must be a page on `<itchUser>.itch.io`. Left out until the page is published; Buy buttons need it |
| `priceCents`        | `499`                                                 | The price on every screen and the website. **Must equal the price on the itch.io page**         |
| `currency`          | `"USD"`                                               | Only USD (no regional pricing)                                                                   |
| `earlyPriceEndsBy`  | `"2026-12-31"`                                        | "Early price · goes up by Dec 31": the price may go up on or before that day. Gone after the day |
| `sale`              | see below                                             | Optional: an itch.io sale mirrored (Round 8). Only inside its dates                              |

```json
{
  "provider": "itch",
  "itchUser": "yousufkiani",
  "itchGameId": 5148785,
  "itchOauthClientId": null,
  "priceCents": 499,
  "currency": "USD",
  "earlyPriceEndsBy": "2026-12-31"
}
```

No discount codes, launch counters, affiliate percentages or test mode in the catalog. (itch.io does
have limited-use coupon codes: a sale with a code and "Maximum redeems". We don't use them: a "first
100" count is scarcity copy our rules forbid, and the app can't see redemptions. itch.io has no
affiliate tracking or test mode for us.) `sign.mjs` refuses the old Lemon Squeezy fields (`storeId`, `productId`, `checkoutUrl`,
`testMode`, `offer`, `affiliatePercent`). Changing `itchGameId` later locks every purchase made for
the old project at its next check, so set it once.

To raise the price: change it on the itch.io page, then `priceCents` here (and remove or move
`earlyPriceEndsBy`), sign, and update the two legal pages on the website (Terms, Refund policy).

**A sale: `sale`** (optional; mashup-app Round 8, decision D52). It mirrors a sale the founder made
on itch.io (Dashboard > Sales & bundles), so the app and the website show the same price as the
itch.io page. Inside `[startsAt, endsAt)` every price shown is `sale.priceCents`, with exactly one
line "Launch sale: $3.49 until Oct 24, then $4.99" (no countdown, no strike-through, no "was") in
place of the early-price note; outside it everything is as if there were no sale, so nothing has
to be signed again when it ends (the website also checks the visitor's clock).

```json
"sale": {
  "priceCents": 349,
  "startsAt": "2026-10-14T16:00:00Z",
  "endsAt": "2026-10-25T03:59:59Z",
  "label": "Launch sale"
}
```

| Key          | Rule                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| `priceCents` | Below `priceCents`; what itch.io charges during the sale ($4.99 at 30% → 349)          |
| `startsAt`   | The itch.io sale's start, exact UTC with a `Z` (convert from the time zone you typed)  |
| `endsAt`     | The itch.io sale's end, exact UTC (11:59:59 PM Eastern in October = 03:59:59Z next day) |
| `label`      | Optional, 3–24 letters and spaces; default "Launch sale"                               |

`sign.mjs` refuses a sale that isn't below the price, ends before it starts, runs longer than 14
days or has a time without `Z`. Rules (mashup-app PROJECT_STATE D52): no second sale within 30 days
of this one ending, and the price must really go up by Dec 31 as the early-price note says. Older
app builds ignore `sale` (they keep showing the regular price).

**Free or paid** is one line per recipe: `"tier": "free"` or `"tier": "unlocked"`. Change it, sign,
and every app follows at its next catalog check (no app update).

Then sign as usual (`node scripts/sign.mjs --key <path>`). `sign.mjs` refuses a bad link or store
field and copies both files into `index.json` as `links` and `purchase`; `verify.mjs` checks they
match. App builds from before Round 7 don't know itch.io and show "Coming soon"; Round 7 builds take
everything from here (nothing store-specific is built into the app).

## Experiments and the featured clip (Round 6)

**`experiments.json`** (optional): the after-play offer experiment. While `active` and between
`startsOn` and `endsBy` (both required when active; UTC days), half of the installs (picked at random on
their first run) get no automatic offer after a free play; everyone else gets the usual one, and only
then does the app send its group with counted events. Off, missing or outside the dates: everyone gets
the usual one. The weekly report judges the result only after `endsBy`.

```json
{ "afterPlayOffer": { "active": true, "startsOn": "2026-11-02", "endsBy": "2026-11-16" } }
```

**`featured-clip.json`** (optional): the weekly #clips challenge winner, shown first in the app's hero
and in the website's hero area. Never a Rockstar mashup (the signer refuses one, D27). `src` must be an `.mp4` on a
GitHub release of ours; `permission` is `"own recording"`, `"written, YYYY-MM-DD"` or
`"Discord ⭐ (author opt-in), YYYY-MM-DD"` (the player put a ⭐ on their own #clips post); a player's clip needs
`credit` (their name and a link to their post). Remove the file to stop featuring it.

```json
{
  "mashupId": "skycraft",
  "src": "https://github.com/yousufkiani99/mashup-library-releases/releases/download/clips/skycraft-week42.mp4",
  "credit": { "name": "@player", "url": "https://discord.com/channels/…/…/…" },
  "permission": "Discord ⭐ (author opt-in), 2026-10-19"
}
```

A recipe may also carry `"testedSetup": "GTX 1060 · Steam"` (one line, up to 60 characters): shown as
"Tested by us on GTX 1060 · Steam" next to a `tested-by-us` label. Only what we really tested on.

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
