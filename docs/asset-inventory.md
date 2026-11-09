# Asset inspection

Inspected the supplied KayKit Bits Bundle 2 before implementation. All selected files were already glTF with separate BIN buffers and PNG palette textures, so conversion was unnecessary.

- Board Game Bits: `coin_gold.gltf` — detailed arena emblem, original gold palette/material. Original coin costs 320 triangles per instance; user explicitly approved a new eight-sided collectible. The collectible now uses a 48-triangle bevelled octagon with UVs into the same palette.
- Resource Bits: `Containers_Crate_Small_Green.gltf`, `Containers_Crate_Large.gltf` — two destruction classes. `Gold_Bars_Stack_Large.gltf`, `Money_Bills_Stack_Large.gltf`, `Gems_Chest.gltf` — reward landmarks.
- Block Bits: `vault.gltf`, `colored_block_blue.gltf`, `striped_block_yellow.gltf`, `metalframe.gltf`, `pipe.gltf` — vault landmark and modular accents.
- RPG and EXTRA content was available; no unrelated weapon props were needed for this non-combat arena.

Copied each selected glTF's declared buffers and images, preserving relative paths. The original full pack is not modified. The vacuum and broad traversal surfaces are custom meshes to keep silhouette and collision simple.
