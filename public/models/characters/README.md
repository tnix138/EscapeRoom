# Character model assets

The GLB files in this directory are CC0 character data exported by the
[CharacterCreator project](https://github.com/kblood/CharacterCreator) at
commit `852e48f316b90a0937234886630e4fb4cdfd1f78` (2026-10-03).
That project records its generated body, hair, clothing, and animation GLBs as
**CC0-1.0**; source body, hair, skin, and clothing assets are from the
MakeHuman System Assets CC0 pack. No GPL-covered runtime code from
CharacterCreator or MPFB is included here.

| Local file | Source asset | Purpose |
|---|---|---|
| `body.glb` | `output/base_body_anim.glb` + `_CCZONE` from `output/base_body.glb` | 53-bone humanoid rig, face/skin, morph targets, idle/walk/run clips and body-clothing masks |
| `dress.glb` | `output/clothing_dress.glb` | Rigged female dress |
| `shirt.glb` | `output/clothing_shirt.glb` | Rigged long-sleeve shirt |
| `jeans.glb` | `output/clothing_jeans.glb` | Rigged full-length trousers |
| `boots.glb` | `output/clothing_boots.glb` | Rigged boots |
| `hair-short.glb` | `output/hair_short02.glb` | Short/slick hairstyles |
| `hair-bob.glb` | `output/hair_bob02.glb` | Bob/wavy hairstyle |
| `hair-long.glb` | `output/hair_long01.glb` | Long hairstyle |
| `hair-ponytail.glb` | `output/hair_ponytail01.glb` | Bun/ponytail hairstyle |
| `hair-curly.glb` | `output/hair_afro01.glb` | Curly hairstyle |

The game outfits feminine presets with dress and boots, and masculine presets
with shirt, jeans, and boots. The source's animated body export omitted its
`_CCZONE` body-clothing mask, so the identical mask from `output/base_body.glb`
was transferred onto the animated body mesh (both exports have byte-identical
vertex positions and indices). At runtime the adapter removes body triangles
covered by the worn outfit; the source clothing-zone metadata also supports
filtering lower garment triangles if layered outfits are added later.

All 10 shipped models use the same Y-up, +Z-forward 53-bone rig. The game adapter
rotates the model root 180° around the vertical axis so its face points along the
game's -Z-forward convention; that transform keeps named left/right bones on
their correct sides.

For web delivery, geometry, morph targets, and animations use
`EXT_meshopt_compression`; textures use `EXT_texture_webp` and are capped at
1024 px. `GLTFLoader` uses Three.js's local Meshopt decoder. The 10 shipped GLBs
total about 6.98 MB (6.65 MiB), down from about 19.5 MB for the original full
asset set before compression.

CC0 requires no attribution, but this file is kept for provenance and
maintenance. Source license notes:
`https://github.com/kblood/CharacterCreator/blob/852e48f316b90a0937234886630e4fb4cdfd1f78/LICENSE-NOTES.md`.
