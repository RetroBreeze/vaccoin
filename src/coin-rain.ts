import { Euler, Matrix4, Vector3 } from "three";
import { makeCoinGeometry } from "./coin-geometry";

const COIN_COUNT = 65;
const FRAME_COUNT = 96;
const ATLAS_COLUMNS = 12;
const TILE_SIZE = 64;
const COIN_SCALE = 90;
const ROTATION_PERIOD = Math.PI * 2;

function random(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Accelerate smoothly into a constant terminal fall speed. */
export function coinFallDistance(
  age: number,
  initial: number,
  acceleration: number,
  terminal: number,
) {
  const accelerating = Math.min(age, (terminal - initial) / acceleration);
  return (
    initial * accelerating +
    0.5 * acceleration * accelerating * accelerating +
    terminal * (age - accelerating)
  );
}

export function coinFallDuration(
  distance: number,
  initial: number,
  acceleration: number,
  terminal: number,
) {
  const accelerating = (terminal - initial) / acceleration;
  const accelerationDistance = ((initial + terminal) * accelerating) / 2;
  return distance <= accelerationDistance
    ? (Math.sqrt(initial * initial + 2 * acceleration * distance) - initial) /
        acceleration
    : accelerating + (distance - accelerationDistance) / terminal;
}

const particles = Array.from({ length: COIN_COUNT }, (_, i) => {
  const depth = 0.45 + random(i + 1) * 0.6;
  const initial = 45 + depth * 55;
  const acceleration = 35 + random(i + 101) * 55;
  const terminal = 140 + depth * 105;
  return {
    depth,
    initial,
    acceleration,
    terminal,
    duration: coinFallDuration(620, initial, acceleration, terminal),
    phase: random(i + 201),
    tumble: (1.3 + random(i + 301) * 2.5) * (i % 2 ? -1 : 1),
    roll: (0.15 + random(i + 401) * 0.65) * (i % 3 ? 1 : -1),
  };
});

/** The old title-screen coins, cached once for inexpensive canvas compositing. */
export class CoinRain {
  private readonly canvas = document.createElement("canvas");
  private readonly context: CanvasRenderingContext2D | null;
  private readonly motion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private atlas: HTMLCanvasElement | null = null;
  private tilePixels = 0;
  private width = 0;
  private height = 0;
  private dpr = 0;
  private staticDrawn = false;
  private wasReduced = false;

  constructor(private readonly root: HTMLElement) {
    this.canvas.id = "menu-coins";
    this.canvas.className = "menu-rain";
    this.canvas.setAttribute("aria-hidden", "true");
    this.context = this.canvas.getContext("2d");
    root.append(this.canvas);
  }

  private makeAtlas() {
    const atlas = document.createElement("canvas");
    // Keep the atlas at 1x (768 × 512, about 1.5 MB) even on high-DPI phones.
    this.tilePixels = TILE_SIZE;
    atlas.width = ATLAS_COLUMNS * this.tilePixels;
    atlas.height = Math.ceil(FRAME_COUNT / ATLAS_COLUMNS) * this.tilePixels;
    const context = atlas.getContext("2d");
    if (!context) return;
    const geometry = makeCoinGeometry();
    const positions = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const rotation = new Matrix4();
    const euler = new Euler();
    const faces = Array.from({ length: positions.count / 3 }, (_, i) => ({
      points: [new Vector3(), new Vector3(), new Vector3()],
      depth: 0,
      color:
        uv.getY(i * 3) > 0.34
          ? "#986020"
          : uv.getY(i * 3) < 0.27
            ? "#ffe394"
            : "#efb83e",
      index: i,
    }));
    const scale = (COIN_SCALE * this.tilePixels) / TILE_SIZE;
    for (let frame = 0; frame < FRAME_COUNT; frame++) {
      const angle = (frame / FRAME_COUNT) * ROTATION_PERIOD;
      // The mesh's normal points along Y: rotating X turns face → edge → back.
      rotation.makeRotationFromEuler(
        euler.set(angle, 0.28, Math.sin(angle) * 0.2),
      );
      for (const face of faces) {
        face.depth = 0;
        for (let j = 0; j < 3; j++) {
          const point = face.points[j];
          point
            .fromBufferAttribute(positions, face.index * 3 + j)
            .applyMatrix4(rotation);
          face.depth += point.z;
        }
      }
      // Preserve the original bevel and thickness with back-to-front triangles.
      faces.sort((a, b) => a.depth - b.depth);
      const x = ((frame % ATLAS_COLUMNS) + 0.5) * this.tilePixels;
      const y = (Math.floor(frame / ATLAS_COLUMNS) + 0.5) * this.tilePixels;
      for (const face of faces) {
        context.beginPath();
        context.moveTo(
          x + face.points[0].x * scale,
          y + face.points[0].y * scale,
        );
        context.lineTo(
          x + face.points[1].x * scale,
          y + face.points[1].y * scale,
        );
        context.lineTo(
          x + face.points[2].x * scale,
          y + face.points[2].y * scale,
        );
        context.closePath();
        context.fillStyle = face.color;
        context.fill();
      }
    }
    geometry.dispose();
    this.atlas = atlas;
  }

  /** Called by the existing game RAF only while the lobby is visible. */
  draw(timeSeconds: number) {
    const context = this.context;
    if (!context) return;
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (width !== this.width || height !== this.height || dpr !== this.dpr) {
      this.width = width;
      this.height = height;
      this.dpr = dpr;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.staticDrawn = false;
    }
    if (!this.atlas) this.makeAtlas();
    if (!this.atlas) return;
    const reduced = this.motion.matches;
    if (reduced && this.wasReduced && this.staticDrawn) return;
    this.wasReduced = reduced;
    const time = reduced ? 0 : timeSeconds;
    context.clearRect(0, 0, width, height);
    const scale = height / 540;
    const logicalWidth = width / scale;
    for (let i = 0; i < COIN_COUNT; i++) {
      const particle = particles[i];
      const elapsed = time + particle.phase * particle.duration;
      const cycle = Math.floor(elapsed / particle.duration);
      const age = elapsed - cycle * particle.duration;
      const seed = i * 379 + cycle * 977;
      // Every respawn starts above the viewport. Horizontal drift never wraps.
      const anchor = (0.06 + random(seed + 501) * 0.88) * logicalWidth;
      const drift = (random(seed + 601) - 0.5) * 11 * age;
      const flutter =
        Math.sin(age * 1.1 + particle.phase * ROTATION_PERIOD) * 12;
      const wind = Math.sin(time * 0.24 + particle.depth) * 15;
      const x = anchor + drift + flutter + wind;
      const y =
        coinFallDistance(
          age,
          particle.initial,
          particle.acceleration,
          particle.terminal,
        ) - 40;
      const angle =
        age * particle.tumble * (0.8 + random(seed + 701) * 0.4) +
        random(seed + 801) * ROTATION_PERIOD;
      const wrappedAngle =
        ((angle % ROTATION_PERIOD) + ROTATION_PERIOD) % ROTATION_PERIOD;
      const frame = Math.floor((wrappedAngle / ROTATION_PERIOD) * FRAME_COUNT);
      const size =
        (TILE_SIZE * (45 + particle.depth * 35) * scale) / COIN_SCALE;
      const roll = particle.phase * ROTATION_PERIOD + age * particle.roll;
      const cosine = Math.cos(roll) * dpr;
      const sine = Math.sin(roll) * dpr;
      context.setTransform(
        cosine,
        sine,
        -sine,
        cosine,
        x * scale * dpr,
        y * scale * dpr,
      );
      context.globalAlpha = 0.25 + particle.depth * 0.35;
      context.drawImage(
        this.atlas,
        (frame % ATLAS_COLUMNS) * this.tilePixels,
        Math.floor(frame / ATLAS_COLUMNS) * this.tilePixels,
        this.tilePixels,
        this.tilePixels,
        -size / 2,
        -size / 2,
        size,
        size,
      );
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.globalAlpha = 1;
    this.staticDrawn = reduced;
  }
}
