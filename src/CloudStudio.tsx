import { useEffect, useRef, useState } from "react";
import type { Editor } from "./editor";
import { packDocument, saveDocument, validateDocument } from "./project";

interface CloudFile {
  id: string;
  title: string;
  revision: string;
  owner: boolean;
  memberCount: number;
  updatedAt: number;
  trashed?: boolean;
  document?: unknown;
}
interface Connection {
  id: string;
  localId: string;
  revision: string;
  localRevision: number;
  owner: boolean;
}
class CloudError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function api(
  path: string,
  method = "GET",
  data?: unknown,
  revision?: string,
) {
  const response = await fetch("/api/cloud/" + path, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(30000),
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(revision ? { "If-None-Match": revision } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (response.status === 304) return null;
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new CloudError(
      503,
      "This server has no cloud storage. Local designs still work; deploy the Worker to enable cloud.",
    );
  const result = await response.json();
  if (!response.ok)
    throw new CloudError(
      response.status,
      result.error || "Cloud request failed.",
    );
  return result;
}

export default function CloudStudio({
  editor,
  visible,
  notify,
  onStatus,
}: {
  editor: Editor;
  visible: boolean;
  notify: (message: string) => void;
  onStatus: (status: { message: string; conflict: boolean }) => void;
}) {
  const [status, setStatus] = useState("Checking cloud…"),
    [signedIn, setSignedIn] = useState(false),
    [files, setFiles] = useState<CloudFile[]>([]);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [problem, setProblem] = useState(false);
  const retryAt = useRef(0),
    lastError = useRef("");
  const [connected, setConnected] = useState(false),
    [owner, setOwner] = useState(false),
    [conflict, setConflict] = useState(false),
    [busy, setBusy] = useState(false),
    [automatic, setAutomatic] = useState(true),
    [link, setLink] = useState("");
  const connection = useRef<Connection | null>(null),
    working = useRef(false),
    stopped = useRef(false),
    conflictRef = useRef(false);
  const syncRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    onStatus({ message: status, conflict: conflict || problem });
  }, [status, conflict, problem, onStatus]);
  const applyConnection = (
    file: CloudFile,
    localRevision = editor.revision,
  ) => {
    connection.current = {
      id: file.id,
      localId: editor.documentId,
      revision: file.revision,
      localRevision,
      owner: file.owner,
    };
    setConnected(true);
    setOwner(file.owner);
    setConflict(false);
    conflictRef.current = false;
    setLink("");
  };
  const refresh = async () => {
    const result = await api("designs");
    if (!stopped.current) {
      setFiles(result.designs);
      if (result.truncated)
        notify("Showing the first 100 owned and shared cloud files.");
    }
  };
  const error = (e: unknown) => {
    const message =
      e instanceof Error
        ? e.message
        : "Cloud is unavailable. Your local design is safe.";
    setStatus(message);
    setProblem(true);
    retryAt.current = Date.now() + 30000;
    if (!visible && lastError.current !== message) notify(message);
    lastError.current = message;
    if (e instanceof CloudError && e.status === 409) {
      setConflict(true);
      conflictRef.current = true;
    }
    if (e instanceof CloudError && e.status === 401) {
      setSignedIn(false);
      setNeedsSignIn(true);
    }
    if (e instanceof CloudError && [403, 404].includes(e.status))
      setAutomatic(false);
  };
  const run = async (fn: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await fn();
      setProblem(false);
      lastError.current = "";
    } catch (e) {
      error(e);
    } finally {
      working.current = false;
      if (!stopped.current) setBusy(false);
    }
  };
  const open = async (id: string, backup = false) => {
    const file: CloudFile = await api("designs/" + id),
      doc = validateDocument(file.document);
    if (backup) {
      const local = editor.document();
      await saveDocument(
        {
          ...local,
          id: crypto.randomUUID(),
          title: (local.title + " (conflict backup)").slice(0, 160),
        },
        "",
      );
    }
    await editor.openDocument({
      ...doc,
      id: backup ? editor.documentId : crypto.randomUUID(),
      activePageId: doc.activePageId,
    });
    applyConnection(file);
    setStatus("Cloud connected · changes sync automatically");
  };
  const create = async () => {
    if (editor.busy) return;
    const localRevision = editor.revision,
      localId = editor.documentId;
    const file: CloudFile = await api("designs", "POST", {
      document: packDocument(editor.document()),
    });
    if (editor.documentId === localId) applyConnection(file, localRevision);
    setStatus("Saved to your cloud library");
    await refresh();
  };
  const sync = async () => {
    const current = connection.current;
    if (
      !current ||
      conflictRef.current ||
      editor.busy ||
      (editor.canvas.getActiveObject() as { isEditing?: boolean } | undefined)
        ?.isEditing
    )
      return;
    if (editor.documentId !== current.localId) {
      connection.current = null;
      setConnected(false);
      setLink("");
      setStatus("Local design opened · cloud sync disconnected");
      return;
    }
    if (editor.revision !== current.localRevision) {
      const localRevision = editor.revision;
      const file: CloudFile = await api("designs/" + current.id, "PUT", {
        revision: current.revision,
        document: packDocument(editor.document()),
      });
      current.revision = file.revision;
      current.localRevision = localRevision;
      setStatus("Cloud changes saved");
    } else {
      const localRevision = editor.revision;
      const file: CloudFile | null = await api(
        "designs/" + current.id,
        "GET",
        undefined,
        current.revision,
      );
      if (file) {
        if (
          editor.revision !== localRevision ||
          editor.busy ||
          (
            editor.canvas.getActiveObject() as
              { isEditing?: boolean } | undefined
          )?.isEditing
        )
          throw new CloudError(
            409,
            "Cloud and local edits changed together. Both versions are preserved.",
          );
        const doc = validateDocument(file.document);
        const remote = {
          ...doc,
          id: current.localId,
          activePageId: doc.pages.some((p) => p.id === editor.activePageId)
            ? editor.activePageId
            : doc.activePageId,
        };
        const local = validateDocument(editor.document());
        if (
          JSON.stringify(packDocument(local)) !==
          JSON.stringify(packDocument(remote))
        )
          await editor.openDocument(remote);
        current.revision = file.revision;
        current.localRevision = editor.revision;
        setStatus("Received the latest team changes");
      }
    }
  };
  syncRef.current = async () => {
    if (!working.current && connection.current && !conflictRef.current)
      await run(sync);
  };
  useEffect(() => {
    stopped.current = false;
    void run(async () => {
      await api("session");
      if (stopped.current) return;
      setSignedIn(true);
      setNeedsSignIn(false);
      setStatus("Ready · designs stay local until you save to cloud");
      const params = new URLSearchParams(location.hash.slice(1)),
        id = params.get("cloud"),
        token = params.get("invite");
      if (id) {
        if (token)
          await api("designs/" + encodeURIComponent(id) + "/join", "POST", {
            token,
          });
        await open(id);
        history.replaceState(null, "", location.pathname + location.search);
      }
      await refresh();
    });
    return () => {
      stopped.current = true;
    };
  }, []);
  useEffect(() => {
    if (!automatic || !signedIn) return;
    const timer = setInterval(() => {
      if (!document.hidden && Date.now() >= retryAt.current)
        void syncRef.current();
    }, 4000);
    return () => clearInterval(timer);
  }, [automatic, signedIn]);
  useEffect(() => {
    if (visible && signedIn) void run(refresh);
  }, [visible]);
  useEffect(() => {
    if (
      connection.current &&
      connection.current.localId !== editor.documentId
    ) {
      connection.current = null;
      setConnected(false);
      setLink("");
      setConflict(false);
      conflictRef.current = false;
      setStatus("Local design opened · cloud sync disconnected");
    }
  }, [editor.documentId]);
  const share = async (revoke = false) => {
    await sync();
    if (conflictRef.current) return;
    const current = connection.current;
    if (!current) return;
    const file = await api(
      "designs/" + current.id + "/share",
      revoke ? "DELETE" : "POST",
      { revision: current.revision },
    );
    current.revision = file.revision;
    setLink(
      revoke
        ? ""
        : `${location.origin}/#cloud=${current.id}&invite=${file.token}`,
    );
    setStatus(
      revoke
        ? "All collaborators and invite links revoked"
        : "Invite expires in seven days. Anyone with it can join as an editor.",
    );
  };
  const trash = async (file: CloudFile) => {
    await api(
      `designs/${file.id}/${file.trashed ? "restore" : "trash"}`,
      "POST",
      { revision: file.revision },
    );
    if (connection.current?.id === file.id) {
      connection.current = null;
      setConnected(false);
      setLink("");
      setConflict(false);
      conflictRef.current = false;
    }
    setStatus(
      file.trashed
        ? "Cloud design restored. Previous team access remains revoked."
        : "Moved to cloud Trash. Your local copy is kept.",
    );
    await refresh();
  };
  if (!visible) return null;
  return (
    <div className="cloud-studio">
      <p className="dialog-description">
        Your private cloud library. Team changes sync every four seconds while
        this tab is active.
      </p>
      <p className="muted small">
        8 MB per cloud file · 100 owned designs · up to 20 invited editors.
        Reopen a cloud design from this library after reloading.
      </p>
      <p role="status" className="cloud-status">
        {status}
      </p>
      {needsSignIn && (
        <a
          className="secondary full"
          target="_top"
          href={
            "/signin-with-chatgpt?return_to=" +
            encodeURIComponent(
              location.pathname + location.search + location.hash,
            )
          }
        >
          Sign in with ChatGPT
        </a>
      )}
      {signedIn && (
        <>
          <button
            className="primary full"
            disabled={busy || editor.busy}
            onClick={() => void run(create)}
          >
            {connected
              ? "Save local version as a new cloud design"
              : "Save this design to cloud"}
          </button>
          {connected && (
            <>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={automatic}
                  onChange={(e) => setAutomatic(e.target.checked)}
                />
                <span>Automatically sync this design</span>
              </label>
              <button
                className="secondary full"
                disabled={busy || conflict}
                onClick={() => void run(sync)}
              >
                Sync now
              </button>
              <button
                className="secondary full"
                disabled={busy}
                onClick={() => {
                  connection.current = null;
                  setConnected(false);
                  setLink("");
                  setConflict(false);
                  conflictRef.current = false;
                  setStatus("Disconnected · your local copy stays editable");
                }}
              >
                Disconnect cloud sync
              </button>
              {owner && (
                <div className="cloud-actions">
                  <button
                    className="secondary"
                    disabled={busy || conflict}
                    onClick={() => void run(() => share())}
                  >
                    Create editor invite
                  </button>
                  <button
                    className="secondary"
                    disabled={busy || conflict}
                    onClick={() => void run(() => share(true))}
                  >
                    Revoke team access
                  </button>
                </div>
              )}
            </>
          )}
          {conflict && (
            <div className="cloud-conflict" role="alert">
              <p>
                Sync paused. Your local edits and the cloud version both exist.
              </p>
              <button
                className="secondary full"
                disabled={busy}
                onClick={() =>
                  void run(() => open(connection.current!.id, true))
                }
              >
                Back up my edits, then use cloud version
              </button>
              <p className="muted small">
                Or save your local version as a new cloud design above.
              </p>
            </div>
          )}
          {link && (
            <>
              <label className="field">
                Editor invite link
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <button
                className="secondary full"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(link)
                    .then(() => notify("Invite link copied"))
                    .catch(() =>
                      notify("Select the invite link and copy it manually."),
                    )
                }
              >
                Copy invite link
              </button>
            </>
          )}
          <p className="muted small">
            Invites grant editing access. On a private Site, the owner must also
            allow the visitor through the Site’s sharing settings. This screen
            does not change the Site audience.
          </p>
          <div className="cloud-actions">
            <h3>Cloud designs</h3>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void run(refresh)}
            >
              Refresh library
            </button>
          </div>
          {!files.length && (
            <p className="muted small">
              Your first cloud design will appear here.
            </p>
          )}
          <div className="cloud-library">
            {files.map((file) => (
              <div className="cloud-file" key={file.id}>
                <button
                  className="secondary full"
                  disabled={busy || editor.busy || file.trashed}
                  onClick={() => void run(() => open(file.id))}
                >
                  {file.title || "Untitled design"}
                </button>
                <small>
                  {file.trashed
                    ? "In cloud Trash"
                    : file.owner
                      ? "Owned by you"
                      : "Shared with you"}{" "}
                  · {new Date(file.updatedAt).toLocaleDateString()}
                </small>
                {file.owner && (
                  <button
                    className="secondary small"
                    disabled={busy}
                    onClick={() => void run(() => trash(file))}
                  >
                    {file.trashed
                      ? "Restore cloud design"
                      : "Move cloud design to Trash"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
