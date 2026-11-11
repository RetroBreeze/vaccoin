import * as T from "three";

export type VacuumSurface = "body" | "trim" | "dark" | "accent" | "coupler";
const textures = new Map<VacuumSurface, T.DataTexture>();

function grain(x: number, y: number, seed: number) {
  let n = Math.imul(x + seed * 73, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** Small, neutral paint/wear maps: shop colours tint the same surface detail. */
export function vacuumTexture(surface: VacuumSurface): T.DataTexture {
  const cached = textures.get(surface);
  if (cached) return cached;
  // Body atlas: painted head on the left, flexible hose/side finish on the right.
  const width = surface === "body" ? 256 : 128;
  const height = 128;
  const pixels = new Uint8Array(width * height * 4);
  const seed =
    ["body", "trim", "dark", "accent", "coupler"].indexOf(surface) + 1;
  const metal = surface === "trim" || surface === "accent";
  const put = (x: number, y: number, value: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const offset = (y * width + x) * 4;
    const v = Math.max(0, Math.min(255, Math.round(value)));
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = v;
    pixels[offset + 3] = 255;
  };
  const rect = (x: number, y: number, w: number, h: number, value: number) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) put(i, j, value);
  };
  const line = (
    x: number,
    y: number,
    endX: number,
    endY: number,
    value: number,
  ) => {
    const steps = Math.max(Math.abs(endX - x), Math.abs(endY - y));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      put(
        Math.round(x + (endX - x) * t),
        Math.round(y + (endY - y) * t),
        value,
      );
    }
  };
  const screw = (x: number, y: number) => {
    rect(x - 2, y - 2, 5, 5, 90);
    rect(x - 1, y - 2, 3, 4, 242);
    line(x - 1, y, x + 1, y, 104);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rubber = surface === "dark" || (surface === "body" && x >= 128);
      const fine = grain(x, y, seed);
      const mottling = grain(Math.floor(x / 7), Math.floor(y / 9), seed);
      const stain = grain(Math.floor(x / 19), Math.floor(y / 23), seed);
      let value =
        (rubber ? 188 : 225) +
        (fine - 0.5) * 22 +
        (mottling - 0.5) * 22 -
        stain * 15;
      if (metal) value += (grain(0, y, seed) - 0.5) * 24;
      if (rubber) value -= y % 16 < 2 ? 24 : 0;
      if (fine > 0.993) value -= 70;
      put(x, y, value);
    }
  }
  // Sparse abrasion follows the direction a floor tool scrapes, not uniform noise.
  for (let i = 0; i < (metal ? 105 : 65); i++) {
    const x = Math.floor(grain(i, 1, seed) * width);
    const y = Math.floor(grain(i, 2, seed) * height);
    const length = 2 + Math.floor(grain(i, 3, seed) * (metal ? 15 : 7));
    line(x, y, x + (metal ? length : 1), y + (metal ? 1 : length), 120);
    line(x + 1, y, x + (metal ? length : 1) + 1, y + (metal ? 1 : length), 247);
  }
  if (surface === "body") {
    // Inset top panel follows the scoop's taper. Highlights and chips read at game scale.
    line(17, 14, 48, 112, 112);
    line(110, 14, 79, 112, 112);
    line(18, 14, 49, 112, 246);
    line(109, 14, 78, 112, 246);
    line(17, 14, 110, 14, 109);
    line(19, 16, 108, 16, 245);
    line(48, 112, 79, 112, 115);
    for (const [x, y] of [
      [25, 23],
      [102, 23],
      [52, 102],
      [75, 102],
    ])
      screw(x, y);
    // Small stamped inventory plate, with a pixel-drawn VC-01 mark.
    rect(42, 35, 44, 17, 83);
    rect(43, 36, 42, 15, 185);
    const glyphs = [
      "101101101101010",
      "111100100100111",
      "000000111000000",
      "111101101101111",
      "010110010010111",
    ];
    glyphs.forEach((glyph, i) => {
      for (let p = 0; p < glyph.length; p++)
        if (glyph[p] === "1")
          rect(46 + i * 7 + (p % 3) * 2, 47 - Math.floor(p / 3) * 2, 2, 2, 62);
    });
    for (let y = 66; y <= 84; y += 6) {
      rect(51, y, 26, 3, 84);
      rect(51, y - 1, 26, 1, 245);
    }
  } else if (surface === "coupler") {
    for (const y of [12, 112]) {
      rect(0, y, width, 2, 103);
      rect(0, y + 2, width, 1, 248);
    }
    screw(24, 64);
    screw(104, 64);
  }
  const texture = new T.DataTexture(pixels, width, height);
  texture.name = `vacuum-${surface}-wear`;
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = texture.minFilter = T.NearestFilter;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  textures.set(surface, texture);
  return texture;
}

/** The original GLB has no UVs. Project each flat face once in model space. */
export function textureVacuumGeometry(
  source: T.BufferGeometry,
  surface: string,
) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const position = geometry.getAttribute("position");
  const uv = new Float32Array(position.count * 2);
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3();
  const normal = new T.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    normal.crossVectors(b.sub(a), c.sub(a)).normalize();
    const top =
      Math.abs(normal.y) >= Math.max(Math.abs(normal.x), Math.abs(normal.z));
    const side = Math.abs(normal.x) > Math.abs(normal.z);
    const head = surface === "body" && a.z < -0.14 && normal.y > 0.5;
    for (let j = i; j < i + 3; j++) {
      const x = position.getX(j),
        y = position.getY(j),
        z = position.getZ(j);
      let u = top ? x : side ? z : x;
      let v = top ? z : y;
      if (head) {
        u = (x / 0.95 + 0.5) * 0.5;
        v = (z + 0.76) / 0.61;
      } else if (surface === "body") {
        // Keep the hose and the plain sides inside the atlas's right-hand tile.
        u =
          0.505 + (side && !top ? (u + 0.81) / 2.1 : (u + 0.82) / 1.32) * 0.49;
        v *= 3;
      } else {
        u *= 2;
        v *= 2;
      }
      uv[j * 2] = u;
      uv[j * 2 + 1] = v;
    }
  }
  geometry.setAttribute("uv", new T.BufferAttribute(uv, 2));
  return geometry;
}
