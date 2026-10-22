import {
  Canvas,
  StaticCanvas,
  FabricImage,
  FabricObject,
  Textbox,
  Rect,
  Circle,
  Triangle,
  Group,
  ActiveSelection,
  filters,
} from "fabric";
import {
  type Project,
  type DesignDocument,
  type DesignPage,
  validateDocument,
  pageFromProject,
  saveDocument,
  packDocument,
  download,
  fileData,
} from "./project";
import { History } from "./history";

FabricObject.ownDefaults.cornerColor = "#ffffff";
FabricObject.ownDefaults.cornerStrokeColor = "#f85c3a";
FabricObject.ownDefaults.borderColor = "#f85c3a";
FabricObject.ownDefaults.cornerSize = 10;
FabricObject.ownDefaults.transparentCorners = false;
FabricObject.ownDefaults.originX = "left";
FabricObject.ownDefaults.originY = "top";
FabricObject.customProperties = [
  "name",
  "lockMovementX",
  "lockMovementY",
  "lockScalingX",
  "lockScalingY",
  "lockRotation",
  "hasControls",
  "selectable",
  "evented",
];
function countElements(objects: FabricObject[]): number {
  return objects.reduce(
    (n, o) => n + (o instanceof Group ? countElements(o.getObjects()) : 1),
    0,
  );
}
function groupDepth(object: FabricObject): number {
  return object instanceof Group
    ? 1 + Math.max(0, ...object.getObjects().map(groupDepth))
    : 0;
}
function countGroups(objects: FabricObject[]): number {
  return objects.reduce(
    (n, o) => n + (o instanceof Group ? 1 + countGroups(o.getObjects()) : 0),
    0,
  );
}
function recolor(object: FabricObject, fill: unknown) {
  if (object instanceof Group)
    object.getObjects().forEach((o) => recolor(o, fill));
  else if (!(object instanceof FabricImage)) object.set("fill", fill);
  object.set("dirty", true);
}

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
  pages: {
    id: string;
    name: string;
    width: number;
    height: number;
    background: string;
  }[];
  activePageId: string;
  selectionCount: number;
  documentId: string;
  historyBytes: number;
}
export class Editor {
  canvas: Canvas;
  title = "Good things";
  width = 1080;
  height = 1080;
  background = "#f7f1df";
  history = new History();
  documentId: string = crypto.randomUUID();
  activePageId = "";
  pages: DesignPage[] = [];
  busy = false;
  save = "Opening studio…";
  zoom = 1;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private saveVersion = 0;
  private saveQueue: Promise<void> = Promise.resolve();
  private autoFit = true;
  private worker?: Worker;
  private cancelInference?: () => void;
  private clipboard: FabricObject[] = [];
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
        canUndo: this.history.index > 0,
        canRedo: this.history.index < this.history.count - 1,
        save: this.save,
        zoom: this.zoom,
        busy: this.busy,
        pages: this.pages.map(({ id, name, width, height, background }) => ({
          id,
          name,
          width,
          height,
          background,
        })),
        activePageId: this.activePageId,
        selectionCount: this.canvas.getActiveObjects().length,
        documentId: this.documentId,
        historyBytes: this.history.bytes,
      });
  }
  fit(reset = true) {
    if (this.disposed) return;
    if (!reset && !this.autoFit) {
      this.applyZoom();
      return;
    }
    this.autoFit = true;
    this.zoom = Math.max(
      0.02,
      Math.min(
        (this.host.clientWidth - 88) / this.width,
        (this.host.clientHeight - 88) / this.height,
        1,
      ),
    );
    this.applyZoom();
  }
  zoomBy(factor: number) {
    if (this.busy) return;
    this.autoFit = false;
    this.zoom = Math.max(0.05, Math.min(3, this.zoom * factor));
    this.applyZoom();
  }
  private applyZoom() {
    this.canvas.setDimensions({
      width: Math.round(this.width * this.zoom),
      height: Math.round(this.height * this.zoom),
    });
    this.canvas.setViewportTransform([this.zoom, 0, 0, this.zoom, 0, 0]);
    this.emit();
  }
  project(): Project {
    // ActiveSelection holds child coordinates relative to its selection; serialize in canvas space.
    const selection = this.canvas.getActiveObject();
    const selected = this.canvas.getActiveObjects();
    if (selection instanceof ActiveSelection) this.canvas.discardActiveObject();
    const objects = this.canvas.getObjects().map((o) => o.toObject());
    if (selection instanceof ActiveSelection)
      this.canvas.setActiveObject(
        new ActiveSelection(selected, { canvas: this.canvas }),
      );
    return {
      schemaVersion: 1,
      title: this.title,
      width: this.width,
      height: this.height,
      background: this.background,
      scene: { objects },
    };
  }
  document(): DesignDocument {
    const current = this.project();
    const pages = this.pages.map((p) =>
      p.id === this.activePageId
        ? {
            ...p,
            width: current.width,
            height: current.height,
            background: current.background,
            scene: current.scene,
          }
        : p,
    );
    return {
      schemaVersion: 2,
      id: this.documentId,
      title: this.title,
      activePageId: this.activePageId,
      pages,
    };
  }
  async load(input: unknown, remember = true) {
    if (this.busy) throw Error("Please wait for the current operation.");
    const doc = validateDocument(input),
      p = doc.pages.find((p) => p.id === doc.activePageId)!;
    this.busy = true;
    this.canvas.discardActiveObject();
    this.canvas.selection = false;
    this.emit();
    const staging = new StaticCanvas(undefined, {
      width: 1,
      height: 1,
      renderOnAddRemove: false,
    });
    try {
      await staging.loadFromJSON(p.scene);
      if (this.disposed) return;
      const objects = staging.getObjects();
      staging.remove(...objects);
      this.canvas.clear();
      this.canvas.add(...objects);
      this.title = doc.title;
      this.documentId = doc.id;
      this.pages = doc.pages;
      this.activePageId = doc.activePageId;
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
  async openDocument(input: unknown, imported = false) {
    if (this.busy) return;
    const doc = validateDocument(input);
    if (imported) doc.id = crypto.randomUUID();
    this.busy = true;
    this.emit();
    try {
      await this.flush();
    } finally {
      this.busy = false;
      this.emit();
    }
    await this.load(doc, false);
    this.history.clear();
    this.commit();
  }
  async applyTemplate(project: Project) {
    const p = pageFromProject(project),
      doc = this.document();
    await this.load({
      ...doc,
      title: project.title,
      pages: doc.pages.map((old) =>
        old.id === doc.activePageId
          ? { ...p, id: old.id, name: old.name }
          : old,
      ),
    });
  }
  async selectPage(id: string) {
    if (id === this.activePageId || this.busy) return;
    const doc = this.document();
    if (!doc.pages.some((p) => p.id === id)) return;
    await this.load({ ...doc, activePageId: id });
  }
  async addPage(duplicate = false) {
    if (this.pages.length >= 20)
      throw Error("A design can contain up to 20 pages.");
    const doc = this.document(),
      current = doc.pages.find((p) => p.id === doc.activePageId)!;
    const p = duplicate
      ? {
          ...structuredClone(current),
          id: crypto.randomUUID(),
          name: current.name + " copy",
        }
      : {
          ...pageFromProject({ ...this.project(), scene: { objects: [] } }),
          name: `Page ${doc.pages.length + 1}`,
        };
    const index = doc.pages.findIndex((p) => p.id === doc.activePageId);
    doc.pages.splice(index + 1, 0, p);
    await this.load({ ...doc, activePageId: p.id });
  }
  async deletePage() {
    if (this.pages.length <= 1)
      throw Error("Keep at least one page in your design.");
    const doc = this.document(),
      index = doc.pages.findIndex((p) => p.id === doc.activePageId);
    doc.pages.splice(index, 1);
    await this.load({
      ...doc,
      activePageId: doc.pages[Math.min(index, doc.pages.length - 1)].id,
    });
  }
  async movePage(direction: number) {
    const doc = this.document(),
      index = doc.pages.findIndex((p) => p.id === doc.activePageId),
      next = index + direction;
    if (next < 0 || next >= doc.pages.length) return;
    [doc.pages[index], doc.pages[next]] = [doc.pages[next], doc.pages[index]];
    await this.load(doc);
  }
  renamePage(name: string) {
    if (this.busy) return;
    this.pages = this.pages.map((p) =>
      p.id === this.activePageId ? { ...p, name: name.slice(0, 80) } : p,
    );
    this.commit("page-name");
  }
  commit(mergeKey = "") {
    if (this.disposed) return;
    this.history.push(this.document(), mergeKey);
    this.autosave();
    this.canvas.requestRenderAll();
    this.emit();
  }
  private autosave() {
    this.save = "Saving…";
    ++this.saveVersion;
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () =>
        void this.flush().catch(() =>
          this.message(
            "Device storage is unavailable or full. Download your project to keep a backup.",
          ),
        ),
      450,
    );
  }
  async flush() {
    if (!this.pages.length) return;
    clearTimeout(this.timer);
    const version = this.saveVersion,
      doc = this.document();
    const thumbnail = this.canvas.toDataURL({
      format: "jpeg",
      quality: 0.65,
      multiplier: Math.min(1, 220 / this.canvas.width),
      enableRetinaScaling: false,
    });
    const operation = this.saveQueue
      .catch(() => {})
      .then(() => saveDocument(doc, thumbnail));
    this.saveQueue = operation;
    try {
      await operation;
      if (version === this.saveVersion) this.save = "Saved on this device";
    } catch (e) {
      if (version === this.saveVersion)
        this.save = "Save failed · download a backup";
      throw e;
    } finally {
      this.emit();
    }
  }
  async undo(direction = -1) {
    const next = this.history.index + direction;
    if (this.busy || next < 0 || next >= this.history.count) return;
    await this.load(this.history.read(next), false);
    this.history.move(next);
    this.autosave();
    this.emit();
  }
  change(values: Record<string, unknown>) {
    if (this.busy) return;
    const o = this.canvas.getActiveObject();
    if (!o) return;
    if (typeof values.text === "string" && values.text.length > 50000)
      throw Error("Text layers are limited to 50,000 characters.");
    if (o instanceof Group && "fill" in values) recolor(o, values.fill);
    if (o instanceof ActiveSelection && "opacity" in values) {
      o.getObjects().forEach((child) => child.set("opacity", values.opacity));
      values = { ...values, opacity: 1 };
    }
    o.set(values);
    o.setCoords();
    this.commit(
      "property:" +
        this.canvas.getObjects().indexOf(o) +
        ":" +
        Object.keys(values).join(","),
    );
  }
  add(kind: "text" | "rect" | "circle" | "triangle", fill = "#3155e7") {
    if (this.busy) return;
    if (countElements(this.canvas.getObjects()) >= 300)
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
    if (countElements(this.canvas.getObjects()) >= 300)
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
    if (active instanceof ActiveSelection) {
      await this.copy();
      await this.paste();
      return;
    }
    if (countElements(this.canvas.getObjects()) + countElements([active]) > 300)
      throw Error("This design has reached the 300-layer limit.");
    if (countGroups(this.canvas.getObjects()) + countGroups([active]) > 100)
      throw Error("A page can contain up to 100 groups.");
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
  selectAll() {
    if (this.busy) return;
    const objects = this.canvas
      .getObjects()
      .filter((o) => o.visible && o.selectable);
    if (objects.length)
      this.canvas.setActiveObject(
        new ActiveSelection(objects, { canvas: this.canvas }),
      );
    this.canvas.requestRenderAll();
    this.emit();
  }
  nudge(x: number, y: number) {
    if (this.busy) return;
    const o = this.canvas.getActiveObject();
    if (!o || o.lockMovementX || o.lockMovementY) return;
    o.set({ left: o.left + x, top: o.top + y });
    o.setCoords();
    this.commit("nudge");
  }
  async copy() {
    if (this.busy) return;
    const objects = this.canvas.getActiveObjects();
    this.canvas.discardActiveObject();
    this.clipboard = await Promise.all(objects.map((o) => o.clone()));
    if (objects.length)
      this.canvas.setActiveObject(
        objects.length === 1
          ? objects[0]
          : new ActiveSelection(objects, { canvas: this.canvas }),
      );
    this.canvas.requestRenderAll();
    this.emit();
  }
  async paste() {
    if (this.busy || !this.clipboard.length) return;
    if (
      countElements(this.canvas.getObjects()) + countElements(this.clipboard) >
      300
    )
      throw Error("This design has reached the 300-layer limit.");
    if (
      countGroups(this.canvas.getObjects()) + countGroups(this.clipboard) >
      100
    )
      throw Error("A page can contain up to 100 groups.");
    const objects = await Promise.all(this.clipboard.map((o) => o.clone()));
    if (this.busy || this.disposed) return;
    this.canvas.discardActiveObject();
    objects.forEach((o) => {
      o.set({ left: o.left + 25, top: o.top + 25 });
      this.canvas.add(o);
    });
    this.canvas.setActiveObject(
      objects.length === 1
        ? objects[0]
        : new ActiveSelection(objects, { canvas: this.canvas }),
    );
    this.commit();
  }
  group() {
    if (this.busy) return;
    const objects = this.canvas.getActiveObjects();
    if (objects.some((o) => groupDepth(o) >= 4))
      throw Error("Groups can be nested up to four levels.");
    if (countGroups(this.canvas.getObjects()) >= 100)
      throw Error("A page can contain up to 100 groups.");
    if (objects.length < 2) throw Error("Select at least two layers to group.");
    this.canvas.discardActiveObject();
    this.canvas.remove(...objects);
    const group = new Group(objects);
    group.set("name", "Group");
    this.canvas.add(group);
    this.canvas.setActiveObject(group);
    this.commit();
  }
  ungroup() {
    const group = this.canvas.getActiveObject();
    if (
      this.busy ||
      !(group instanceof Group) ||
      group instanceof ActiveSelection
    )
      return;
    this.canvas.discardActiveObject();
    const objects = group.removeAll();
    this.canvas.remove(group);
    this.canvas.add(...objects);
    this.canvas.setActiveObject(
      new ActiveSelection(objects, { canvas: this.canvas }),
    );
    this.commit();
  }
  toggleLock(o: FabricObject) {
    if (this.busy) return;
    const locked = !o.lockMovementX;
    if (o instanceof ActiveSelection) {
      const selected = [...o.getObjects()];
      this.canvas.discardActiveObject();
      selected.forEach((child) =>
        child.set({
          lockMovementX: locked,
          lockMovementY: locked,
          lockScalingX: locked,
          lockScalingY: locked,
          lockRotation: locked,
          hasControls: !locked,
        }),
      );
      this.commit();
      return;
    }
    o.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      hasControls: !locked,
    });
    this.commit();
  }
  toggleVisibility(o: FabricObject) {
    if (this.busy) return;
    o.set({ visible: !o.visible });
    this.canvas.discardActiveObject();
    this.commit();
  }
  cropImage(ratio: number | null) {
    const image = this.canvas.getActiveObject();
    if (this.busy || !(image instanceof FabricImage)) return;
    const natural = image.getOriginalSize(),
      center = image.getCenterPoint(),
      displayWidth = image.getScaledWidth(),
      displayHeight = image.getScaledHeight();
    const width = ratio
        ? Math.min(natural.width, natural.height * ratio)
        : natural.width,
      height = ratio ? width / ratio : natural.height;
    const scale = Math.min(displayWidth / width, displayHeight / height);
    image.set({
      cropX: (natural.width - width) / 2,
      cropY: (natural.height - height) / 2,
      width,
      height,
      scaleX: scale,
      scaleY: scale,
    });
    image.setPositionByOrigin(center, "center", "center");
    image.setCoords();
    this.commit();
  }
  adjustCrop(axis: "cropX" | "cropY", value: number) {
    const image = this.canvas.getActiveObject();
    if (this.busy || !(image instanceof FabricImage)) return;
    const natural = image.getOriginalSize();
    const max =
      axis === "cropX"
        ? natural.width - image.width
        : natural.height - image.height;
    image.set(axis, Math.max(0, Math.min(max, value)));
    this.commit("crop:" + axis);
  }
  imageAdjustment(
    name: "Brightness" | "Contrast" | "Saturation" | "Grayscale",
    value: number,
  ) {
    const image = this.canvas.getActiveObject();
    if (this.busy || !(image instanceof FabricImage)) return;
    image.filters = image.filters.filter((f) => f.type !== name);
    if (value) {
      const v = Math.max(-1, Math.min(1, value));
      image.filters.push(
        name === "Brightness"
          ? new filters.Brightness({ brightness: v })
          : name === "Contrast"
            ? new filters.Contrast({ contrast: v })
            : name === "Saturation"
              ? new filters.Saturation({ saturation: v })
              : new filters.Grayscale(),
      );
    }
    image.applyFilters();
    image.setCoords();
    this.commit("filter:" + name);
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
    this.commit("background");
  }
  rename(value: string) {
    if (this.busy) return;
    this.title = value.slice(0, 160);
    this.commit("title");
  }
  async export(
    format: "png" | "jpeg" | "svg" | "pdf" | "json",
    multiplier: number,
    transparent: boolean,
    allPages = false,
  ) {
    const name =
      (this.title.trim() || "Untitled design")
        .replace(/[^\w\- ]/g, "")
        .slice(0, 80) || "openrang";
    if (format === "json") {
      download(
        new Blob([JSON.stringify(packDocument(this.document()))], {
          type: "application/json",
        }),
        name + ".openrang.json",
      );
      return;
    }
    if (![1, 2, 3].includes(multiplier))
      throw Error("Choose an export scale of 1×, 2× or 3×.");
    const doc = this.document(),
      pages =
        format === "pdf" && allPages
          ? doc.pages
          : doc.pages.filter((p) => p.id === doc.activePageId);
    if (
      pages.some((p) => p.width * p.height * multiplier * multiplier > 40000000)
    )
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
      if (format === "png" || format === "jpeg") {
        if (format === "jpeg") output.backgroundColor = this.background;
        const rendered = output.toCanvasElement(multiplier);
        const blob = await new Promise<Blob>((resolve, reject) =>
          rendered.toBlob(
            (blob) =>
              blob
                ? resolve(blob)
                : reject(
                    Error(
                      "The browser could not allocate this export. Choose a smaller scale.",
                    ),
                  ),
            format === "jpeg" ? "image/jpeg" : "image/png",
            0.95,
          ),
        );
        download(blob, name + (format === "jpeg" ? ".jpg" : ".png"));
        rendered.width = 0;
        rendered.height = 0;
        return;
      }
      const { jsPDF } = await import("jspdf");
      // shortcut: PDF embeds raster pages; vector/CMYK production printing needs a dedicated export engine.
      const pdf = new jsPDF({
        orientation:
          pages[0].width >= pages[0].height ? "landscape" : "portrait",
        unit: "px",
        format: [pages[0].width, pages[0].height],
        hotfixes: ["px_scaling"],
      });
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        output.setDimensions({ width: p.width, height: p.height });
        await output.loadFromJSON(p.scene);
        output.backgroundColor = p.background;
        if (i)
          pdf.addPage(
            [p.width, p.height],
            p.width >= p.height ? "landscape" : "portrait",
          );
        const data = output.toDataURL({
          format: "jpeg",
          quality: 0.94,
          multiplier,
          enableRetinaScaling: false,
        });
        pdf.addImage(data, "JPEG", 0, 0, p.width, p.height, undefined, "FAST");
      }
      download(pdf.output("blob"), name + ".pdf");
    } finally {
      await output.dispose();
    }
  }
  async removeBackground(progress: (s: string) => void) {
    const image = this.canvas.getActiveObject();
    if (!(image instanceof FabricImage) || this.busy)
      throw Error("Select an uploaded image first.");
    this.busy = true;
    this.emit();
    try {
      progress("Downloading AI model…");
      if (typeof Worker === "undefined")
        throw Error(
          "On-device AI needs a browser with Web Workers. Try a recent Chrome, Edge or Firefox.",
        );
      this.worker ??= new Worker(
        new URL("./background.worker.ts", import.meta.url),
        { type: "module" },
      );
      const worker = this.worker;
      const size = image.getOriginalSize();
      const inputCanvas = document.createElement("canvas");
      inputCanvas.width = size.width;
      inputCanvas.height = size.height;
      const inputContext = inputCanvas.getContext("2d", {
        willReadFrequently: true,
      })!;
      inputContext.drawImage(image.getElement(), 0, 0);
      const pixels = inputContext.getImageData(0, 0, size.width, size.height)
        .data.buffer as ArrayBuffer;
      inputCanvas.width = 0;
      inputCanvas.height = 0;
      const output = await new Promise<{
        pixels: ArrayBuffer;
        width: number;
        height: number;
      }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          finish();
          worker.terminate();
          this.worker = undefined;
          reject(
            Error(
              "Background removal timed out. Your original is unchanged; check your connection and retry.",
            ),
          );
        }, 180000);
        const finish = () => {
          clearTimeout(timeout);
          this.cancelInference = undefined;
          worker.onmessage = null;
          worker.onerror = null;
        };
        this.cancelInference = () => {
          finish();
          worker.terminate();
          this.worker = undefined;
          reject(
            Error(
              "Background removal cancelled. Your original image is unchanged.",
            ),
          );
        };
        worker.onmessage = (event) => {
          if (event.data.progress) progress(event.data.progress);
          else {
            finish();
            worker.terminate();
            this.worker = undefined;
            event.data.error
              ? reject(Error(event.data.error))
              : resolve(event.data);
          }
        };
        worker.onerror = () => {
          finish();
          worker.terminate();
          this.worker = undefined;
          reject(
            Error("AI worker failed. Your image is unchanged; please retry."),
          );
        };
        try {
          worker.postMessage(
            { pixels, width: size.width, height: size.height },
            [pixels],
          );
        } catch (e) {
          finish();
          reject(e);
        }
      });
      if (output.pixels.byteLength !== output.width * output.height * 4)
        throw Error(
          "AI returned an invalid image. Your original is unchanged.",
        );
      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = output.width;
      outputCanvas.height = output.height;
      outputCanvas
        .getContext("2d", { willReadFrequently: true })!
        .putImageData(
          new ImageData(
            new Uint8ClampedArray(output.pixels),
            output.width,
            output.height,
          ),
          0,
          0,
        );
      const blob = await new Promise<Blob>((resolve, reject) =>
        outputCanvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(
                  Error(
                    "Could not encode the cutout. Your image is unchanged.",
                  ),
                ),
          "image/png",
        ),
      );
      outputCanvas.width = 0;
      outputCanvas.height = 0;
      const result = await FabricImage.fromURL(await fileData(blob));
      if (this.disposed) return;
      result.set({
        left: image.left,
        top: image.top,
        scaleX: image.scaleX,
        scaleY: image.scaleY,
        angle: image.angle,
        flipX: image.flipX,
        flipY: image.flipY,
        width: image.width,
        height: image.height,
        cropX: image.cropX,
        cropY: image.cropY,
        opacity: image.opacity,
        name: image.get("name"),
        filters: image.filters,
        lockMovementX: image.lockMovementX,
        lockMovementY: image.lockMovementY,
        lockScalingX: image.lockScalingX,
        lockScalingY: image.lockScalingY,
        lockRotation: image.lockRotation,
        hasControls: image.hasControls,
      });
      result.applyFilters();
      const index = this.canvas.getObjects().indexOf(image);
      this.canvas.remove(image);
      this.canvas.insertAt(index, result);
      this.canvas.setActiveObject(result);
      this.commit();
    } finally {
      this.busy = false;
      this.emit();
      this.worker?.terminate();
      this.worker = undefined;
    }
  }
  cancelBackground() {
    this.cancelInference?.();
  }
  async dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.cancelInference?.();
    this.worker?.terminate();
    await this.canvas.dispose();
  }
}
