# Held back

Recipes kept here are not in the signed catalog, so the app doesn't show them.

- `gta-san-anskateas.json`, `rust-rewrite-2010.json` (held 2026-10-05): both run on the Skate 3 Rust engine,
  whose source ports routines from EA's Skate 3 executable ("reconstructed from direct disassembly"). Under our
  rule against decompiled game code they stay out until that code is independently rewritten and its licence
  holds at the pinned commit. See the report "Mashup leads and policy checks".

- `valcraft.json` (LoAlCo's ValCraft, held 2026-10-07): its repo has no licence and permission hasn't been
  given yet (PROJECT_STATE §5). Under D4/D11 it stays out of the paid library until LoAlCo says yes. Move it
  back to `recipes/` and re-sign once permission is in writing. ValCraft (strangemap) is a separate MIT project
  and stays in.

- `ultracraft.json` (alfr0762's Ultracraft, held 2026-10-21): the creator's GitHub repo is gone (deleted or made
  private) and our pinned v1.0.4 download returns 404, so it can't install. Melty lists an "UltraCraft" by a
  different account; don't take it from there. Move it back to `recipes/` and re-sign only if alfr0762 publishes
  it again on their own GitHub. Killcraft's `conflictsWith: ["ultracraft"]` stays so old installs still clash.
  ULTRAKILL inside Minecraft (xandermodsstuff-dot, added 2026-10-26) takes its place in the library; it also lists
  `ultracraft` in `conflictsWith` for the same reason.

## Launch 0.2.9 (held 2026-10-26)

These are finished drafts that pass the app's recipe checks (launch/0.2.9), but can't go live yet. Each needs
only the step named here; then `git mv held/<id>.json recipes/`, sign and push.

- `astartes-the-old-blood.json`, `mojave-in-skyrim.json`, `portal-gun-in-outer-wilds.json`: **waiting for build copy.**
  Their community builds on yousufkiani99/mashup-builds (tags `astartes-the-old-blood-v1.0.4`,
  `mojave-in-skyrim-v0.2.0`, `portal-gun-in-outer-wilds-v0.1.0`) haven't been made yet (Mojave's first build
  failed). Fill in each `"TODO"` SHA-256 and `sizeBytes` from the build's SHA256SUMS.txt, check the file names in
  the release match, and publish the draft release before moving the recipe.
- `personacraft.json`: its build copy is done (`personacraft-v0.1.0`, hash pinned), but the mod needs four
  Reloaded-II helper mods the recipe doesn't install yet: p5rpc.lib 1.1.0 and p5rpc.inputhook 1.0
  (AnimatedSwine37), Reloaded.SharedLib.Hooks 1.16.3 (Sewer56) and Reloaded.Memory.SigScan.ReloadedII 3.1.16.
  Each must be added as a pinned download from its creator's GitHub release and unpacked into
  `{appdir}/personacraft/reloaded-ii/Mods/<mod id>`, and listed in `loaderOptions.reloadedII.mods`. Their
  release file names couldn't be listed from the build machine.
- `doom-for-crispberry.json`: all three files come only from Thunderstore (the mod, Crispberry PiPhone 0.17.69
  and BepInExPack_PEAK 5.4.75301), which couldn't be reached to hash them. Download each once, fill in the
  SHA-256s and sizes, and check the folder names inside the zips (the BepInExPack step assumes a `BepInExPack/`
  folder) before moving it.
- `minepeak.json`: needs BepInExPack_PEAK from Thunderstore (same as above) **and** an app feature it doesn't have
  yet: MinePeak's exporter runs in a ~2 GB copy of PEAK that its installer makes, and the app has no step that
  copies a game folder. The draft only covers the Minecraft side. Fabric API 0.156.0+26.2 still needs hashing.
