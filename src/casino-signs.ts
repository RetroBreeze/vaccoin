import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const backing = new T.MeshLambertMaterial({ color: 0x171018 });
const brass = new T.MeshLambertMaterial({ color: 0xb88640 });
// Separate hardware lets the arena batch all frames/hangers by material.
export function createSignPanel(
  texture: T.Texture,
  width: number,
  height: number,
  options: { twoSided?: boolean; suspension: number; neon?: boolean },
) {
  const faces = new T.Group(),
    hardware = new T.Group();
  const material = new T.MeshBasicMaterial({
    map: texture,
    transparent: !!options.neon,
    toneMapped: !options.neon,
    side: T.FrontSide,
  });
  const geometry = new T.PlaneGeometry(width, height);
  const front = new T.Mesh(geometry, material);
  front.name = "sign-front";
  front.position.z = 0.09;
  faces.add(front);
  if (options.twoSided) {
    const back = new T.Mesh(geometry, material);
    back.name = "sign-back";
    back.position.z = -0.09;
    back.rotation.y = Math.PI;
    faces.add(back);
  }
  const board = new T.Mesh(
    new T.BoxGeometry(width + 0.12, height + 0.12, 0.14),
    backing,
  );
  board.name = "sign-board";
  hardware.add(board);
  const pieces: T.BufferGeometry[] = [];
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => pieces.push(new T.BoxGeometry(w, h, d).translate(x, y, z));
  for (const side of [-1, 1]) {
    box(side * (width / 2 + 0.035), 0, 0, 0.07, height + 0.2, 0.19);
    box(0, side * (height / 2 + 0.035), 0, width + 0.2, 0.07, 0.19);
    const suspension = Math.max(0.01, options.suspension);
    box(
      side * width * 0.32,
      height / 2 + 0.06 + suspension / 2,
      0,
      0.045,
      suspension,
      0.045,
    );
  }
  const mounts = new T.Mesh(mergeGeometries(pieces)!, brass);
  mounts.name = "sign-mounts";
  hardware.add(mounts);
  pieces.forEach((p) => p.dispose());
  return { faces, hardware };
}
