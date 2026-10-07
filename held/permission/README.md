# Waiting for permission

Draft recipes for mashups whose creators haven't given us permission yet. They are not in the signed catalog,
so the app never shows them. Nothing here gets signed or moved to `recipes/` until the creator says yes in
writing. Every download in them was fetched and re-hashed on 2026-10-06.

Contact route: GitHub (open an issue on the repo, or the profile's listed links). X handles weren't checked:
GitHub profile pages couldn't be opened from the build machine, so look at each profile before writing.

| Recipe | Creator, contact | What to ask for | App support still needed |
| --- | --- | --- | --- |
| `mc-passthrough.json` (GTA V Legacy) | AZP3001, <https://github.com/AZP3001> ([repo](https://github.com/AZP3001/mc-passthrough)) | Permission to install it from the repo (no licence file; only the jar's metadata says MIT, inherited from universal-modder), **and** a GitHub release with a built `MCPassthrough.asi` plus the jar from the same commit. The repo only has the GTA side as source (building needs WSL + Visual Studio C++), so the ASI download is `TODO` until they publish it. | None beyond `minecraft-gta-v` (Script Hook V, ReShade as ASI, Prism). Needs a guard so it and `minecraft-gta-v` are never installed together: both put `MCPassthrough.asi` in GTA's folder and use port 25599. |
| `gta-v-enhanced-steve.json` (GTA V Enhanced) | utku6767, <https://github.com/utku6767> ([repo](https://github.com/utku6767/Gta-V-Enhanced-Minecraft-Steve-Passthrough)) | Permission to install the prebuilt files at commit 32f457c (they removed their MIT licence on 5 Oct; only upstream's MIT notice is left under `source/`). Ask whether `openrpf.asi`, listed as a prerequisite, is really needed (left out: the mod changes no game archives). | GTA V Enhanced support: confirm the scanner entry (appid 3240220, `GTA5_Enhanced.exe`); let the Script Hook V loader accept Enhanced (it blocks it today); a Script Hook V version rule for Enhanced builds (1158, not 3889); ReShade as `dxgi.dll` in Enhanced; confirm Enhanced's Documents folder (`Rockstar Games/GTAV Enhanced`) and that `-nobattleye` works there. Guard against installing alongside `gtacraft`. |
| `redcraft.json` (RDR2) | Keel62155, <https://github.com/Keel62155> ([repo](https://github.com/Keel62155/Minecraft-X-Games)) | One message covering all five Minecraft X Games recipes: permission to install their releases (no licence chosen; the notices say "ask before reusing"). Optional: a setting to point the mods at another Prism folder than `%LOCALAPPDATA%\SkyCraft\Prism`. | Scanner entry for RDR2 (1174180, `RDR2.exe`); a Script Hook RDR2 loader module (detect, game-version rule, dinput8 conflicts); an XML step that sets element text, to switch RDR2 to DirectX 12 (`<API>` in `Settings/system.xml`) instead of the "Important" tick; decide whether RDR2 counts as `offlineOnly`. |
| `gtacraft.json` (GTA V Enhanced) | Keel62155, as above | As above. Note it's an unplayed first build. | Same GTA V Enhanced support as `gta-v-enhanced-steve`. |
| `cybercraft.json` (Cyberpunk 2077) | Keel62155, as above | As above. | Nothing new for installing (RED4ext and ReShade exist). A JSON settings step would let us turn frame generation off instead of the "Important" tick. Guard against installing alongside `minepunk`. |
| `peakcraft.json` (PEAK) | Keel62155, as above | As above. | Scanner entry for PEAK (3527290, `PEAK.exe`); a BepInEx loader module for PEAK (today's is Valheim-only); hash the BepInExPack_PEAK download (Thunderstore was unreachable here, so `TODO`) and confirm its zip has a `BepInExPack_PEAK/` top folder; confirm the save folder (`LocalLow/LandCrab/PEAK` is a guess). |
| `readycraft.json` (Ready or Not) | Keel62155, as above | As above. | Scanner entry for Ready or Not (1144200, exe in `ReadyOrNot/Binaries/Win64`); spot other mods' `version.dll` in that folder before installing; confirm the save folder (`%LOCALAPPDATA%/ReadyOrNot/Saved/SaveGames`). |
| `raccoon-city-skylines.json` (Resident Evil 2 + Cities: Skylines) | mmcvey02, <https://github.com/mmcvey02> ([repo](https://github.com/mmcvey02/ResidentEternal)) | Permission to install the zip at commit 720173b (no licence file). Ask them to confirm it works with today's REFramework nightly (one `REFramework.zip`; the per-game `RE2.zip` their guide names isn't made any more). | Scanner entries for RE2 (883710, `re2.exe`) and Cities: Skylines (255710, `Cities.exe`); a REFramework loader module; Play with a second Steam game as the guest instead of Minecraft; a `{steam-userdata}` placeholder so RE2's Steam-folder saves can be backed up; undo cleanup for the settings files both mods create while running; turning the mod on in Cities: Skylines stays an "Important" tick (its setting is in a binary file). |

All five Keel62155 recipes reuse SkyCraft's Minecraft (SkyCraft 0.1.2's Fabric mod, pinned as in `skycraft.json`)
in their own Prism instance, started hidden **before** the game. The mods see that Minecraft through SkyCraft's
`Local\SkyCraft_v1_minecraft` mutex and don't try to start their own from `%LOCALAPPDATA%\SkyCraft\Prism`.
Friend play (e4mc) stays off because these instances don't include e4mc; keep it that way, especially for the RDR2
and GTA ones. The app must also refuse to run two SkyCraft-based mashups at once (SkyCraft, FalloutCraft, OWCraft,
VegasCraft and these five share one link name).

Skipped: ArkWeb (luki-1). It's source only with no licence, so it can't be built without permission.
