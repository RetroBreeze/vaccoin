import { pixelText, textWidth } from "./pixel-font";
import type { UIState } from "./ui";

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
    const y = ((i * 83.7 + t * (34 + depth * 53)) % 590) - 25;
    const radius = 4 + depth * 5;
    const spin = Math.max(0.22, Math.abs(Math.cos(t * 2 + i)));
    c.globalAlpha = 0.2 + depth * 0.35;
    rect(x, y, radius * spin * 2, radius * 2, "#b87926");
    rect(x, y, radius * spin * 2 - 2, radius * 2 - 2, gold);
    rect(x + 2, y + 2, Math.max(1, radius * spin - 2), radius - 1, "#fff3ba");
  }
  c.globalAlpha = 1;
  const logoY = g.stacked ? 44 : 132;
  const logoSize = g.stacked ? 7 : Math.min(10, Math.floor((w * 0.44) / 42));
  text("VACCOIN", g.left + 4, logoY + 6, logoSize, "#704e27", "center");
  text("VACCOIN", g.left, logoY, logoSize, gold, "center");
  if (!g.stacked) {
    rect(g.left - 24, 65, 48, 44, "#b87926");
    rect(g.left - 20, 61, 40, 44, gold);
    rect(g.left - 14, 67, 28, 32, "#f4ad38");
    text("V", g.left, 72, 3, "#fff2d2", "center");
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
