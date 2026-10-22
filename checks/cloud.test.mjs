import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudApi } from "../cloud/api.mjs";
import { MemoryBucket } from "./cloud-fixture.mjs";
const document = {
  schemaVersion: 1,
  title: "Original",
  width: 1080,
  height: 1080,
  background: "#ffffff",
  scene: { objects: [] },
};
function client(env, user = "alice") {
  return async (path, method = "GET", body, headers = {}) => {
    const response = await cloudApi(
      new Request("https://studio.test/api/cloud/" + path, {
        method,
        headers: {
          ...(user ? { "oai-authenticated-user-id": user } : {}),
          origin: "https://studio.test",
          ...(body ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
    return {
      status: response.status,
      body: response.status === 304 ? null : await response.json(),
      headers: response.headers,
    };
  };
}
test("cloud rejects anonymous, cross-origin, malformed and oversized writes", async () => {
  const env = { BUCKET: new MemoryBucket() },
    alice = client(env);
  assert.equal((await client(env, "")("session")).status, 401);
  assert.equal(
    (
      await alice(
        "designs",
        "POST",
        { document },
        { origin: "https://other.test" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await alice(
        "designs",
        "POST",
        { document },
        { "content-length": "30000000" },
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await alice("designs", "POST", {
        document: {
          ...document,
          scene: {
            objects: [{ type: "Image", src: "https://other.test/a.png" }],
          },
        },
      })
    ).status,
    400,
  );
  assert.equal(env.BUCKET.objects.size, 0);
});
test("private files, invitations, team editing, conflicting writes and revocation", async () => {
  const env = { BUCKET: new MemoryBucket() },
    alice = client(env),
    bob = client(env, "bob"),
    stranger = client(env, "stranger");
  const created = await alice("designs", "POST", { document });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal((await stranger("designs/" + id)).status, 404);
  const invite = await alice(`designs/${id}/share`, "POST", {
    revision: created.body.revision,
  });
  assert.notEqual(
    invite.body.revision,
    created.body.revision,
    "permission-only updates also advance ETags",
  );
  assert.equal(
    (await bob(`designs/${id}/join`, "POST", { token: "0".repeat(64) })).status,
    403,
  );
  assert.equal(
    (await bob(`designs/${id}/join`, "POST", { token: invite.body.token }))
      .status,
    200,
  );
  const file = await bob("designs/" + id);
  assert.equal(file.body.owner, false);
  const edits = await Promise.all([
    alice(`designs/${id}`, "PUT", {
      revision: file.body.revision,
      document: { ...document, title: "Alice edit" },
    }),
    bob(`designs/${id}`, "PUT", {
      revision: file.body.revision,
      document: { ...document, title: "Bob edit" },
    }),
  ]);
  assert.deepEqual(edits.map((e) => e.status).sort(), [200, 409]);
  const current = await alice("designs/" + id);
  assert.equal(current.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (
      await alice("designs/" + id, "GET", undefined, {
        "if-none-match": current.body.revision,
      })
    ).status,
    304,
  );
  assert.equal(
    (
      await bob(`designs/${id}/share`, "POST", {
        revision: current.body.revision,
      })
    ).status,
    403,
  );
  const revoked = await alice(`designs/${id}/share`, "DELETE", {
    revision: current.body.revision,
  });
  assert.equal(revoked.status, 200);
  assert.equal((await bob("designs/" + id)).status, 404);
  assert.equal(
    (await bob(`designs/${id}/join`, "POST", { token: invite.body.token }))
      .status,
    403,
  );
  assert.equal((await bob("designs")).body.designs.length, 0);
  assert.equal((await stranger("designs")).body.designs.length, 0);
  const owned = await alice("designs/" + id);
  const trashed = await alice(`designs/${id}/trash`, "POST", {
    revision: owned.body.revision,
  });
  assert.equal(trashed.body.trashed, true);
  assert.equal((await alice("designs/" + id)).status, 404);
  assert.equal((await alice("designs")).body.designs[0].trashed, true);
  assert.equal(
    (
      await bob(`designs/${id}/restore`, "POST", {
        revision: trashed.body.revision,
      })
    ).status,
    403,
  );
  const restored = await alice(`designs/${id}/restore`, "POST", {
    revision: trashed.body.revision,
  });
  assert.equal(restored.body.trashed, false);
  assert.equal((await alice("designs/" + id)).status, 200);
});
