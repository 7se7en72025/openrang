import { packDocument, validateDocument } from "../src/project.ts";

const LIMIT = 8 * 1024 * 1024;
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const members = (object) => JSON.parse(object.customMetadata.members || "[]");
const permitted = (object, user) =>
  object &&
  object.customMetadata.trashed !== "1" &&
  (object.customMetadata.owner === user || members(object).includes(user));
const keyFor = (id) => "designs/" + id.replace(".", "/");
const idFor = (key) => key.slice(8).replace("/", ".");
export async function digest(value) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function body(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "Send JSON project data.");
  if (Number(request.headers.get("content-length")) > LIMIT)
    fail(413, "Cloud files must be smaller than 8 MB.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "Missing request data.");
  const parts = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) {
        await reader.cancel();
        fail(413, "Cloud files must be smaller than 8 MB.");
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    try {
      const value = JSON.parse(new TextDecoder().decode(bytes));
      if (!value || typeof value !== "object" || Array.isArray(value))
        fail(400, "Send a JSON object.");
      return value;
    } catch {
      fail(400, "Invalid JSON data.");
    }
  } finally {
    reader.releaseLock();
  }
}
function project(input) {
  try {
    return packDocument(validateDocument(input));
  } catch (e) {
    fail(400, e.message);
  }
}
async function save(bucket, key, document, metadata, revision) {
  const data = JSON.stringify({ document, nonce: crypto.randomUUID() });
  if (new TextEncoder().encode(data).length > LIMIT)
    fail(413, "Cloud files must be smaller than 8 MB.");
  // A nonce changes the content ETag even when only permissions change.
  const stored = await bucket.put(key, data, {
    onlyIf: revision ? { etagMatches: revision } : { etagDoesNotMatch: "*" },
    httpMetadata: {
      contentType: "application/json",
      cacheControl: "private, no-store",
    },
    customMetadata: { ...metadata, updatedAt: String(Date.now()) },
  });
  if (!stored)
    fail(
      409,
      "This cloud design changed. Your local edits are safe; choose which version to keep.",
    );
  return stored;
}
const details = (id, object, user) => ({
  id,
  revision: object.etag,
  title: object.customMetadata.title,
  updatedAt: Number(object.customMetadata.updatedAt),
  owner: object.customMetadata.owner === user,
  memberCount: members(object).length,
  trashed: object.customMetadata.trashed === "1",
});

export async function cloudApi(request, env) {
  try {
    const url = new URL(request.url),
      path = url.pathname;
    if (!path.startsWith("/api/cloud/")) return null;
    if (!env.BUCKET)
      fail(503, "Cloud storage is not configured. Local editing still works.");
    const identity = request.headers.get("oai-authenticated-user-id");
    if (!identity) fail(401, "Sign in to use cloud designs.");
    const user = await digest(identity);
    if (!["GET", "HEAD"].includes(request.method)) {
      if (
        request.headers.get("origin") !== url.origin ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        fail(403, "Open cloud designs from this site.");
    }
    if (path === "/api/cloud/session" && request.method === "GET")
      return json({ signedIn: true });
    if (path === "/api/cloud/designs" && request.method === "GET") {
      const own = await env.BUCKET.list({
        prefix: `designs/${user}/`,
        limit: 100,
        include: ["customMetadata"],
      });
      const shared = await env.BUCKET.list({
        prefix: `members/${user}/`,
        limit: 100,
      });
      const linked = await Promise.all(
        shared.objects.map((o) =>
          env.BUCKET.head(keyFor(o.key.split("/").at(-1))),
        ),
      );
      const files = [
        ...own.objects,
        ...linked.filter((o) => permitted(o, user)),
      ];
      return json({
        designs: files
          .map((o) => details(idFor(o.key), o, user))
          .sort((a, b) => b.updatedAt - a.updatedAt),
        truncated: own.truncated || shared.truncated,
      });
    }
    if (path === "/api/cloud/designs" && request.method === "POST") {
      const input = await body(request),
        document = project(input.document);
      const own = await env.BUCKET.list({
        prefix: `designs/${user}/`,
        limit: 100,
      });
      if (own.objects.length >= 100)
        fail(
          409,
          "Keep up to 100 cloud designs. Download a backup before deleting older designs.",
        );
      const id = `${user}.${crypto.randomUUID()}`;
      const stored = await save(
        env.BUCKET,
        keyFor(id),
        document,
        { owner: user, members: "[]", title: document.title },
        null,
      );
      return json(details(id, stored, user), 201);
    }
    const match = path.match(
      /^\/api\/cloud\/designs\/([a-f0-9]{64}\.[a-f0-9-]{36})(?:\/(share|join|trash|restore))?$/,
    );
    if (!match) fail(404, "Cloud route not found.");
    const [, id, action] = match,
      key = keyFor(id);
    const head = await env.BUCKET.head(key);
    if (!head) fail(404, "This cloud design is unavailable.");
    if (["trash", "restore"].includes(action) && request.method === "POST") {
      if (head.customMetadata.owner !== user)
        fail(403, "Only the owner can manage cloud Trash.");
      const input = await body(request);
      if (input.revision !== head.etag)
        fail(
          409,
          "This cloud file changed. Refresh the library and try again.",
        );
      const current = await env.BUCKET.get(key);
      if (!current || current.etag !== head.etag)
        fail(409, "Cloud changes arrived. Try again.");
      const { document } = await current.json();
      const stored = await save(
        env.BUCKET,
        key,
        document,
        {
          ...head.customMetadata,
          trashed: action === "trash" ? "1" : "",
          members: "[]",
          inviteHash: "",
          inviteExpires: "0",
        },
        head.etag,
      );
      await Promise.all(
        members(head).map((member) =>
          env.BUCKET.delete(`members/${member}/${id}`),
        ),
      );
      return json(details(id, stored, user));
    }
    if (action === "join" && request.method === "POST") {
      const input = await body(request),
        token = input.token;
      if (
        head.customMetadata.trashed === "1" ||
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/.test(token) ||
        (await digest(token)) !== head.customMetadata.inviteHash ||
        Number(head.customMetadata.inviteExpires) < Date.now()
      )
        fail(
          403,
          "This invite is invalid or expired. Ask the owner for a new link.",
        );
      if (!permitted(head, user)) {
        const team = members(head);
        if (team.length >= 20)
          fail(409, "This design already has 20 collaborators.");
        const current = await env.BUCKET.get(key);
        if (!current || current.etag !== head.etag)
          fail(409, "The design changed. Open the invite again.");
        const { document } = await current.json();
        await save(
          env.BUCKET,
          key,
          document,
          { ...head.customMetadata, members: JSON.stringify([...team, user]) },
          head.etag,
        );
      }
      if (head.customMetadata.owner !== user)
        await env.BUCKET.put(`members/${user}/${id}`, "", {
          customMetadata: { id },
        });
      return json({ joined: true });
    }
    if (!permitted(head, user))
      fail(404, "This cloud design is unavailable to this account.");
    if (!action && request.method === "GET") {
      if (request.headers.get("if-none-match") === head.etag)
        return new Response(null, {
          status: 304,
          headers: { "Cache-Control": "private, no-store" },
        });
      const current = await env.BUCKET.get(key);
      if (!current || !permitted(current, user))
        fail(404, "This cloud design is unavailable.");
      const { document } = await current.json();
      return json({ ...details(id, current, user), document });
    }
    if (!action && request.method === "PUT") {
      const input = await body(request);
      if (typeof input.revision !== "string" || input.revision !== head.etag)
        fail(409, "Cloud changes arrived. Your local copy has been preserved.");
      const document = project(input.document);
      const stored = await save(
        env.BUCKET,
        key,
        document,
        { ...head.customMetadata, title: document.title },
        input.revision,
      );
      return json(details(id, stored, user));
    }
    if (head.customMetadata.owner !== user)
      fail(403, "Only the owner can manage this design's sharing.");
    if (action === "share" && ["POST", "DELETE"].includes(request.method)) {
      const input = await body(request);
      if (input.revision !== head.etag)
        fail(409, "Cloud changes arrived. Sync before changing sharing.");
      const current = await env.BUCKET.get(key);
      if (!current || current.etag !== head.etag)
        fail(409, "Cloud changes arrived. Try again.");
      const { document } = await current.json();
      const token =
        request.method === "POST"
          ? crypto.randomUUID().replaceAll("-", "") +
            crypto.randomUUID().replaceAll("-", "")
          : "";
      const metadata = {
        ...head.customMetadata,
        inviteHash: token ? await digest(token) : "",
        inviteExpires: String(token ? Date.now() + 7 * 86400000 : 0),
      };
      if (!token) metadata.members = "[]";
      const stored = await save(env.BUCKET, key, document, metadata, head.etag);
      if (!token)
        await Promise.all(
          members(head).map((member) =>
            env.BUCKET.delete(`members/${member}/${id}`),
          ),
        );
      return json({ ...details(id, stored, user), token });
    }
    fail(405, "That cloud operation is not supported.");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("Cloud storage operation failed", e.name);
    return json(
      {
        error:
          "Cloud storage is temporarily unavailable. Your local design is safe.",
      },
      503,
    );
  }
}
