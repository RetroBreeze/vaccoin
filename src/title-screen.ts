import { pixelText, textWidth } from "./pixel-font";
import { makeCoinGeometry } from "./coin-geometry";
import { Euler, Matrix4, Vector3 } from "three";
import type { UIState } from "./ui";

const logo = typeof Image === "undefined" ? null : new Image();
if (logo) logo.src = "/assets/logo.png";
const coinGeometry = makeCoinGeometry();
const coinPositions = coinGeometry.getAttribute("position");
const coinUV = coinGeometry.getAttribute("uv");
const coinEuler = new Euler();
const rotation = new Matrix4();
const vertex = new Vector3();
const faces = Array.from({ length: coinPositions.count / 3 }, () => ({
  points: Array.from({ length: 3 }, () => new Vector3()), depth: 0, color: "",
}));
const ordered = [...faces];
function drawCoin(c: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number) {
  rotation.makeRotationFromEuler(coinEuler.set(1.1 + angle * 0.3, angle, angle * 0.4));
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    face.depth = 0;
    for (let j = 0; j < 3; j++) {
      vertex.fromBufferAttribute(coinPositions, i * 3 + j).applyMatrix4(rotation);
      face.points[j].copy(vertex);
      face.depth += vertex.z;
    }
    const v = coinUV.getY(i * 3);
    face.color = v > 0.34 ? "#986020" : v < 0.27 ? "#ffe394" : "#efb83e";
  }
  // Painter ordering preserves the raised bevel and thickness while tumbling.
  ordered.sort((a, b) => a.depth - b.depth);
  for (const face of ordered) {
    c.beginPath();
    face.points.forEach((p, j) => {
      const px = x + p.x * size, py = y + p.y * size;
      if (j === 0) c.moveTo(px, py); else c.lineTo(px, py);
    });
    c.closePath();
    c.fillStyle = face.color;
    c.fill();
  }
}

export function titleLayout(w: number) {
  const stacked = w < 800;
  const left = stacked ? w / 2 : w * 0.25;
  return {
    stacked,
    left,
    nameX: left,
    nameY: stacked ? 120 : 250,
    menuY: stacked ? 191 : 326,
    boardX: stacked ? 24 : Math.round(w * 0.51),
    boardY: stacked ? 344 : 54,
    boardW: stacked ? w - 48 : Math.round(w * 0.49) - 36,
    boardH: stacked ? 166 : 430,
  };
}

const gold = "#ffcf58",
  white = "#fff2d2",
  mint = "#8cf0d1";
export function drawTitleScreen(
  c: CanvasRenderingContext2D,
  w: number,
  s: UIState,
  reduced: boolean,
) {
  const g = titleLayout(w),
    t = reduced ? 0 : s.time;
  const rect = (
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
  ) => {
    c.fillStyle = color;
    c.fillRect(
      Math.round(x),
      Math.round(y),
      Math.round(width),
      Math.round(height),
    );
  };
  const text = (
    value: string,
    x: number,
    y: number,
    size = 2,
    color = white,
    align: "left" | "center" | "right" = "left",
  ) => pixelText(c, value, x, y, size, color, align);
  const fit = (value: string, width: number, size: number) => {
    let result = value;
    while (textWidth(result, size) > width && result.length)
      result = Array.from(result).slice(0, -1).join("");
    return result;
  };
  rect(0, 0, w, 540, "#071b2bee");
  // Deterministic particles wrap independently: no allocations or simulation during play.
  for (let i = 0; i < 65; i++) {
    const depth = 0.45 + (i % 5) * 0.15;
    const x = ((i * 137.51 + Math.sin(t * 0.6 + i) * 18) % (w + 30)) - 15;
    const y = ((i * 83.7 + t * (85 + depth * 132.5)) % 590) - 25;
    c.globalAlpha = 0.25 + depth * 0.35;
    drawCoin(c, x, y, 45 + depth * 35, t * (0.7 + depth) + i);
  }
  c.globalAlpha = 1;
  // 90 BPM: fast attack, damped recoil, then rest between beats.
  const beatTime = t * 1.5;
  const beat = beatTime % 1;
  const pulse = reduced
    ? 1
    : 1 + 0.13 * Math.sin(beat * Math.PI * 6) * Math.exp(-beat * 9);
  const logoW = Math.min(g.stacked ? w - 70 : w * 0.43, 500) * pulse;
  const logoH = logoW / 3;
  const logoY = g.stacked ? 51 : 145;
  if (logo?.complete && logo.naturalWidth) {
    c.save();
    c.imageSmoothingEnabled = true;
    c.translate(g.left, logoY);
    // Alternate a six-degree kick left and right on successive beats.
    const direction = Math.floor(beatTime) % 2 === 0 ? 1 : -1;
    const tilt = reduced ? 0 : direction * (Math.PI / 30)
      * Math.sin(beat * Math.PI * 3) * Math.exp(-beat * 4);
    c.rotate(tilt);
    c.drawImage(logo, -logoW / 2, -logoH / 2, logoW, logoH);
    c.restore();
  } else {
    text("VACCOIN", g.left, logoY - 14, 5, gold, "center");
  }
  const { boardX: x, boardY: y, boardW: bw, boardH: bh } = g;
  rect(x + 5, y + 6, bw, bh, "#020d17bb");
  rect(x, y, bw, bh, "#102837f5");
  rect(x, y, bw, 3, mint);
  text("TOP 10", x + 18, y + 17, g.stacked ? 2 : 3, gold);
  if (s.liveStatus !== "CONNECTED")
    text(
      fit(s.liveStatus ?? "LOADING", bw - 170, 1),
      x + bw - 16,
      y + 22,
      1,
      mint,
      "right",
    );
  const entries = (s.liveEntries ?? []).slice(0, 10);
  const champion = entries[0];
  const cy = y + (g.stacked ? 46 : 62);
  rect(x + 12, cy, bw - 24, g.stacked ? 63 : 104, "#203747");
  const rainbow = reduced ? gold : `hsl(${(t * 55) % 360}, 90%, 75%)`;
  text("1", x + 24, cy + 10, g.stacked ? 5 : 8, rainbow);
  const championSize = g.stacked ? 2 : 3;
  text(
    champion ? fit(champion.name, bw - 100, championSize) : "",
    x + 67,
    cy + 26,
    championSize,
    rainbow,
  );
  text(
    champion ? champion.score.toLocaleString("en-US") : "",
    x + 67,
    cy + (g.stacked ? 47 : 62),
    g.stacked ? 1 : 2,
    white,
  );
  const top = cy + (g.stacked ? 73 : 120),
    bottom = y + bh - 30;
  const runners = entries.slice(1);
  if (runners.length) {
    const rowH = reduced
      ? Math.floor((bottom - top) / runners.length)
      : g.stacked
        ? 25
        : 35;
    const rowSize = rowH < 18 ? 1 : 2;
    const cycle = runners.length * rowH;
    const scrolls = !reduced && cycle > bottom - top;
    const offset = reduced || !scrolls ? 0 : (t * 15) % cycle;
    c.save();
    c.beginPath();
    c.rect(x + 12, top - 5, bw - 24, bottom - top + 5);
    c.clip();
    for (let copy = 0; copy < (scrolls ? 2 : 1); copy++)
      runners.forEach((entry, i) => {
        const ry = top + i * rowH - offset + copy * cycle;
        if (ry + rowH < top || ry > bottom) return;
        rect(x + 16, ry - 5, bw - 32, rowH - 3, i % 2 ? "#183343" : "#122c3c");
        text(String(entry.rank).padStart(2, "0"), x + 24, ry, rowSize, mint);
        text(
          fit(entry.name, bw - 150, rowSize),
          x + 60,
          ry,
          rowSize,
          entry.isPlayer ? gold : white,
        );
        text(
          fit(entry.score.toLocaleString("en-US"), 90, rowSize),
          x + bw - 24,
          ry,
          rowSize,
          gold,
          "right",
        );
      });
    c.restore();
  } else if (!champion)
    text(
      s.liveStatus === "CONNECTED" ? "NO SCORES YET" : "WAITING FOR RANKINGS",
      x + bw / 2,
      top + 5,
      1,
      "#96b6c2",
      "center",
    );
}
