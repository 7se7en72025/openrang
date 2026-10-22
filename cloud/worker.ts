import { cloudApi } from "./api.mjs";
declare const __SITE_ASSETS__: Record<string, { data: string; type: string }>;
const assets = __SITE_ASSETS__;
export default {
  async fetch(request: Request, env: { BUCKET?: unknown }) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/"))
      return (
        (await cloudApi(request, env)) ??
        new Response("Not found", { status: 404 })
      );
    const file = assets[url.pathname === "/" ? "/index.html" : url.pathname];
    if (!file || !["GET", "HEAD"].includes(request.method))
      return new Response("Not found", { status: 404 });
    const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
    return new Response(request.method === "HEAD" ? null : bytes, {
      headers: {
        "Content-Type": file.type,
        "Cache-Control": url.pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
      },
    });
  },
};
