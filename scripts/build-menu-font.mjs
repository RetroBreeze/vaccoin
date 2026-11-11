// Reuse the game's own 5×7 HUD alphabet as a native, selectable web font.
// Regenerate with: node scripts/build-menu-font.mjs
import { readFileSync, writeFileSync } from "node:fs";
import opentype from "opentype.js";

const source = readFileSync(
  new URL("../src/pixel-font.ts", import.meta.url),
  "utf8",
);
const alphabet = Object.fromEntries(
  [...source.matchAll(/^  (?:"([^"]+)"|(\w+)): "([01/]+)"/gm)].map(
    ([, quoted, bare, rows]) => [quoted ?? bare, rows],
  ),
);
Object.assign(alphabet, {
  " ": "000/000/000/000/000/000/000",
  "(": "001/010/100/100/100/010/001",
  ")": "100/010/001/001/001/010/100",
  "&": "01100/10010/10100/01000/10101/10010/01101",
  "@": "01110/10001/10111/10101/10111/10000/01111",
  _: "00000/00000/00000/00000/00000/00000/11111",
  "…": "00000/00000/00000/00000/00000/00000/10101",
  "’": "1/1/0/0/0/0/0",
  "–": "000/000/000/111/000/000/000",
});
function glyph(name, bitmap, unicode) {
  const rows = bitmap.split("/");
  const path = new opentype.Path();
  rows.forEach((row, y) =>
    [...row].forEach((pixel, x) => {
      if (pixel !== "1") return;
      const left = x * 100;
      const bottom = (6 - y) * 100;
      path.moveTo(left, bottom);
      path.lineTo(left, bottom + 100);
      path.lineTo(left + 100, bottom + 100);
      path.lineTo(left + 100, bottom);
      path.close();
    }),
  );
  return new opentype.Glyph({
    name,
    unicode,
    advanceWidth: (rows[0].length + 1) * 100,
    path,
  });
}
const glyphs = [glyph(".notdef", alphabet["?"])];
for (const [character, bitmap] of Object.entries(alphabet)) {
  glyphs.push(
    glyph(
      `uni${character.codePointAt(0).toString(16)}`,
      bitmap,
      character.codePointAt(0),
    ),
  );
  if (/^[A-Z]$/.test(character)) {
    glyphs.push(
      glyph(
        `uni${character.toLowerCase().codePointAt(0).toString(16)}`,
        bitmap,
        character.toLowerCase().codePointAt(0),
      ),
    );
  }
}
const font = new opentype.Font({
  familyName: "Vaccoin Pixel",
  styleName: "Regular",
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  glyphs,
});
writeFileSync(
  new URL("../public/assets/fonts/vaccoin-pixel.otf", import.meta.url),
  Buffer.from(font.toArrayBuffer()),
);
