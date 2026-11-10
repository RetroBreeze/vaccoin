import { expect, it } from "vitest";
import { PerspectiveCamera, Scene } from "three";
import { Vacuum } from "../src/vacuum";
import { lineBlocked } from "../src/terrain";
it("keeps the collection point reachable when the visible nozzle crosses a ramp", () => {
  const scene = new Scene(),
    camera = new PerspectiveCamera();
  scene.add(camera);
  camera.position.set(17.95, 1.7, 20);
  camera.rotation.x = -0.12;
  camera.updateMatrixWorld();
  const v = new Vacuum(camera);
  v.update(1 / 60, 1, true, 0, 0);
  expect(
    lineBlocked(
      camera.position.x,
      camera.position.y,
      camera.position.z,
      v.target.x,
      v.target.y,
      v.target.z,
    ),
  ).toBe(false);
});
it('cosmetics only change materials, preserving geometry, transforms and collection target',()=>{
 const a=new Vacuum(new PerspectiveCamera()),b=new Vacuum(new PerspectiveCamera());
 b.equip('gold');a.update(1/60,1,true,10,12);b.update(1/60,1,true,10,12);
 expect(b.target.toArray()).toEqual(a.target.toArray());expect(b.group.position.toArray()).toEqual(a.group.position.toArray());expect(b.group.scale.toArray()).toEqual(a.group.scale.toArray());
 expect(b.group.children.map(c=>c.position.toArray())).toEqual(a.group.children.map(c=>c.position.toArray()));expect(b.cosmetic).toBe('gold');
});
