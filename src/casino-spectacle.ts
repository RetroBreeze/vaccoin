import * as T from "three";
import { createSignPanel } from "./casino-signs";
import { casinoRooms, CASINO_FLOORS } from "./casino-layout";

type Segment = { a: T.Vector3; b: T.Vector3; color: T.Color };
const champagne = new T.Color(0xffcc69),
  pink = new T.Color(0xff369a),
  cyan = new T.Color(0x31e9ff);
function starTexture() {
  const size = 64,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5 - size / 2) / (size / 2),
        v = (y + 0.5 - size / 2) / (size / 2),
        r = Math.hypot(u, v);
      const rays =
        Math.exp(-Math.abs(u) * 36) * Math.pow(1 - Math.abs(v), 2) +
        Math.exp(-Math.abs(v) * 36) * Math.pow(1 - Math.abs(u), 2);
      const core = Math.exp(-r * r * 90),
        halo = Math.max(0, 1 - r) * 0.07;
      data.set(
        [255, 255, 255, Math.round(Math.min(1, core + rays + halo) * 255)],
        (y * size + x) * 4,
      );
    }
  const texture = new T.DataTexture(data, size, size);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
function neonSign(
  scene: T.Scene,
  text: string,
  x: number,
  y: number,
  z: number,
  width: number,
  color: string,
  rotation = 0,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "italic 900 100px sans-serif";
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeText(text, 512, 100, 960);
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 100, 960);
  ctx.shadowBlur = 7;
  ctx.fillStyle = "#fff1d5";
  ctx.fillText(text, 512, 100, 960);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const height = (width * 192) / 1024,
    ceiling = Math.floor(y / 5) * 5 + 4.4;
  const { faces, hardware } = createSignPanel(texture, width, height, {
    twoSided: true,
    neon: true,
    suspension: ceiling - y - height / 2 - 0.06,
  });
  for (const object of [faces, hardware]) {
    object.position.set(x, y, z);
    object.rotation.y = rotation;
    scene.add(object);
  }
}
export class CasinoSpectacle {
  private readonly time = { value: 0 };
  private readonly tubes: T.InstancedMesh;
  private readonly colors: T.Color[];
  private readonly color = new T.Color();
  constructor(scene: T.Scene) {
    const segments: Segment[] = [];
    const line = (a: number[], b: number[], color: T.Color) =>
      segments.push({
        a: new T.Vector3().fromArray(a),
        b: new T.Vector3().fromArray(b),
        color,
      });
    const rectangle = (
      x0: number,
      x1: number,
      z0: number,
      z1: number,
      y: number,
      color: T.Color,
    ) => {
      line([x0, y, z0], [x1, y, z0], color);
      line([x1, y, z0], [x1, y, z1], color);
      line([x1, y, z1], [x0, y, z1], color);
      line([x0, y, z1], [x0, y, z0], color);
    };
    for (const [index, r] of casinoRooms.entries()) {
      const color = index % 3 === 0 ? cyan : index % 3 === 1 ? pink : champagne;
      rectangle(
        r.x0 + 0.45,
        r.x1 - 0.45,
        r.z0 + 0.45,
        r.z1 - 0.45,
        r.y + 3.95,
        color,
      );
      const x = r.x0 < 0 ? r.x1 + 0.34 : r.x0 - 0.34,
        z = (r.z0 + r.z1) / 2;
      line([x, r.y + 0.25, z - 2.5], [x, r.y + 3.35, z - 2.5], color);
      line([x, r.y + 3.35, z - 2.5], [x, r.y + 3.35, z + 2.5], color);
      line([x, r.y + 3.35, z + 2.5], [x, r.y + 0.25, z + 2.5], color);
    }
    for (const floor of CASINO_FLOORS) {
      for (const side of [-1, 1]) {
        line(
          [side * 8.7, floor + 4.15, 13],
          [side * 8.7, floor + 4.15, 34],
          side < 0 ? pink : cyan,
        );
        line(
          [side * 8.7, floor + 4.15, -13],
          [side * 8.7, floor + 4.15, -34],
          champagne,
        );
      }
    }
    // The balcony drop remains open; trim follows only existing railing segments.
    line([-9, 6, -12], [-9, 6, 12], champagne);
    line([9, 6, -12], [9, 6, 12], champagne);
    line([-9, 6, -12], [9, 6, -12], pink);
    line([-9, 6, 12], [-2, 6, 12], cyan);
    line([2, 6, 12], [9, 6, 12], cyan);
    const crystalPositions: number[] = [];
    for (let tier = 0; tier < 3; tier++) {
      const radius = 3.4 - tier * 0.8,
        y = 7.1 + tier * 0.8;
      for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI) / 16,
          b = ((i + 1) * Math.PI) / 16;
        line(
          [Math.cos(a) * radius, y, Math.sin(a) * radius],
          [Math.cos(b) * radius, y, Math.sin(b) * radius],
          tier === 1 ? pink : champagne,
        );
        if (i % 2 === 0)
          crystalPositions.push(
            Math.cos(a) * radius,
            y - 0.35,
            Math.sin(a) * radius,
          );
      }
    }
    const geometry = new T.CylinderGeometry(0.035, 0.035, 1, 6);
    this.tubes = new T.InstancedMesh(
      geometry,
      new T.MeshBasicMaterial({ toneMapped: false }),
      segments.length,
    );
    const halos = new T.InstancedMesh(
      geometry,
      new T.MeshBasicMaterial({
        transparent: true,
        opacity: 0.14,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      segments.length,
    );
    const dummy = new T.Object3D(),
      up = new T.Vector3(0, 1, 0),
      direction = new T.Vector3();
    this.colors = segments.map((s) => s.color);
    const sparks: number[] = [],
      phases: number[] = [],
      sparkColors: number[] = [];
    segments.forEach((s, i) => {
      direction.subVectors(s.b, s.a);
      const length = direction.length();
      dummy.position.copy(s.a).add(s.b).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(up, direction.normalize());
      dummy.scale.set(1, length, 1);
      dummy.updateMatrix();
      this.tubes.setMatrixAt(i, dummy.matrix);
      this.tubes.setColorAt(i, s.color);
      dummy.scale.set(6, length, 6);
      dummy.updateMatrix();
      halos.setMatrixAt(i, dummy.matrix);
      for (let step = 0.4; step < length; step += 1.7) {
        sparks.push(
          s.a.x + direction.x * step,
          s.a.y + direction.y * step + 0.09,
          s.a.z + direction.z * step,
        );
        phases.push(i * 2.399 + step * 0.7);
        sparkColors.push(1, 0.8, 0.45);
      }
    });
    halos.instanceColor = this.tubes.instanceColor;
    this.tubes.name = "casino-neon";
    halos.name = "casino-neon-halos";
    scene.add(this.tubes, halos);
    const crystals = new T.InstancedMesh(
      new T.OctahedronGeometry(0.18),
      new T.MeshBasicMaterial({ color: 0xffe4a8, toneMapped: false }),
      crystalPositions.length / 3,
    );
    dummy.quaternion.identity();
    dummy.scale.set(1, 2.5, 1);
    for (let i = 0; i < crystalPositions.length; i += 3) {
      dummy.position.fromArray(crystalPositions, i);
      dummy.updateMatrix();
      crystals.setMatrixAt(i / 3, dummy.matrix);
      sparks.push(...crystalPositions.slice(i, i + 3));
      phases.push(i * 0.73);
      sparkColors.push(1, 0.91, 0.66);
    }
    scene.add(crystals);
    const sparkleMaterial = new T.PointsMaterial({
      map: starTexture(),
      size: 0.85,
      vertexColors: true,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    sparkleMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.spectacleTime = this.time;
      shader.vertexShader =
        "uniform float spectacleTime;\nattribute float sparkPhase;\nvarying float sparkle;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <logdepthbuf_vertex>",
        `sparkle=pow(.5+.5*sin(spectacleTime*1.4+sparkPhase),12.0);gl_PointSize*=.25+sparkle;\n#include <logdepthbuf_vertex>`,
      );
      shader.fragmentShader =
        "varying float sparkle;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>\ndiffuseColor.rgb*=1.0+sparkle;diffuseColor.a*=.12+sparkle*.88;`,
      );
    };
    sparkleMaterial.customProgramCacheKey = () => "casino-star-glints-v1";
    const sparkles = new T.Points(
      new T.BufferGeometry()
        .setAttribute("position", new T.Float32BufferAttribute(sparks, 3))
        .setAttribute("color", new T.Float32BufferAttribute(sparkColors, 3))
        .setAttribute("sparkPhase", new T.Float32BufferAttribute(phases, 1)),
      sparkleMaterial,
    );
    sparkles.name = "casino-star-glints";
    scene.add(sparkles);
    // A physical lintel joins the existing atrium columns at x=±8, z=11.
    const signBeam = new T.Mesh(
      new T.BoxGeometry(16, 0.16, 0.28),
      new T.MeshLambertMaterial({ color: 0xb88640 }),
    );
    signBeam.position.set(0, 4.4, 11);
    scene.add(signBeam);
    neonSign(scene, "JACKPOT PARADISE", 0, 3.1, 11, 12, "#ff58a8");
    neonSign(scene, "HIGH ROLLERS", 0, 8.2, -37.4, 10, "#59efff");
    neonSign(scene, "LUCKY 777", -33.7, 3.3, -32.65, 6, "#ffd267");
    neonSign(scene, "WIN BIG", 33.7, 8.3, 32.65, 6, "#ff58a8", Math.PI);
    this.update(0);
  }
  update(time: number) {
    this.time.value = time;
    for (let i = 0; i < this.colors.length; i++)
      this.tubes.setColorAt(
        i,
        this.color
          .copy(this.colors[i])
          .multiplyScalar(
            0.85 + 0.3 * (0.5 + 0.5 * Math.sin(time * 1.2 + i * 0.41)),
          ),
      );
    this.tubes.instanceColor!.needsUpdate = true;
  }
}
