import { database, readLocal, embeddedImage } from "./project";
import { validateFonts, type EmbeddedFont } from "./font-data";
export interface LibraryAsset {
  id: string;
  name: string;
  kind: "image" | "font";
  thumbnail: string;
  bytes: number;
  data: string | EmbeddedFont;
}
type AssetMeta = Omit<LibraryAsset, "data">;
// Browsing reads metadata; one transaction serializes library changes across tabs.
export async function listAssets(): Promise<AssetMeta[]> {
  const value = await readLocal("asset-library");
  if (value !== undefined && !Array.isArray(value))
    throw Error("The asset library could not be read.");
  return (value ?? []) as AssetMeta[];
}
export async function saveAsset(input: Omit<LibraryAsset, "id" | "bytes">) {
  if (
    !input.name.trim() ||
    input.name.length > 80 ||
    (input.kind === "image" &&
      (typeof input.data !== "string" ||
        !embeddedImage.test(input.data) ||
        !embeddedImage.test(input.thumbnail)))
  )
    throw Error("Invalid library asset.");
  if (input.kind === "font") validateFonts([input.data]);
  const bytes = new Blob([JSON.stringify(input.data)]).size,
    id =
      input.kind === "font"
        ? (input.data as EmbeddedFont).family
        : crypto.randomUUID(),
    db = await database();
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction("studio", "readwrite"),
      store = tx.objectStore("studio");
    store.get("asset-library").onsuccess = (e) => {
      try {
        const storedItems = (e.target as IDBRequest).result ?? [];
        if (!Array.isArray(storedItems))
          throw Error("The asset library could not be read.");
        const items = storedItems.filter((a) => a.id !== id);
        if (
          items.length >= 40 ||
          bytes + items.reduce((n, a) => n + a.bytes, 0) > 64 * 1024 * 1024
        )
          throw Error(
            "The library holds up to 40 assets and 64 MB. Remove unused library items first.",
          );
        const { data: _data, ...meta } = { ...input, id, bytes };
        store.put(input.data, "asset:" + id);
        store.put([meta, ...items], "asset-library");
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => resolve(id);
    tx.onerror = tx.onabort = () =>
      reject(
        tx.error ??
          Error("Asset save failed. Your original file is unchanged."),
      );
  });
}
export async function removeAsset(id: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("studio", "readwrite"),
      store = tx.objectStore("studio");
    store.get("asset-library").onsuccess = (e) => {
      const items = (e.target as IDBRequest).result ?? [];
      if (!Array.isArray(items)) {
        tx.abort();
        return;
      }
      store.put(
        items.filter((a: AssetMeta) => a.id !== id),
        "asset-library",
      );
      store.delete("asset:" + id);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(tx.error ?? Error("Could not remove this library asset."));
  });
}
export async function readAsset(id: string) {
  const item = (await listAssets()).find((a) => a.id === id);
  if (!item) throw Error("Library asset not found.");
  const data = await readLocal("asset:" + id);
  if (item.kind === "font")
    return { ...item, data: validateFonts([data])[0] } as LibraryAsset;
  if (typeof data !== "string" || !embeddedImage.test(data))
    throw Error("That library photo is unavailable.");
  return { ...item, data } as LibraryAsset;
}
export async function imageThumbnail(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement("canvas"),
    scale = Math.min(1, 220 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = canvas.toDataURL("image/webp", 0.7);
  canvas.width = canvas.height = 0;
  return result;
}
