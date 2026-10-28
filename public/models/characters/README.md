# Character model assets

The GLB files in this directory are CC0 character data exported by the
[CharacterCreator project](https://github.com/kblood/CharacterCreator) at
commit `852e48f316b90a0937234886630e4fb4cdfd1f78` (2026-10-03).
That project records its generated body, hair, clothing, and animation GLBs as
**CC0-1.0**; the source body, hair, skin, and clothing assets are from the
MakeHuman System Assets CC0 pack. No GPL-covered runtime code from
CharacterCreator or MPFB is included here.

| Local file | Source asset | Purpose |
|---|---|---|
| `body.glb` | `output/base_body_anim.glb` | 53-bone humanoid rig, realistic skin/face, morph targets, idle/walk/run clips |
| `coat.glb` | `output/clothing_trenchcoat.glb` | Rigged long coat |
| `boots.glb` | `output/clothing_boots.glb` | Rigged boots |
| `hair-short.glb` | `output/hair_short02.glb` | Short/slick hairstyles |
| `hair-bob.glb` | `output/hair_bob02.glb` | Bob/wavy preset |
| `hair-long.glb` | `output/hair_long01.glb` | Long hairstyle |
| `hair-ponytail.glb` | `output/hair_ponytail01.glb` | Bun/ponytail preset |
| `hair-curly.glb` | `output/hair_afro01.glb` | Curly hairstyle |

The exported rig is Y-up and faces +Z. The game adapter rotates it 180° around
the vertical axis so its face points along the game's -Z-forward convention;
that same transform keeps the named left/right bones on their correct sides.

CC0 requires no attribution, but this file is kept for provenance and
maintenance. Source license notes: `https://github.com/kblood/CharacterCreator/blob/852e48f316b90a0937234886630e4fb4cdfd1f78/LICENSE-NOTES.md`.
