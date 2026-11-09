import { BufferGeometry, Float32BufferAttribute } from "three";
// 48 triangles, eight sides, a raised bevel. Palette UVs use the original
// KayKit board-game gold swatch; no replacement texture or material needed.
export function makeCoinGeometry() {
  const positions: number[] = [],
    uvs: number[] = [];
  const point = (radius: number, y: number, i: number) => [
    Math.cos((i * Math.PI) / 4) * radius,
    y,
    Math.sin((i * Math.PI) / 4) * radius,
  ];
  const triangle = (a: number[], b: number[], c: number[], v: number) => {
    positions.push(...a, ...b, ...c);
    uvs.push(0.332, v, 0.332, v, 0.332, v);
  };
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8,
      a = point(0.17, 0.035, i),
      b = point(0.17, 0.035, j),
      c = point(0.215, 0.015, i),
      d = point(0.215, 0.015, j),
      e = point(0.215, -0.025, i),
      f = point(0.215, -0.025, j);
    triangle([0, 0.035, 0], b, a, 0.29);
    triangle(a, b, c, 0.255);
    triangle(b, d, c, 0.255);
    triangle(c, d, e, 0.37);
    triangle(d, f, e, 0.37);
    triangle([0, -0.025, 0], e, f, 0.31);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}
