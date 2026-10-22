export interface Project {
  schemaVersion: 1;
  title: string;
  width: number;
  height: number;
  background: string;
  scene: { objects: Record<string, unknown>[] };
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
]);

// Rebuild imported objects from known fields; never pass arbitrary Fabric class names or URLs to its loader.
export function validateProject(input: unknown): Project {
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
    if (raw.fontFamily && !fonts.includes(String(raw.fontFamily)))
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
function database() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("openrang", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("studio");
    request.onsuccess = () => resolve(request.result);
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
