import * as T from "three";
import { COSMETICS, type Cosmetic } from "./workshop-state";
import {
  applyVacuumColour,
  createVacuumMaterials,
  loadVacuumModel,
} from "./vacuum-model";

/** Small offscreen render, copied into the game's pixel UI. No background RAF. */
export class VacuumPreview {
  private renderer?: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.OrthographicCamera(-1.85, 1.85, 0.77, -0.77, 0.1, 20);
  private pivot = new T.Group();
  private materials = createVacuumMaterials();
  private image?: HTMLCanvasElement;
  private imageContext?: CanvasRenderingContext2D;
  private loading?: Promise<void>;
  private lastFrame = -Infinity;
  private colour = COSMETICS[0].id;
  private reducedMotion = false;
  state: "loading" | "ready" | "error" = "loading";

  private initialize() {
    return (this.loading ??= (async () => {
      try {
        this.reducedMotion = matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        this.renderer = new T.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: "low-power",
        });
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(310, 130);
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.image = document.createElement("canvas");
        this.image.width = 310;
        this.image.height = 130;
        this.imageContext = this.image.getContext("2d")!;
        this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          this.state = "error";
        });
        this.renderer.domElement.addEventListener(
          "webglcontextrestored",
          () => {
            this.state = this.pivot.children.length ? "ready" : "loading";
            this.lastFrame = -Infinity;
          },
        );
        this.camera.zoom = 1.25;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(3, 2, -0.7);
        this.camera.lookAt(0, 0, 0);
        this.scene.add(
          new T.HemisphereLight(0xfff1dd, 0x554268, 2),
          this.pivot,
        );
        const key = new T.DirectionalLight(0xffffff, 1.4);
        key.position.set(-3, 5, -2);
        this.scene.add(key);
        const model = await loadVacuumModel(this.materials);
        const centre = new T.Box3()
          .setFromObject(model)
          .getCenter(new T.Vector3());
        model.position.sub(centre);
        this.pivot.add(model);
        this.state = "ready";
      } catch (error) {
        this.state = "error";
        this.renderer?.dispose();
        console.warn("Shop 3D preview unavailable.", error);
      }
    })());
  }
  draw(
    context: CanvasRenderingContext2D,
    colour: Cosmetic,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    void this.initialize();
    if (this.state !== "ready") return false;
    const now = performance.now();
    const changed = this.colour !== colour.id;
    if (changed) {
      applyVacuumColour(this.materials, colour);
      this.colour = colour.id;
    }
    if (
      changed ||
      this.lastFrame === -Infinity ||
      (!this.reducedMotion && now - this.lastFrame >= 1000 / 24)
    ) {
      this.pivot.rotation.y = this.reducedMotion
        ? 0
        : Math.sin(now * 0.00045) * 0.22;
      this.renderer!.render(this.scene, this.camera);
      // WebGL drawing buffers may be cleared after compositing; cache pixels now.
      this.imageContext!.clearRect(0, 0, 310, 130);
      this.imageContext!.drawImage(this.renderer!.domElement, 0, 0);
      this.lastFrame = now;
    }
    context.drawImage(this.image!, x, y, width, height);
    return true;
  }
}
