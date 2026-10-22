// An in-memory R2 contract adapter for tests, never the hosted storage implementation.
export class MemoryBucket {
  objects = new Map();
  async put(key, value, options = {}) {
    const text =
      typeof value === "string" ? value : await new Response(value).text();
    const etag = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const old = this.objects.get(key),
      condition = options.onlyIf;
    if (condition?.etagMatches && condition.etagMatches !== old?.etag)
      return null;
    if (condition?.etagDoesNotMatch === "*" && old) return null;
    const object = {
      key,
      etag,
      httpEtag: `"${etag}"`,
      customMetadata: options.customMetadata || {},
      uploaded: new Date(),
      text,
      size: new TextEncoder().encode(text).length,
    };
    this.objects.set(key, object);
    return { ...object };
  }
  async head(key) {
    const o = this.objects.get(key);
    return o ? { ...o } : null;
  }
  async delete(key) {
    this.objects.delete(key);
  }
  async get(key) {
    const o = this.objects.get(key);
    return o ? { ...o, json: async () => JSON.parse(o.text) } : null;
  }
  async list({ prefix, limit = 100 }) {
    const all = [...this.objects.values()].filter((o) =>
      o.key.startsWith(prefix),
    );
    return {
      objects: all.slice(0, limit).map((o) => ({ ...o })),
      truncated: all.length > limit,
    };
  }
}
