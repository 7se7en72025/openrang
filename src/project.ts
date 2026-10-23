import { mapImageSources } from "./history.ts";
import { embeddedFont, validateFonts, type EmbeddedFont } from "./font-data.ts";

export interface Project {
  schemaVersion: 1;
  title: string;
  width: number;
  height: number;
  background: string;
  scene: { objects: Record<string, unknown>[] };
}
export interface DesignPage extends Omit<Project, "schemaVersion" | "title"> {
  id: string;
  name: string;
  motion?: { duration: number; effect: "none" | "fade" | "slide" | "zoom" };
}
export interface DesignDocument {
  schemaVersion: 2;
  id: string;
  title: string;
  activePageId: string;
  pages: DesignPage[];
  fonts?: EmbeddedFont[];
}
export interface DesignSummary {
  id: string;
  title: string;
  updatedAt: number;
  pageCount: number;
  thumbnail: string;
  trashedAt?: number;
}
export interface Brand {
  name: string;
  colors: string[];
  font: string;
  logo?: string;
  fonts?: EmbeddedFont[];
}
export const embeddedImage =
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export function pageFromProject(p: Project): DesignPage {
  return {
    id: crypto.randomUUID(),
    name: "Page 1",
    width: p.width,
    height: p.height,
    background: p.background,
    scene: p.scene,
  };
}
export function packDocument(document: DesignDocument) {
  const assets: Record<string, string> = {};
  const ids = new Map<string, string>();
  const packed = mapImageSources(document, (src) => {
    if (!src.startsWith("data:image/") && !src.startsWith("data:font/"))
      return src;
    let id = ids.get(src);
    if (!id) {
      id = String(ids.size + 1);
      ids.set(src, id);
      assets[id] = src;
    }
    return "asset:" + id;
  });
  return { ...packed, assets };
}
export function validateDocument(input: unknown): DesignDocument {
  if (!input || typeof input !== "object")
    throw Error("That is not an OpenRang project.");
  const p = input as Record<string, unknown>;
  if (p.schemaVersion === 1) {
    const legacy = validateProject(input),
      page = pageFromProject(legacy);
    return {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      title: legacy.title,
      activePageId: page.id,
      pages: [page],
    };
  }
  if (
    p.schemaVersion !== 2 ||
    typeof p.title !== "string" ||
    p.title.length > 160 ||
    typeof p.id !== "string" ||
    !/^[\w-]{1,80}$/.test(p.id) ||
    !Array.isArray(p.pages) ||
    p.pages.length < 1 ||
    p.pages.length > 20
  )
    throw Error("Invalid project. Use an OpenRang file with 1–20 pages.");
  if (JSON.stringify(input).length > 25 * 1024 * 1024)
    throw Error("Project files must be smaller than 25 MB.");
  const assets = p.assets as Record<string, unknown> | undefined;
  if (
    assets &&
    (typeof assets !== "object" ||
      Array.isArray(assets) ||
      Object.keys(assets).length > 600 ||
      Object.entries(assets).some(
        ([id, src]) =>
          !/^\d{1,5}$/.test(id) ||
          typeof src !== "string" ||
          !(embeddedImage.test(src) || embeddedFont.test(src)),
      ))
  )
    throw Error("Invalid embedded project assets.");
  const hydrate = (src: string) => {
    if (!src.startsWith("asset:")) return src;
    const data = assets?.[src.slice(6)];
    if (typeof data !== "string") throw Error("A project asset is missing.");
    return data;
  };
  const customFonts = validateFonts(mapImageSources(p.fonts, hydrate));
  const pages = p.pages.map((raw: Record<string, unknown>) => {
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof raw.id !== "string" ||
      !/^[\w-]{1,80}$/.test(raw.id) ||
      typeof raw.name !== "string" ||
      raw.name.length > 80
    )
      throw Error("Invalid page.");
    const hydrated = mapImageSources(raw, (src) => {
      if (!src.startsWith("asset:")) return src;
      const data = assets?.[src.slice(6)];
      if (typeof data !== "string") throw Error("A project image is missing.");
      return data;
    });
    const page = validateProject(
      {
        ...hydrated,
        schemaVersion: 1,
        title: raw.name,
      },
      0,
      undefined,
      customFonts.map((f) => f.family),
    );
    const motion = raw.motion as DesignPage["motion"];
    if (
      motion &&
      (typeof motion !== "object" ||
        !Number.isFinite(motion.duration) ||
        motion.duration < 1 ||
        motion.duration > 15 ||
        !["none", "fade", "slide", "zoom"].includes(motion.effect))
    )
      throw Error("Invalid page animation. Duration must be 1–15 seconds.");
    return {
      id: raw.id,
      name: raw.name,
      width: page.width,
      height: page.height,
      background: page.background,
      scene: page.scene,
      ...(motion
        ? { motion: { duration: motion.duration, effect: motion.effect } }
        : {}),
    };
  });
  if (
    new Set(pages.map((p) => p.id)).size !== pages.length ||
    !pages.some((page) => page.id === p.activePageId)
  )
    throw Error("Invalid page selection.");
  return {
    schemaVersion: 2,
    id: p.id,
    title: p.title,
    activePageId: p.activePageId as string,
    pages,
    ...(customFonts.length ? { fonts: customFonts } : {}),
  };
}
export function validateBrand(input: unknown): Brand {
  const b = input as Brand;
  const customFonts = validateFonts(b?.fonts);
  if (
    !b ||
    typeof b !== "object" ||
    typeof b.name !== "string" ||
    b.name.length > 60 ||
    !Array.isArray(b.colors) ||
    b.colors.length < 1 ||
    b.colors.length > 8 ||
    !b.colors.every(color) ||
    ![...fonts, ...customFonts.map((f) => f.family)].includes(b.font) ||
    (b.logo &&
      (typeof b.logo !== "string" ||
        b.logo.length > 18000000 ||
        !embeddedImage.test(b.logo)))
  )
    throw Error("Invalid brand kit. Choose an OpenRang brand-kit JSON file.");
  return {
    name: b.name,
    colors: b.colors,
    font: b.font,
    ...(b.logo ? { logo: b.logo } : {}),
    ...(customFonts.length ? { fonts: customFonts } : {}),
  };
}

export const fonts = [
  "Space Grotesk Variable",
  "Inter Variable",
  "Georgia",
  "Arial",
  "Courier New",
];
export const swatches = [
  "#f85c3a",
  "#3155e7",
  "#f6ce55",
  "#173e33",
  "#d8b8e9",
  "#f7f1df",
  "#20211f",
  "#ffffff",
];
export function dimension(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 100 && n <= 6000;
}
export function color(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
}
const types = new Set([
  "Rect",
  "Circle",
  "Ellipse",
  "Triangle",
  "Polygon",
  "Textbox",
  "IText",
  "Text",
  "Image",
  "Group",
]);
const numbers = new Set([
  "left",
  "top",
  "width",
  "height",
  "scaleX",
  "scaleY",
  "angle",
  "skewX",
  "skewY",
  "opacity",
  "strokeWidth",
  "rx",
  "ry",
  "radius",
  "fontSize",
  "charSpacing",
  "lineHeight",
  "cropX",
  "cropY",
]);
const strings = new Set([
  "originX",
  "originY",
  "fill",
  "stroke",
  "text",
  "fontFamily",
  "fontWeight",
  "fontStyle",
  "textAlign",
  "paintFirst",
  "strokeLineCap",
  "strokeLineJoin",
  "src",
  "crossOrigin",
  "name",
]);
const booleans = new Set([
  "flipX",
  "flipY",
  "visible",
  "selectable",
  "evented",
  "underline",
  "linethrough",
  "overline",
  "lockMovementX",
  "lockMovementY",
  "lockScalingX",
  "lockScalingY",
  "lockRotation",
  "strokeUniform",
  "hasControls",
  "hasBorders",
]);

// Rebuild imported objects from known fields; never pass arbitrary Fabric class names or URLs to its loader.
export function validateProject(
  input: unknown,
  depth = 0,
  budget = { count: 0, groups: 0 },
  customFonts: string[] = [],
): Project {
  if (!input || typeof input !== "object")
    throw Error("That is not an OpenRang project.");
  const p = input as Project;
  if (JSON.stringify(input).length > 25 * 1024 * 1024)
    throw Error("Project files must be smaller than 25 MB.");
  if (
    p.schemaVersion !== 1 ||
    typeof p.title !== "string" ||
    p.title.length > 160 ||
    !dimension(p.width) ||
    !dimension(p.height) ||
    !color(p.background)
  )
    throw Error("Invalid project title, size or background.");
  if (
    !p.scene ||
    !Array.isArray(p.scene.objects) ||
    p.scene.objects.length > 300
  )
    throw Error("Projects can contain up to 300 layers.");
  const objects = p.scene.objects.map((raw) => {
    if (
      (raw?.type === "Group" ? ++budget.groups > 100 : ++budget.count > 300) ||
      depth > 4
    )
      throw Error(
        "Projects can contain up to 300 elements and 100 groups per page, with at most 4 nested groups.",
      );
    if (!raw || typeof raw !== "object" || !types.has(String(raw.type)))
      throw Error("This project contains an unsupported layer.");
    const obj: Record<string, unknown> = { type: raw.type };
    for (const [key, value] of Object.entries(raw)) {
      if (numbers.has(key)) {
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          Math.abs(value) > 100000
        )
          throw Error("A layer has invalid dimensions.");
        if (key === "fontSize" && (value < 4 || value > 1200))
          throw Error("Font sizes must be between 4 and 1,200.");
        if (key === "opacity" && (value < 0 || value > 1))
          throw Error("Invalid layer opacity.");
        obj[key] = value;
      } else if (
        key === "fontWeight" &&
        typeof value === "number" &&
        value >= 100 &&
        value <= 1000
      ) {
        obj[key] = value;
      } else if (
        ["fill", "stroke", "crossOrigin"].includes(key) &&
        value === null
      ) {
        obj[key] = null;
      } else if (strings.has(key)) {
        if (
          typeof value !== "string" ||
          value.length > (key === "src" ? 18000000 : 50000)
        )
          throw Error("A layer has invalid content.");
        if (
          (key === "fill" || key === "stroke") &&
          value !== "" &&
          !color(value) &&
          !/^rgba?\([\d.,%\s]+\)$/.test(value) &&
          !["black", "white", "transparent"].includes(value)
        )
          throw Error("Unsupported layer color.");
        obj[key] = value;
      } else if (booleans.has(key)) {
        if (typeof value !== "boolean") throw Error("Invalid layer setting.");
        obj[key] = value;
      }
    }
    if (raw.type === "Group") {
      if (!Array.isArray(raw.objects) || !raw.objects.length)
        throw Error("Invalid group.");
      obj.objects = validateProject(
        { ...p, scene: { objects: raw.objects } },
        depth + 1,
        budget,
        customFonts,
      ).scene.objects;
    }
    if (raw.type === "Image" && raw.filters !== undefined) {
      if (!Array.isArray(raw.filters) || raw.filters.length > 4)
        throw Error("Unsupported image filters.");
      obj.filters = raw.filters.map((f: Record<string, unknown>) => {
        if (!f || typeof f !== "object")
          throw Error("Invalid image adjustment.");
        const field = (
          {
            Brightness: "brightness",
            Contrast: "contrast",
            Saturation: "saturation",
          } as Record<string, string>
        )[String(f.type)];
        if (
          field &&
          typeof f[field] === "number" &&
          Number.isFinite(f[field]) &&
          Math.abs(f[field]) <= 1
        )
          return { type: f.type, [field]: f[field] };
        if (f.type === "Grayscale")
          return { type: "Grayscale", mode: "average" };
        throw Error("Unsupported image adjustment.");
      });
    }
    if (
      raw.type === "Image" &&
      (typeof raw.src !== "string" ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.src))
    )
      throw Error("Only embedded PNG, JPEG or WebP images are supported.");
    if (raw.type === "Polygon") {
      if (
        !Array.isArray(raw.points) ||
        raw.points.length > 200 ||
        !raw.points.every(
          (v) =>
            v &&
            typeof v === "object" &&
            ["x", "y"].every(
              (k) =>
                typeof v[k] === "number" &&
                Number.isFinite(v[k]) &&
                Math.abs(v[k]) < 100000,
            ),
        )
      )
        throw Error("Invalid polygon.");
      obj.points = raw.points.map((v) => ({ x: v.x, y: v.y }));
    }
    if (raw.shadow !== undefined && raw.shadow !== null) {
      const s = raw.shadow as Record<string, unknown>;
      if (
        !s ||
        typeof s !== "object" ||
        !color(s.color) ||
        !["blur", "offsetX", "offsetY"].every(
          (k) =>
            typeof s[k] === "number" &&
            Number.isFinite(s[k]) &&
            Math.abs(s[k]) <= 200,
        ) ||
        (s.blur as number) < 0
      )
        throw Error("Invalid layer shadow.");
      obj.shadow = {
        color: s.color,
        blur: s.blur,
        offsetX: s.offsetX,
        offsetY: s.offsetY,
        affectStroke: false,
        nonScaling: false,
      };
    }
    if (
      raw.fontFamily &&
      ![...fonts, ...customFonts].includes(String(raw.fontFamily))
    )
      obj.fontFamily = fonts[0];
    return obj;
  });
  return {
    schemaVersion: 1,
    title: p.title,
    width: p.width,
    height: p.height,
    background: p.background,
    scene: { objects },
  };
}

let dbPromise: Promise<IDBDatabase> | undefined;
export function database() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("openrang", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("studio");
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        dbPromise = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      dbPromise = undefined;
      reject(request.error);
    };
  }));
}
export async function readLocal(key: string): Promise<unknown> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("studio").objectStore("studio").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function writeLocal(key: string, value: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("studio", "readwrite");
    tx.objectStore("studio").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function readCurrentDocument(): Promise<unknown> {
  const current = (await readLocal("project")) as
    { activeDesignId?: string } | undefined;
  if (current?.activeDesignId) {
    const doc = await readLocal("design:" + current.activeDesignId);
    if (!doc) throw Error("The last design could not be found.");
    return doc;
  }
  return current;
}
export async function saveDocument(doc: DesignDocument, thumbnail: string) {
  const packed = packDocument(doc);
  if (new Blob([JSON.stringify(packed)]).size > 24 * 1024 * 1024)
    throw Error(
      "This project exceeds the 24 MB save limit. Download a backup and reduce image sizes.",
    );
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("studio", "readwrite"),
      store = tx.objectStore("studio");
    store.put(packed, "design:" + doc.id);
    store.put(
      {
        id: doc.id,
        title: doc.title,
        updatedAt: Date.now(),
        pageCount: doc.pages.length,
        thumbnail,
      } satisfies DesignSummary,
      "design-meta:" + doc.id,
    );
    store.put({ activeDesignId: doc.id }, "project");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function listDesigns(): Promise<DesignSummary[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db
      .transaction("studio")
      .objectStore("studio")
      .getAll(IDBKeyRange.bound("design-meta:", "design-meta:\uffff"));
    r.onsuccess = () =>
      resolve(r.result.sort((a, b) => b.updatedAt - a.updatedAt));
    r.onerror = () => reject(r.error);
  });
}
export async function trashDesign(id: string, trash: boolean) {
  const key = "design-meta:" + id,
    meta = (await readLocal(key)) as DesignSummary | undefined;
  if (!meta) throw Error("Design not found.");
  await writeLocal(key, { ...meta, trashedAt: trash ? Date.now() : undefined });
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function fileData(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(Error("Could not read this image."));
    r.readAsDataURL(file);
  });
}
export async function imageData(file: File) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 12 * 1024 * 1024
  )
    throw Error("Choose a PNG, JPEG or WebP smaller than 12 MB.");
  const data = await fileData(file);
  const image = new Image();
  image.src = data;
  await image.decode();
  if (image.naturalWidth * image.naturalHeight > 25000000)
    throw Error("Choose an image smaller than 25 megapixels.");
  return data;
}
