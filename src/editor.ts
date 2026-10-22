import {
  Canvas,
  StaticCanvas,
  FabricImage,
  FabricObject,
  Textbox,
  Rect,
  Circle,
  Triangle,
} from "fabric";
import {
  type Project,
  validateProject,
  writeLocal,
  download,
  fileData,
} from "./project";

FabricObject.ownDefaults.cornerColor = "#ffffff";
FabricObject.ownDefaults.cornerStrokeColor = "#f85c3a";
FabricObject.ownDefaults.borderColor = "#f85c3a";
FabricObject.ownDefaults.cornerSize = 10;
FabricObject.ownDefaults.transparentCorners = false;
FabricObject.ownDefaults.originX = "left";
FabricObject.ownDefaults.originY = "top";

export interface EditorState {
  title: string;
  width: number;
  height: number;
  background: string;
  layers: FabricObject[];
  active: FabricObject | null;
  canUndo: boolean;
  canRedo: boolean;
  save: string;
  zoom: number;
  busy: boolean;
}
export class Editor {
  canvas: Canvas;
  title = "Good things";
  width = 1080;
  height = 1080;
  background = "#f7f1df";
  history: string[] = [];
  index = -1;
  busy = false;
  save = "Opening studio…";
  zoom = 1;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private saveVersion = 0;
  constructor(
    element: HTMLCanvasElement,
    private host: HTMLElement,
    private update: (s: EditorState) => void,
    private message: (s: string) => void,
  ) {
    this.canvas = new Canvas(element, {
      preserveObjectStacking: true,
      selectionColor: "#f85c3a22",
      selectionBorderColor: "#f85c3a",
    });
    ["selection:created", "selection:updated", "selection:cleared"].forEach(
      (name) => this.canvas.on(name as "selection:created", () => this.emit()),
    );
    this.canvas.on("object:modified", () => this.commit());
    this.canvas.on("text:editing:exited", () => this.commit());
  }
  emit() {
    if (!this.disposed)
      this.update({
        title: this.title,
        width: this.width,
        height: this.height,
        background: this.background,
        layers: [...this.canvas.getObjects()].reverse(),
        active: this.canvas.getActiveObject() ?? null,
        canUndo: this.index > 0,
        canRedo: this.index < this.history.length - 1,
        save: this.save,
        zoom: this.zoom,
        busy: this.busy,
      });
  }
  fit() {
    if (this.disposed) return;
    this.zoom = Math.max(
      0.02,
      Math.min(
        (this.host.clientWidth - 88) / this.width,
        (this.host.clientHeight - 88) / this.height,
        1,
      ),
    );
    this.canvas.setDimensions({
      width: Math.round(this.width * this.zoom),
      height: Math.round(this.height * this.zoom),
    });
    this.canvas.setViewportTransform([this.zoom, 0, 0, this.zoom, 0, 0]);
    this.emit();
  }
  project(): Project {
    return {
      schemaVersion: 1,
      title: this.title,
      width: this.width,
      height: this.height,
      background: this.background,
      scene: { objects: this.canvas.getObjects().map((o) => o.toObject()) },
    };
  }
  async load(input: unknown, remember = true) {
    if (this.busy) throw Error("Please wait for the current operation.");
    const p = validateProject(input);
    this.busy = true;
    this.canvas.discardActiveObject();
    this.canvas.selection = false;
    this.emit();
    const staging = new StaticCanvas(undefined, {
      width: p.width,
      height: p.height,
    });
    try {
      await staging.loadFromJSON(p.scene);
      if (this.disposed) return;
      const objects = staging.getObjects();
      staging.remove(...objects);
      this.canvas.clear();
      this.canvas.add(...objects);
      this.title = p.title;
      this.width = p.width;
      this.height = p.height;
      this.background = p.background;
      this.canvas.backgroundColor = p.background;
      this.fit();
      if (remember) this.commit();
    } finally {
      await staging.dispose();
      this.busy = false;
      this.canvas.selection = true;
      this.emit();
    }
  }
  commit() {
    if (this.disposed) return;
    const snapshot = JSON.stringify(this.project());
    if (snapshot !== this.history[this.index]) {
      this.history = this.history.slice(0, this.index + 1);
      this.history.push(snapshot);
      // shortcut: keep 30 snapshots within 24 MB (at least two), use structural diffs for larger projects.
      while (
        this.history.length > 2 &&
        (this.history.length > 30 ||
          this.history.reduce((sum, s) => sum + s.length, 0) > 24 * 1024 * 1024)
      )
        this.history.shift();
      this.index = this.history.length - 1;
    }
    this.autosave();
    this.canvas.requestRenderAll();
    this.emit();
  }
  private autosave() {
    this.save = "Saving…";
    const version = ++this.saveVersion;
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      try {
        await writeLocal("project", this.project());
        if (version === this.saveVersion) this.save = "Saved on this device";
      } catch {
        if (version === this.saveVersion) {
          this.save = "Save failed · download a backup";
          this.message(
            "Device storage is unavailable or full. Download your project to keep a backup.",
          );
        }
      }
      this.emit();
    }, 450);
  }
  async undo(direction = -1) {
    const next = this.index + direction;
    if (this.busy || next < 0 || next >= this.history.length) return;
    await this.load(JSON.parse(this.history[next]), false);
    this.index = next;
    this.autosave();
    this.emit();
  }
  change(values: Record<string, unknown>) {
    if (this.busy) return;
    const o = this.canvas.getActiveObject();
    if (!o) return;
    o.set(values);
    o.setCoords();
    this.commit();
  }
  add(kind: "text" | "rect" | "circle" | "triangle", fill = "#3155e7") {
    if (this.busy) return;
    if (this.canvas.getObjects().length >= 300)
      throw Error("This design has reached the 300-layer limit.");
    const base = { left: this.width * 0.23, top: this.height * 0.3, fill };
    const o =
      kind === "text"
        ? new Textbox("Your words here", {
            ...base,
            width: this.width * 0.65,
            fontFamily: "Space Grotesk Variable",
            fontWeight: 600,
            fontSize: this.width * 0.07,
          })
        : kind === "rect"
          ? new Rect({
              ...base,
              width: this.width * 0.35,
              height: this.height * 0.25,
              rx: 18,
              ry: 18,
            })
          : kind === "circle"
            ? new Circle({ ...base, radius: this.width * 0.15 })
            : new Triangle({
                ...base,
                width: this.width * 0.35,
                height: this.height * 0.3,
              });
    this.canvas.add(o);
    this.canvas.setActiveObject(o);
    this.commit();
  }
  async addImage(src: string) {
    if (this.busy) return;
    if (this.canvas.getObjects().length >= 300)
      throw Error("This design has reached the 300-layer limit.");
    if (JSON.stringify(this.project()).length + src.length > 24 * 1024 * 1024)
      throw Error(
        "This project is getting large. Use a smaller image or start a new project.",
      );
    const image = await FabricImage.fromURL(src);
    image.scale(
      Math.min(
        (this.width * 0.7) / image.width,
        (this.height * 0.7) / image.height,
      ),
    );
    image.set({ left: this.width * 0.15, top: this.height * 0.15 });
    this.canvas.add(image);
    this.canvas.setActiveObject(image);
    this.commit();
  }
  remove() {
    if (this.busy) return;
    const selected = this.canvas.getActiveObjects();
    this.canvas.discardActiveObject();
    this.canvas.remove(...selected);
    this.commit();
  }
  async duplicate() {
    const active = this.canvas.getActiveObject();
    if (!active || this.busy) return;
    if (active.type === "activeselection")
      throw Error("Duplicate one layer at a time.");
    if (this.canvas.getObjects().length >= 300)
      throw Error("This design has reached the 300-layer limit.");
    if (
      JSON.stringify(this.project()).length +
        JSON.stringify(active.toObject()).length >
      24 * 1024 * 1024
    )
      throw Error("This project is too large to duplicate that layer.");
    const clone = await active.clone();
    clone.set({ left: clone.left + 25, top: clone.top + 25 });
    this.canvas.add(clone);
    this.canvas.setActiveObject(clone);
    this.commit();
  }
  order(direction: number) {
    if (this.busy) return;
    const o = this.canvas.getActiveObject();
    if (o) {
      direction > 0
        ? this.canvas.bringObjectForward(o)
        : this.canvas.sendObjectBackwards(o);
      this.commit();
    }
  }
  select(o: FabricObject) {
    if (this.busy) return;
    this.canvas.setActiveObject(o);
    this.canvas.requestRenderAll();
    this.emit();
  }
  align(position: "left" | "center" | "right") {
    const o = this.canvas.getActiveObject();
    if (!o || this.busy) return;
    const box = o.getBoundingRect();
    const left =
      position === "left"
        ? 0
        : position === "center"
          ? (this.width - box.width) / 2
          : this.width - box.width;
    o.set({ left: o.left + left - box.left });
    o.setCoords();
    this.commit();
  }
  resize(width: number, height: number, scale: boolean) {
    if (this.busy) return;
    if (scale) {
      const factor = Math.min(width / this.width, height / this.height);
      const dx = (width - this.width * factor) / 2,
        dy = (height - this.height * factor) / 2;
      this.canvas.discardActiveObject();
      this.canvas.getObjects().forEach((o) => {
        o.set({
          left: o.left * factor + dx,
          top: o.top * factor + dy,
          scaleX: o.scaleX * factor,
          scaleY: o.scaleY * factor,
        });
        o.setCoords();
      });
    }
    this.width = width;
    this.height = height;
    this.fit();
    this.commit();
  }
  setBackground(value: string) {
    this.background = value;
    this.canvas.backgroundColor = value;
    this.commit();
  }
  rename(value: string) {
    this.title = value.slice(0, 160);
    this.commit();
  }
  async export(
    format: "png" | "svg" | "pdf" | "json",
    multiplier: number,
    transparent: boolean,
  ) {
    const name =
      (this.title.trim() || "Untitled design")
        .replace(/[^\w\- ]/g, "")
        .slice(0, 80) || "openrang";
    if (format === "json") {
      download(
        new Blob([JSON.stringify(this.project(), null, 2)], {
          type: "application/json",
        }),
        name + ".openrang.json",
      );
      return;
    }
    if (this.width * this.height * multiplier * multiplier > 40000000)
      throw Error("This export exceeds 40 megapixels. Choose a smaller scale.");
    const output = new StaticCanvas(undefined, {
      width: this.width,
      height: this.height,
      backgroundColor: transparent ? "" : this.background,
    });
    try {
      await output.loadFromJSON(this.project().scene);
      output.backgroundColor = transparent ? "" : this.background;
      output.renderAll();
      if (format === "svg") {
        download(
          new Blob([output.toSVG()], { type: "image/svg+xml" }),
          name + ".svg",
        );
        return;
      }
      const data = output.toDataURL({
        format: "png",
        multiplier,
        enableRetinaScaling: false,
      });
      if (format === "png") {
        download(await (await fetch(data)).blob(), name + ".png");
        return;
      }
      const { jsPDF } = await import("jspdf");
      // shortcut: PDF embeds a raster page, add vector/CMYK output when professional print is in scope.
      const pdf = new jsPDF({
        orientation: this.width >= this.height ? "landscape" : "portrait",
        unit: "px",
        format: [this.width, this.height],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(data, "PNG", 0, 0, this.width, this.height);
      download(pdf.output("blob"), name + ".pdf");
    } finally {
      await output.dispose();
    }
  }
  async removeBackground(progress: (s: string) => void) {
    const image = this.canvas.getActiveObject();
    if (!(image instanceof FabricImage) || this.busy)
      throw Error("Select an uploaded image first.");
    const source = image.getSrc();
    this.busy = true;
    this.emit();
    try {
      progress("Downloading AI model…");
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(source, {
        model: "isnet_quint8",
        device: "cpu",
        progress: (key, current, total) =>
          progress(
            key.startsWith("fetch")
              ? `Downloading model · ${Math.round((current / total) * 100)}%`
              : "Removing background on your device…",
          ),
      });
      const result = await FabricImage.fromURL(await fileData(blob));
      result.set({
        left: image.left,
        top: image.top,
        scaleX: image.scaleX,
        scaleY: image.scaleY,
        angle: image.angle,
        flipX: image.flipX,
        flipY: image.flipY,
      });
      const index = this.canvas.getObjects().indexOf(image);
      this.canvas.remove(image);
      this.canvas.insertAt(index, result);
      this.canvas.setActiveObject(result);
      this.commit();
    } finally {
      this.busy = false;
      this.emit();
    }
  }
  async dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    await this.canvas.dispose();
  }
}
