// Embedded photos are interned once instead of being copied into every undo snapshot.
export function mapImageSources<T>(
  value: T,
  map: (source: string) => string,
): T {
  if (Array.isArray(value))
    return value.map((item) => mapImageSources(item, map)) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === "src" && typeof item === "string"
        ? map(item)
        : mapImageSources(item, map),
    ]),
  ) as T;
}

export class History {
  entries: string[] = [];
  index = -1;
  private assets = new Map<string, string>();
  private assetIds = new Map<string, string>();
  private nextId = 0;
  private mergeKey = "";
  private changedAt = 0;
  get bytes() {
    return (
      2 *
      (this.entries.reduce((n, s) => n + s.length, 0) +
        [...this.assets.values()].reduce((n, s) => n + s.length, 0))
    );
  }
  get count() {
    return this.entries.length;
  }
  push(value: unknown, mergeKey = "") {
    const snapshot = JSON.stringify(
      mapImageSources(value, (src) => {
        if (!src.startsWith("data:image/") && !src.startsWith("data:font/"))
          return src;
        let id = this.assetIds.get(src);
        if (!id) {
          id = String(++this.nextId);
          this.assets.set(id, src);
          this.assetIds.set(src, id);
        }
        return "asset:" + id;
      }),
    );
    if (snapshot === this.entries[this.index]) return;
    const merge =
      mergeKey &&
      this.mergeKey === mergeKey &&
      performance.now() - this.changedAt < 650 &&
      this.index === this.entries.length - 1 &&
      this.index > 0;
    this.entries = this.entries.slice(0, this.index + 1);
    if (merge) this.entries[this.index] = snapshot;
    else this.entries.push(snapshot);
    while (
      this.entries.length > 2 &&
      (this.entries.length > 50 || this.bytes > 48 * 1024 * 1024)
    )
      this.entries.shift();
    this.index = this.entries.length - 1;
    this.mergeKey = mergeKey;
    this.changedAt = performance.now();
    this.collect();
  }
  read<T>(index: number): T {
    return mapImageSources(JSON.parse(this.entries[index]), (src) => {
      if (!src.startsWith("asset:")) return src;
      const asset = this.assets.get(src.slice(6));
      if (!asset) throw Error("History image is missing.");
      return asset;
    });
  }
  move(index: number) {
    this.index = index;
    this.mergeKey = "";
  }
  clear() {
    this.entries = [];
    this.index = -1;
    this.assets.clear();
    this.assetIds.clear();
    this.mergeKey = "";
  }
  private collect() {
    const used = new Set(
      this.entries.flatMap((s) =>
        [...s.matchAll(/"src":"asset:(\d+)"/g)].map((m) => m[1]),
      ),
    );
    for (const [id, src] of this.assets)
      if (!used.has(id)) {
        this.assets.delete(id);
        this.assetIds.delete(src);
      }
  }
}
