# Cloud files and team sync

Local tools remain usable without a backend. The cloud button contacts `/api/cloud/` only after it is opened or an invite URL is followed. Brand kits stay local. Opening a cloud file creates a separate local copy; a sync connection lasts for that open tab. Reopen the file from the cloud library after a reload.

## Hosted setup

The retained `.openai/hosting.json` identifies the existing Site and declares `r2: "BUCKET"`. The production build first builds the frontend, then bundles a Worker ESM entry at `dist/server/index.js`, embedding only the built public frontend files. Sites provisions the private R2 bucket. No database migration or client secret is needed.

The Worker trusts `oai-authenticated-user-id` **only behind Sites dispatch**, which authenticates visitors and supplies this header. Do not deploy it directly to an unprotected endpoint that accepts this header from clients. Static hosting supports the local editor; enabling cloud on another platform requires a trusted identity adapter before the cloud handler.

Sign-in is a top-level link to the platform-owned `/signin-with-chatgpt` route. The app does not implement its own OAuth/session system. A private Site retains its access policy: an editor invite grants access to a design, but does not admit someone through the Site’s audience boundary.

## File layout and concurrency

R2 project objects use `designs/<SHA-256 site user ID>/<random UUID>`. Permission metadata stores the owner, collaborator hashes, title, invite hash/expiry and Trash flag. The body contains the validated, asset-packed project and a random write nonce. A small `members/<user hash>/<cloud ID>` index lists shared files; permission checks always use the target file, so a stale index cannot grant access.

Every mutation compares the previous object ETag. A nonce changes the ETag for permission-only writes too, so a concurrent project save cannot restore revoked permissions. R2 conditional `put` accepts one matching write; a competing save receives HTTP 409. Files and their permissions update together in the same object. This avoids separate database/object-store commits.

The client polls every four seconds while visible. Clean local copies receive cloud changes; dirty copies attempt a conditional save. If both versions changed, sync pauses. The user can save their local version as a new cloud file or create a named local conflict backup before opening the cloud version. This deliberately does not attempt object-level merge or shared cursors.

New invites expire after seven days. Creating a new invite invalidates the previous invite, while existing members remain authorized. **Revoke team access** invalidates the invite and removes every collaborator. Moving a file to cloud Trash also revokes access; restore keeps the previous team revoked. Trash is recoverable and there is no permanent-delete action in this release.

## Trust boundaries and limits

- All cloud routes require authenticated identity; reads authorize ownership or membership before returning project content.
- Writes require a matching Origin and reject cross-site requests. JSON is streamed with an 8 MB cap and imported scenes pass the same allowlist validation as local files.
- Cloud responses are private/no-store. The service worker does not cache API or authentication routes.
- Up to 100 owned files, including Trash, and 20 collaborators per file. The file-count cap is a bounded library limit, not a transactional billing quota under concurrent creates.
- Files are stored with the hosting provider. This is not end-to-end encryption. Storage, request charges, account access and backups are the host’s responsibility.
- Local files can exceed the cloud cap; a rejected cloud save preserves the editable local project.

## Verification

`npm run test:unit` exercises the API with an R2 contract adapter: missing identity, cross-origin and invalid/oversized writes, private-file reads, invite checks, simultaneous conditional saves, revocation and recoverable Trash. Production browser tests use the actual built Worker with this adapter and two isolated signed-in test sessions.

For local cloud QA only:

```sh
npm run build
TEST_PRODUCTION=1 TEST_CLOUD=1 npm test
```

`checks/preview-cloud.mjs` binds loopback, rejects other Host values and strips incoming platform identity headers. Its explicit test cookie and in-memory storage are not included in the deployed Worker. Local QA does not verify real hosted R2 or two real platform accounts; record that separately when performed.

Storage semantics follow the [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/). Browser recording capability uses [MediaRecorder capability detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static).
