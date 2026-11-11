import * as T from "three";
import { CASINO_FLOORS, casinoRooms, casinoMachines } from "./casino-layout";

interface CasinoLight {
  x: number;
  z: number;
  floor: number;
  y: number;
  room?: string;
}
export const casinoLights: CasinoLight[] = [];
for (const r of casinoRooms)
  for (const dx of [-6, 6])
    for (const dz of [-6, 0, 6])
      casinoLights.push({
        x: (r.x0 + r.x1) / 2 + dx,
        z: (r.z0 + r.z1) / 2 + dz,
        floor: r.y,
        y: r.y + 4.05,
        room: r.id,
      });
for (const floor of CASINO_FLOORS) {
  for (const x of [-12, 12])
    for (const z of [-30, -20, -8, 8, 20, 30])
      casinoLights.push({ x, z, floor, y: floor + 4.05 });
  for (const x of [-4, 4])
    for (const z of [-29, -19, 19, 29])
      casinoLights.push({ x, z, floor, y: floor + 4.05 });
  for (const x of [-5, 5])
    for (const z of [-5, 5])
      if (floor !== 5)
        casinoLights.push({ x, z, floor, y: floor === 0 ? 7 : floor + 4.05 });
}
// Linear RGB multipliers. Fixtures only illuminate their own room and storey;
// shading is baked once, rather than iterating over lights for every pixel.
export function sampleCasinoLight(
  x: number,
  floor: number,
  z: number,
): [number, number, number] {
  const room = casinoRooms.find(
    (r) => r.y === floor && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1,
  )?.id;
  let light = 0;
  for (const lamp of casinoLights) {
    if (lamp.floor !== floor || lamp.room !== room) continue;
    const d2 = (x - lamp.x) ** 2 + (z - lamp.z) ** 2;
    light += 1.45 * Math.exp(-d2 / 12);
  }
  // A small warm wash from cabinet banks makes their aisles feel inhabited.
  for (const m of casinoMachines)
    if (m.y === floor) {
      const d2 = (x - m.x) ** 2 + (z - m.z) ** 2;
      if (d2 < 9) light += 0.09 * Math.exp(-d2 / 3);
    }
  light = Math.min(1.8, light);
  return [0.38 + light, 0.3 + light * 0.79, 0.32 + light * 0.46];
}
function lightAtlas() {
  const size = 128,
    data = new Uint8Array(size * size * 3 * 4);
  for (let layer = 0; layer < 3; layer++)
    for (let z = 0; z < size; z++)
      for (let x = 0; x < size; x++) {
        const rgb = sampleCasinoLight(
          -42 + ((x + 0.5) * 84) / size,
          CASINO_FLOORS[layer],
          -38 + ((z + 0.5) * 76) / size,
        );
        const offset = ((layer * size + z) * size + x) * 4;
        for (let c = 0; c < 3; c++)
          data[offset + c] = Math.round((rgb[c] / 2.5) * 255);
        data[offset + 3] = 255;
      }
  const texture = new T.DataTexture(data, size, size * 3);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
function softGlow() {
  const size = 64,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(
        (x + 0.5 - size / 2) / (size / 2),
        (y + 0.5 - size / 2) / (size / 2),
      );
      const alpha = Math.pow(Math.max(0, 1 - radius), 3);
      data.set([255, 255, 255, Math.round(alpha * 255)], (y * size + x) * 4);
    }
  const texture = new T.DataTexture(data, size, size);
  texture.needsUpdate = true;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  return texture;
}
export class CasinoAtmosphere {
  private readonly shimmerTime = { value: 0 };
  private readonly haloMaterial: T.PointsMaterial;
  private readonly motes: T.Points;
  private readonly moteBase: Float32Array;
  private readonly marquee: T.Points;
  private readonly marqueeColors: Float32Array;
  constructor(scene: T.Scene) {
    const atlas = lightAtlas(),
      seen = new Set<T.Material>();
    scene.traverse((object) => {
      if (!(object instanceof T.Mesh) || !object.layers.isEnabled(0)) return;
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (
          seen.has(material) ||
          !(
            material instanceof T.MeshLambertMaterial ||
            material instanceof T.MeshStandardMaterial
          )
        )
          continue;
        seen.add(material);
        material.onBeforeCompile = (shader) => {
          shader.uniforms.casinoLightAtlas = { value: atlas };
          shader.uniforms.casinoShimmerTime = this.shimmerTime;
          shader.vertexShader =
            "varying vec3 casinoWorldPosition;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <project_vertex>",
            `#include <project_vertex>
            vec4 casinoPosition=vec4(transformed,1.0);
            #ifdef USE_INSTANCING
              casinoPosition=instanceMatrix*casinoPosition;
            #endif
            casinoWorldPosition=(modelMatrix*casinoPosition).xyz;`,
          );
          shader.fragmentShader =
            "uniform sampler2D casinoLightAtlas;\nuniform float casinoShimmerTime;\nvarying vec3 casinoWorldPosition;\n" +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            `
            float casinoFloor=clamp(floor((casinoWorldPosition.y+0.04)/5.0)+1.0,0.0,2.0);
            vec2 casinoUV=clamp((casinoWorldPosition.xz+vec2(42.0,38.0))/vec2(84.0,76.0),vec2(0.00390625),vec2(0.99609375));
            casinoUV.y=(casinoUV.y+casinoFloor)/3.0;
            outgoingLight*=texture2D(casinoLightAtlas,casinoUV).rgb*2.5;
            // Gold-selective highlights: leave red carpet and dark recesses matte.
            float casinoGold=smoothstep(.05,.2,diffuseColor.r-diffuseColor.b)*smoothstep(.08,.35,diffuseColor.g);
            vec3 casinoLightDirection=normalize((viewMatrix*vec4(.35,.9,.25,0.0)).xyz);
            vec3 casinoHalf=normalize(casinoLightDirection+normalize(vViewPosition));
            float casinoGloss=pow(max(dot(normal,casinoHalf),0.0),48.0);
            float casinoEdge=pow(1.0-max(dot(normal,normalize(vViewPosition)),0.0),4.0);
            float casinoSweep=pow(.5+.5*sin(casinoWorldPosition.x*.65+casinoWorldPosition.z*.4-casinoShimmerTime*.7),24.0);
            outgoingLight+=casinoGold*vec3(1.0,.8,.4)*(casinoGloss*1.6+casinoEdge*.16+casinoSweep*.12);
            #include <opaque_fragment>`,
          );
        };
        material.customProgramCacheKey = () => "casino-warm-atlas-shine-v2";
        material.needsUpdate = true;
      }
    });
    const glow = softGlow(),
      dummy = new T.Object3D();
    const mounts = new T.InstancedMesh(
      new T.CylinderGeometry(0.43, 0.55, 0.12, 8),
      new T.MeshLambertMaterial({ color: 0x9f7136 }),
      casinoLights.length,
    );
    const stems = new T.InstancedMesh(
      new T.CylinderGeometry(0.025, 0.025, 1, 6),
      mounts.material,
      casinoLights.length,
    );
    const bulbs = new T.InstancedMesh(
      new T.SphereGeometry(0.19, 8, 6),
      new T.MeshBasicMaterial({ color: 0xffe0a1, toneMapped: false }),
      casinoLights.length,
    );
    const positions: number[] = [];
    casinoLights.forEach((lamp, i) => {
      dummy.position.set(lamp.x, lamp.y + 0.18, lamp.z);
      dummy.updateMatrix();
      mounts.setMatrixAt(i, dummy.matrix);
      dummy.position.y = lamp.y;
      dummy.updateMatrix();
      bulbs.setMatrixAt(i, dummy.matrix);
      const ceiling = lamp.floor === 0 && lamp.y === 7 ? 9.4 : lamp.floor + 4.4;
      const height = ceiling - lamp.y - 0.2;
      dummy.position.y = ceiling - height / 2;
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(1);
      positions.push(lamp.x, lamp.y, lamp.z);
    });
    scene.add(mounts, bulbs, stems);
    this.haloMaterial = new T.PointsMaterial({
      map: glow,
      color: 0xffbb58,
      size: 2.8,
      opacity: 0.65,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
    });
    const halos = new T.Points(
      new T.BufferGeometry().setAttribute(
        "position",
        new T.Float32BufferAttribute(positions, 3),
      ),
      this.haloMaterial,
    );
    scene.add(halos);
    // Cabinet marquee bulbs sit on the cabinets, so a broken machine's decorative
    // lights can be hidden along with its instances in update().
    const marqueePositions: number[] = [];
    for (const m of casinoMachines)
      for (const offset of [-0.35, 0, 0.35])
        marqueePositions.push(
          m.x + Math.cos(m.rotation) * offset + Math.sin(m.rotation) * 0.23,
          m.y + 2.25,
          m.z - Math.sin(m.rotation) * offset + Math.cos(m.rotation) * 0.23,
        );
    this.marqueeColors = new Float32Array(marqueePositions.length);
    this.marquee = new T.Points(
      new T.BufferGeometry()
        .setAttribute(
          "position",
          new T.Float32BufferAttribute(marqueePositions, 3),
        )
        .setAttribute("color", new T.BufferAttribute(this.marqueeColors, 3)),
      new T.PointsMaterial({
        map: glow,
        size: 0.55,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.marquee.name = "casino-marquee";
    scene.add(this.marquee);
    const motePositions: number[] = [];
    for (let i = 0; i < 150; i++) {
      const lamp = casinoLights[(i * 17) % casinoLights.length];
      motePositions.push(
        lamp.x + Math.sin(i * 12.93) * 2.5,
        lamp.floor + 0.8 + (i % 9) * 0.32,
        lamp.z + Math.cos(i * 8.17) * 2.5,
      );
    }
    this.moteBase = new Float32Array(motePositions);
    this.motes = new T.Points(
      new T.BufferGeometry().setAttribute(
        "position",
        new T.Float32BufferAttribute(motePositions, 3),
      ),
      new T.PointsMaterial({
        map: glow,
        color: 0xffd387,
        size: 0.075,
        opacity: 0.55,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.motes.frustumCulled = false;
    scene.add(this.motes);
    this.update(0, []);
  }
  update(
    time: number,
    broken: readonly { x: number; y: number; z: number; broken: boolean }[],
  ) {
    this.shimmerTime.value = time;
    this.haloMaterial.opacity = 0.65 + Math.sin(time * 0.7) * 0.035;
    const positions = this.motes.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++)
      positions.setXYZ(
        i,
        this.moteBase[i * 3] + Math.sin(time * 0.19 + i) * 0.22,
        this.moteBase[i * 3 + 1] + Math.sin(time * 0.3 + i * 2) * 0.18,
        this.moteBase[i * 3 + 2] + Math.cos(time * 0.17 + i) * 0.22,
      );
    positions.needsUpdate = true;
    const hidden = new Set(
      broken.filter((m) => m.broken).map((m) => `${m.x}:${m.y}:${m.z}`),
    );
    for (let i = 0; i < casinoMachines.length; i++) {
      const m = casinoMachines[i],
        off = hidden.has(`${m.x}:${m.y}:${m.z}`);
      for (let j = 0; j < 3; j++) {
        const strength = off
          ? 0
          : 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(time * 2.1 + i * 0.7 - j * 1.2));
        this.marqueeColors.set(
          [strength, strength * (j === 1 ? 0.64 : 0.82), strength * 0.25],
          i * 9 + j * 3,
        );
      }
    }
    this.marquee.geometry.getAttribute("color").needsUpdate = true;
  }
}
