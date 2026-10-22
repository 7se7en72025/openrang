import { createServer } from "node:http";
import worker from "../dist/server/index.js";
import { MemoryBucket } from "./cloud-fixture.mjs";
const env = { BUCKET: new MemoryBucket() },
  port = Number(process.env.PORT || 5174);
// Explicit test harness, loopback only. Hosted code never accepts this cookie or client identity headers.
createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://127.0.0.1:${port}`;
    if (incoming.headers.host !== `127.0.0.1:${port}`) {
      outgoing.writeHead(403).end();
      return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (!name.startsWith("oai-authenticated-user-") && value)
        headers.set(name, Array.isArray(value) ? value.join(",") : value);
    const user = incoming.headers.cookie?.match(
      /(?:^|;\s*)openrang-test-user=(alice|bob|stranger)(?:;|$)/,
    )?.[1];
    if (user) headers.set("oai-authenticated-user-id", user);
    const request = new Request(new URL(incoming.url, origin), {
      method: incoming.method,
      headers,
      ...(!["GET", "HEAD"].includes(incoming.method)
        ? { body: incoming, duplex: "half" }
        : {}),
    });
    const response = await worker.fetch(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(e);
    outgoing.writeHead(500).end("Preview failed");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(
    `Cloud QA server: http://127.0.0.1:${port} (ephemeral test storage)`,
  ),
);
