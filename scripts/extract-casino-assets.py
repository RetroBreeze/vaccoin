"""Extract only runtime assets from the supplied packs; never modify source archives."""
import json
import pathlib
import zipfile
import struct

root = pathlib.Path(__file__).resolve().parents[1]
dest = root / 'public/assets/casino'
dest.mkdir(exist_ok=True)
packs = {
    'Casino_PSX_Asset_Pack.zip': {
        'chair': 'CAS_PROP_Chair_Casino_01', 'lounge-chair': 'CAS_PROP_Chair_VelvetLounge_01',
        'palm': 'CAS_PROP_Palm_Large_01', 'lamp': 'CAS_PROP_Lamp_TableOrnate_01',
        'cocktail': 'CAS_PROP_Table_CocktailRound_01', 'trash': 'CAS_PROP_Trash_Brass_01',
        'doorframe': 'CAS_DoorFrame_DoubleOrnate_01', 'railing': 'CAS_EXT_Balcony_Railing_01',
        'wall': 'CAS_Wall_Wallpaper_01', 'panel': 'CAS_Wall_WoodPanel_01',
        'carpet': 'CAS_Floor_Carpet_01', 'marble': 'CAS_Floor_Marble_Dark_01',
        'ceiling': 'CAS_Ceiling_Coffered_01', 'column': 'CAS_Column_Ornate_01',
        'sofa': 'CAS_PROP_Sofa_TwoSeat_01', 'coffee': 'CAS_PROP_Table_CoffeeMarble_01',
    },
    'PSX_Casino_Slot_Machines_v1.0.zip': {
        'slot-gold': 'CAS_SLOT_GoldenFortune_01', 'slot-classic': 'CAS_SLOT_LuckySeven_01',
        'slot-neon': 'CAS_SLOT_NeonNights_01',
    },
    'PSX_Casino_Table_Games_v1.0.zip': {
        'roulette': 'CAS_TABLE_Roulette_European_01', 'poker': 'CAS_TABLE_Poker_Luxury_01',
        'blackjack': 'CAS_TABLE_Blackjack_Classic_01', 'cash-table': 'CAS_TABLE_Baccarat_Mini_01',
        'wheel': 'CAS_PROP_RouletteWheel_European_01',
    },
}
palette = 'Quarkery'
# Remove only assets recorded by our previous extraction, never source archives.
previous = json.loads((dest / 'provenance.json').read_text()) if (dest / 'provenance.json').exists() else {}
previous_textures = {pathlib.PurePosixPath(t).name for entry in previous.values() for t in entry.get('textures', [])}
manifest = {}
for pack, assets in packs.items():
    with zipfile.ZipFile(root / 'public/assets' / pack) as archive:
        for key, name in assets.items():
            matches = [n for n in archive.namelist() if n.endswith('/'+name+'_'+palette+'.glb')]
            if len(matches) != 1:
                raise ValueError((key, matches))
            data = archive.read(matches[0])
            json_length = struct.unpack_from('<I', data, 12)[0]
            document = json.loads(data[20:20+json_length])
            binary_chunk = data[20+json_length:]
            texture_sources = []
            # Slot/table GLBs contain 1×1 placeholder images. Their real pixel
            # textures ship separately. Bind the selected baked palette PNGs explicitly.
            for image in document.get('images', []):
                image_name = image.get('name', pathlib.PurePosixPath(image.get('uri', '')).name)
                image_name = image_name.replace('_Original', '_'+palette)
                if not image_name.endswith('.png'):
                    image_name += '.png'
                textures = [n for n in archive.namelist() if ('/Textures/'+palette+'/') in n and n.endswith('/'+image_name)]
                if len(textures) == 1:
                    texture = archive.read(textures[0])
                    (dest / image_name).write_bytes(texture)
                    image.pop('bufferView', None)
                    image['name'] = image_name
                    image['uri'] = image_name
                    texture_sources.append(textures[0])
                elif image.get('uri'):
                    raise ValueError(('Unresolved palette texture', key, image))
            encoded = json.dumps(document, separators=(',', ':')).encode()
            encoded += b' ' * (-len(encoded) % 4)
            data = struct.pack('<III', 0x46546c67, 2, 20+len(encoded)+len(binary_chunk)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + binary_chunk
            (dest / (key+'.glb')).write_bytes(data)
            manifest[key] = {'palette': palette, 'archive': pack, 'source': matches[0], 'textures': texture_sources, 'bytes': len(data)}
current_textures = {pathlib.PurePosixPath(t).name for entry in manifest.values() for t in entry['textures']}
for obsolete in previous_textures - current_textures:
    (dest / obsolete).unlink(missing_ok=True)
(dest / 'provenance.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(f'Extracted {len(manifest)} GLBs, {sum(v["bytes"] for v in manifest.values()):,} bytes')
