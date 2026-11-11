import {
  BoxGeometry,
  DataTexture,
  NearestFilter,
  SRGBColorSpace,
  MeshLambertMaterial,
  OctahedronGeometry,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from "three";
export const VALUES = [1, 10, 25, 100, 250, 500] as const;
export const ITEM_NAMES = [
  "COIN",
  "LARGE COIN",
  "DOLLAR BILL",
  "GOLD BAR",
  "PEARL",
  "DIAMOND",
] as const;
export function collectibleShapes(
  coin: BufferGeometry,
  material: Material | Material[],
) {
  const large = coin.clone();
  large.scale(1.8, 1.8, 1.8);
  const bill = new BoxGeometry(0.85, 0.045, 0.4);
  const pixels = new Uint8Array(32 * 16 * 4);
  const dollar = [
    "00100",
    "01111",
    "10100",
    "01110",
    "00101",
    "11110",
    "00100",
  ];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 32; x++) {
      const border = x === 1 || x === 30 || y === 1 || y === 14;
      const glyph =
        x >= 13 && x < 18 && y >= 4 && y < 11 && dollar[y - 4][x - 13] === "1";
      const ink = border || glyph;
      pixels.set(
        ink ? [20, 70, 45, 255] : [146, 211, 157, 255],
        (y * 32 + x) * 4,
      );
    }
  const billTexture = new DataTexture(pixels, 32, 16);
  billTexture.magFilter = NearestFilter;
  billTexture.minFilter = NearestFilter;
  billTexture.colorSpace = SRGBColorSpace;
  billTexture.needsUpdate = true;
  const bar = new BoxGeometry(0.65, 0.24, 0.34);
  const vertices = bar.getAttribute("position");
  for (let i = 0; i < vertices.count; i++)
    if (vertices.getY(i) > 0) {
      vertices.setX(i, vertices.getX(i) * 0.75);
      vertices.setZ(i, vertices.getZ(i) * 0.7);
    }
  bar.computeVertexNormals();
  const pearl = new SphereGeometry(0.26, 8, 6);
  const diamond = new OctahedronGeometry(0.45);
  diamond.scale(0.8, 1.3, 0.8);
  return [
    { geometry: coin, material },
    {
      geometry: large,
      material: new MeshLambertMaterial({
        color: 0xffcf45,
        emissive: 0x332100,
      }),
    },
    {
      geometry: bill,
      material: new MeshLambertMaterial({
        map: billTexture,
        color: 0xffffff,
        emissive: 0x082516,
      }),
    },
    {
      geometry: bar,
      material: new MeshLambertMaterial({
        color: 0xffbc36,
        emissive: 0x503000,
      }),
    },
    {
      geometry: pearl,
      material: new MeshLambertMaterial({
        color: 0xffe4f5,
        emissive: 0x50334a,
      }),
    },
    {
      geometry: diamond,
      material: new MeshLambertMaterial({
        color: 0x9df6ff,
        emissive: 0x235d70,
        flatShading: true,
      }),
    },
  ];
}
// Coin-heavy, fixed payout composition, independent of the order machines are burst.
export function burstKind(index: number) {
  return index % 60 === 0 ? 2 : index % 15 === 0 ? 1 : 0;
}

export function looseKind(patch: number, index: number) {
  if (index === 0 && (patch === 1 || patch === 9)) return 5;
  if (index === 0 && (patch === 10 || patch === 0)) return 4;
  if (patch < 12 && index % 240 === 0) return 3;
  return index % 90 === 0 ? 2 : index % 25 === 0 ? 1 : 0;
}
