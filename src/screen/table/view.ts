// The 3D table, drawn with three.js in inches (ADR-012). The record's x runs along three's x,
// the record's y along three's z, and height is three's y.
import {
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Size } from "../../record/index.ts";
import { Camera } from "./camera.ts";

/** A felt texture with a faint line every inch and a stronger one every six. */
function feltTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 240;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#3d6b3a";
  g.fillRect(0, 0, 240, 240);
  g.strokeStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i <= 6; i++) {
    g.beginPath();
    g.moveTo(i * 40, 0);
    g.lineTo(i * 40, 240);
    g.moveTo(0, i * 40);
    g.lineTo(240, i * 40);
    g.stroke();
  }
  g.strokeStyle = "rgba(255,255,255,0.16)";
  g.strokeRect(0, 0, 240, 240);
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class TableView {
  readonly scene = new Scene();
  readonly renderer: WebGLRenderer;
  readonly labels = new CSS2DRenderer();
  readonly camera: Camera;
  /** The table top: what clicks and drags land on when they miss everything else. */
  readonly top: Mesh;
  readonly root = new Group();
  private frame = 0;
  private last = performance.now();
  private resize: ResizeObserver;
  private ticks = new Set<(seconds: number) => void>();

  readonly host: HTMLElement;
  readonly size: Size;

  constructor(host: HTMLElement, size: Size) {
    this.host = host;
    this.size = size;
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.className = "table-canvas";
    this.renderer.domElement.setAttribute("aria-label", "The table");
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    this.labels.domElement.className = "table-labels";
    host.append(this.labels.domElement);

    this.scene.background = new Color("#1c1f24");
    this.scene.add(new AmbientLight("#ffffff", 1.4));
    const sun = new DirectionalLight("#ffffff", 2.2);
    sun.position.set(size.width * 0.3, 80, size.depth * 0.2);
    this.scene.add(sun);

    const felt = feltTexture();
    felt.repeat.set(size.width / 6, size.depth / 6);
    this.top = new Mesh(new PlaneGeometry(size.width, size.depth), new MeshStandardMaterial({ map: felt, roughness: 1 }));
    this.top.rotation.x = -Math.PI / 2;
    this.top.position.set(size.width / 2, 0, size.depth / 2);
    this.scene.add(this.top);
    const edge = new Mesh(
      new PlaneGeometry(size.width + 2, size.depth + 2),
      new MeshStandardMaterial({ color: "#4a3626", roughness: 0.9 }),
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(size.width / 2, -0.02, size.depth / 2);
    this.scene.add(edge);
    this.scene.add(this.root);

    this.camera = new Camera(size, 0);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    const loop = () => {
      const now = performance.now();
      const seconds = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.camera.tick(seconds);
      this.ticks.forEach((t) => t(seconds));
      this.renderer.render(this.scene, this.camera.camera);
      this.labels.render(this.scene, this.camera.camera);
      this.frame = requestAnimationFrame(loop);
    };
    loop();
  }

  /** Runs every frame until the returned function is called. */
  onTick(tick: (seconds: number) => void): () => void {
    this.ticks.add(tick);
    return () => this.ticks.delete(tick);
  }

  private fit() {
    const { clientWidth: w, clientHeight: h } = this.host;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect(w, h);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
