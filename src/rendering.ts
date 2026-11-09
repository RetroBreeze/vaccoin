import * as T from "three";
export class Rendering {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(78, 1, 0.08, 130);
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.info.autoReset = false;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.scene.background = new T.Color(0x9fc5cd);
    this.scene.fog = new T.Fog(0x9fc5cd, 30, 100);
    const ambient = new T.HemisphereLight(0xfff3d6, 0x637799, 2.1);
    ambient.layers.enable(1);
    this.scene.add(ambient);
    const sun = new T.DirectionalLight(0xffe3b3, 2.6);
    sun.position.set(-15, 35, 20);
    sun.layers.enable(1);
    this.scene.add(sun);
    this.scene.add(this.camera);
    this.camera.rotation.order = "YXZ";
    this.resize();
  }
  resize() {
    const aspect = innerWidth / innerHeight;
    const height = 270;
    this.renderer.setSize(Math.round(height * aspect), height, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
  draw() {
    this.renderer.info.reset();
    this.camera.layers.set(0);
    this.renderer.render(this.scene, this.camera);
    // A separate depth pass keeps the first-person nozzle from clipping into walls.
    const background = this.scene.background;
    this.scene.background = null;
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.camera.layers.set(1);
    this.renderer.render(this.scene, this.camera);
    this.camera.layers.set(0);
    this.renderer.autoClear = true;
    this.scene.background = background;
  }
}
