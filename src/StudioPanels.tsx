import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Copy,
  Trash2,
  RotateCcw,
  FolderOpen,
  Search,
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  LockKeyholeOpen,
  Eye,
  EyeOff,
  Group as GroupIcon,
  Ungroup,
  Upload,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";
import {
  FabricImage,
  FabricObject,
  Group,
  ActiveSelection,
  Textbox,
} from "fabric";
import type { Editor, EditorState } from "./editor";
import {
  type DesignSummary,
  type Brand,
  readLocal,
  listDesigns,
  trashDesign,
  validateBrand,
  validateDocument,
} from "./project";
import { templateProject } from "./templates";

export function ProjectsPanel({
  editor,
  revision,
  notify,
  onOpen,
}: {
  editor: Editor;
  revision: string;
  notify: (s: string) => void;
  onOpen: () => void;
}) {
  const [items, setItems] = useState<DesignSummary[]>([]),
    [query, setQuery] = useState(""),
    [trash, setTrash] = useState(false),
    [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      setItems(await listDesigns());
    } catch {
      notify(
        "Your saved designs could not be read. Download a backup of the current design.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, [revision]);
  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const open = async (id: string, duplicate = false) => {
    const raw = await readLocal("design:" + id);
    const doc = validateDocument(raw);
    if (duplicate) doc.title = (doc.title + " copy").slice(0, 160);
    await editor.openDocument(doc, duplicate);
    onOpen();
  };
  const filtered = items.filter(
    (i) =>
      Boolean(i.trashedAt) === trash &&
      i.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <button
        className="primary full"
        disabled={editor.busy}
        onClick={() =>
          void run(async () => {
            await editor.openDocument(
              { ...templateProject("blank"), title: "Untitled design" },
              true,
            );
            onOpen();
          })
        }
      >
        <Plus size={16} />
        New design
      </button>
      <label className="search project-search">
        <Search size={16} />
        <input
          aria-label="Search saved designs"
          placeholder="Search your designs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="filter-row">
        <button
          className={!trash ? "filter active" : "filter"}
          onClick={() => setTrash(false)}
        >
          Your designs
        </button>
        <button
          className={trash ? "filter active" : "filter"}
          onClick={() => setTrash(true)}
        >
          Trash
        </button>
      </div>
      <p className="muted small">
        Saved on this device. Download a project file to move it to another
        browser.
      </p>
      {loading ? (
        <p className="empty">Opening your library…</p>
      ) : !filtered.length ? (
        <p className="empty">
          {trash
            ? "Your trash is empty."
            : "A little space for your next big idea."}
        </p>
      ) : (
        <div className="project-list">
          {filtered.map((item) => (
            <article className="project-card" key={item.id}>
              <button
                className="project-preview"
                disabled={editor.busy || trash}
                aria-label={`Open design ${item.title}`}
                onClick={() => void run(() => open(item.id))}
              >
                <img src={item.thumbnail} alt="" loading="lazy" />
                <span>
                  {item.pageCount} {item.pageCount === 1 ? "page" : "pages"}
                </span>
              </button>
              <div className="project-caption">
                <strong>{item.title || "Untitled design"}</strong>
                {item.id === editor.documentId && (
                  <span className="free-tag">OPEN</span>
                )}
              </div>
              <div className="project-meta">
                <time dateTime={new Date(item.updatedAt).toISOString()}>
                  {new Date(item.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <div>
                  {trash ? (
                    <button
                      aria-label={`Restore ${item.title}`}
                      title="Restore design"
                      onClick={() =>
                        void run(() => trashDesign(item.id, false))
                      }
                    >
                      <RotateCcw size={15} />
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={editor.busy}
                        aria-label={`Duplicate design ${item.title}`}
                        title="Duplicate design"
                        onClick={() => void run(() => open(item.id, true))}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        disabled={item.id === editor.documentId || editor.busy}
                        aria-label={`Move ${item.title} to trash`}
                        title={
                          item.id === editor.documentId
                            ? "Open another design before moving this one to trash"
                            : "Move to trash · recoverable"
                        }
                        onClick={() =>
                          void run(() => trashDesign(item.id, true))
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export function PagesBar({
  editor,
  state,
  run,
}: {
  editor: Editor | null;
  state: EditorState;
  run: (f: () => void | Promise<void>) => void;
}) {
  return (
    <div className="pages-bar" aria-label="Design pages">
      <div className="page-tabs">
        {state.pages.map((p, i) => (
          <button
            disabled={state.busy}
            key={p.id}
            aria-label={`Go to ${p.name}`}
            aria-current={p.id === state.activePageId ? "page" : undefined}
            className={
              p.id === state.activePageId ? "page-tab active" : "page-tab"
            }
            onClick={() => run(() => editor?.selectPage(p.id))}
          >
            <span style={{ background: p.background }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <strong>{p.name || `Page ${i + 1}`}</strong>
          </button>
        ))}
      </div>
      <div className="page-actions">
        <button
          title="Add blank page"
          aria-label="Add page"
          disabled={state.busy || state.pages.length >= 20}
          onClick={() => run(() => editor?.addPage())}
        >
          <Plus size={17} />
        </button>
        <button
          title="Duplicate page"
          aria-label="Duplicate page"
          disabled={state.busy || state.pages.length >= 20}
          onClick={() => run(() => editor?.addPage(true))}
        >
          <Copy size={15} />
        </button>
        <button
          title="Move page earlier"
          aria-label="Move page earlier"
          disabled={state.busy || state.pages[0]?.id === state.activePageId}
          onClick={() => run(() => editor?.movePage(-1))}
        >
          <ArrowLeft size={15} />
        </button>
        <button
          title="Move page later"
          aria-label="Move page later"
          disabled={state.busy || state.pages.at(-1)?.id === state.activePageId}
          onClick={() => run(() => editor?.movePage(1))}
        >
          <ArrowRight size={15} />
        </button>
        <button
          title="Delete page · undo available"
          aria-label="Delete page"
          disabled={state.busy || state.pages.length <= 1}
          onClick={() => run(() => editor?.deletePage())}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export function LayersPanel({
  editor,
  state,
  onAdd,
}: {
  editor: Editor;
  state: EditorState;
  onAdd: () => void;
}) {
  return (
    <>
      <p className="muted small">
        Top = front. Shift-click on the canvas to select multiple layers, then
        group them.
      </p>
      <div className="layer-list">
        {state.layers.map((o, i) => (
          <div
            className={state.active === o ? "layer-row active" : "layer-row"}
            key={i}
          >
            <button
              className="layer-select"
              disabled={state.busy}
              onClick={() => editor.select(o)}
            >
              <span className="layer-icon">
                {o instanceof Textbox
                  ? "T"
                  : o instanceof FabricImage
                    ? "▧"
                    : o instanceof Group
                      ? "▦"
                      : "◈"}
              </span>
              <span>
                {String(
                  o.get("name") ||
                    (o instanceof Textbox
                      ? o.text.slice(0, 34)
                      : o instanceof FabricImage
                        ? "Uploaded image"
                        : o.type),
                )}
              </span>
            </button>
            <button
              aria-label={`${o.visible ? "Hide" : "Show"} layer ${i + 1}`}
              title={o.visible ? "Hide layer" : "Show layer"}
              disabled={state.busy}
              onClick={() => editor.toggleVisibility(o)}
            >
              {o.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button
              aria-label={`${o.lockMovementX ? "Unlock" : "Lock"} layer ${i + 1}`}
              title={o.lockMovementX ? "Unlock layer" : "Lock layer"}
              disabled={state.busy}
              onClick={() => editor.toggleLock(o)}
            >
              {o.lockMovementX ? (
                <LockKeyhole size={13} />
              ) : (
                <LockKeyholeOpen size={13} />
              )}
            </button>
          </div>
        ))}
      </div>
      {!state.layers.length && (
        <p className="empty">A fresh canvas. Add something good.</p>
      )}
      <button className="secondary full" onClick={onAdd}>
        <Plus size={16} />
        Add an element
      </button>
    </>
  );
}

export function SelectionTools({
  editor,
  state,
  run,
}: {
  editor: Editor;
  state: EditorState;
  run: (f: () => void | Promise<void>) => void;
}) {
  const object = state.active;
  if (!object) return null;
  return (
    <>
      {object instanceof ActiveSelection ? (
        <p className="small muted">{state.selectionCount} layers selected</p>
      ) : (
        <label className="field layer-name">
          Layer name
          <input
            aria-label="Layer name"
            maxLength={60}
            value={String(object.get("name") || "")}
            placeholder={object.type}
            onChange={(e) => editor.change({ name: e.target.value })}
          />
        </label>
      )}
      <div className="selection-actions">
        <button
          className="secondary"
          aria-label={
            object.lockMovementX ? "Unlock selection" : "Lock selection"
          }
          onClick={() => editor.toggleLock(object)}
        >
          {object.lockMovementX ? (
            <LockKeyhole size={14} />
          ) : (
            <LockKeyholeOpen size={14} />
          )}{" "}
          {object.lockMovementX ? "Unlock" : "Lock"}
        </button>
        {state.selectionCount > 1 ? (
          <button
            className="secondary"
            onClick={() => run(() => editor.group())}
          >
            <GroupIcon size={14} /> Group
          </button>
        ) : object instanceof Group && !(object instanceof ActiveSelection) ? (
          <button
            className="secondary"
            onClick={() => run(() => editor.ungroup())}
          >
            <Ungroup size={14} /> Ungroup
          </button>
        ) : null}
      </div>
    </>
  );
}

export function ImageTools({
  editor,
  image,
}: {
  editor: Editor;
  image: FabricImage;
}) {
  const natural = image.getOriginalSize(),
    isOriginal =
      image.cropX === 0 &&
      image.cropY === 0 &&
      image.width === natural.width &&
      image.height === natural.height;
  const ratio = isOriginal
    ? "original"
    : String(
        [1, 16 / 9, 4 / 5, 9 / 16].find(
          (r) => Math.abs(image.width / image.height - r) < 0.001,
        ) || "custom",
      );
  return (
    <>
      <h3 className="property-label">Crop & flip</h3>
      <select
        aria-label="Crop preset"
        value={ratio}
        onChange={(e) =>
          editor.cropImage(
            e.target.value === "original" ? null : +e.target.value,
          )
        }
      >
        <option value="original">Original image</option>
        <option value="1">Square · 1:1</option>
        <option value={16 / 9}>Landscape · 16:9</option>
        <option value={4 / 5}>Portrait · 4:5</option>
        <option value={9 / 16}>Story · 9:16</option>
        <option value="custom" disabled>
          Custom crop
        </option>
      </select>
      {(["cropX", "cropY"] as const).map((axis) => {
        const max =
          axis === "cropX"
            ? natural.width - image.width
            : natural.height - image.height;
        return max > 0.1 ? (
          <label key={axis} className="adjustment-field">
            <span>
              {axis === "cropX" ? "Horizontal crop" : "Vertical crop"}
            </span>
            <input
              aria-label={
                axis === "cropX" ? "Horizontal crop" : "Vertical crop"
              }
              type="range"
              min="0"
              max={max}
              value={image[axis]}
              onChange={(e) => editor.adjustCrop(axis, +e.target.value)}
            />
          </label>
        ) : null;
      })}
      <div className="selection-actions">
        <button
          className="secondary"
          onClick={() => editor.change({ flipX: !image.flipX })}
        >
          <FlipHorizontal size={15} />
          Flip X
        </button>
        <button
          className="secondary"
          onClick={() => editor.change({ flipY: !image.flipY })}
        >
          <FlipVertical size={15} />
          Flip Y
        </button>
      </div>
      <h3 className="property-label">Photo adjustments</h3>
      {(["Brightness", "Contrast", "Saturation"] as const).map((name) => {
        const f = image.filters.find((f) => f.type === name)?.toObject() as
          Record<string, unknown> | undefined;
        const value = Number(f?.[name.toLowerCase()] || 0);
        return (
          <label className="adjustment-field" key={name}>
            <span>
              {name}
              <small>{Math.round(value * 100)}</small>
            </span>
            <input
              type="range"
              aria-label={name}
              min="-100"
              max="100"
              value={Math.round(value * 100)}
              onChange={(e) =>
                editor.imageAdjustment(name, +e.target.value / 100)
              }
            />
          </label>
        );
      })}
      <label className="check-field small">
        <input
          type="checkbox"
          checked={image.filters.some((f) => f.type === "Grayscale")}
          onChange={(e) =>
            editor.imageAdjustment("Grayscale", e.target.checked ? 1 : 0)
          }
        />
        Black & white
      </label>
      <button
        className="text-link"
        onClick={() => {
          image.filters = [];
          image.applyFilters();
          editor.commit();
        }}
      >
        Reset photo adjustments
      </button>
    </>
  );
}

export function BrandRestore({
  onImport,
  notify,
}: {
  onImport: (b: Brand) => Promise<boolean>;
  notify: (s: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        className="secondary full brand-restore"
        onClick={() => input.current?.click()}
      >
        <Upload size={15} />
        Restore kit backup
      </button>
      <input
        className="hidden"
        aria-label="Import brand kit file"
        type="file"
        accept="application/json,.json"
        ref={input}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            void (async () => {
              try {
                if (file.size > 25 * 1024 * 1024)
                  throw Error("Brand kit file is too large.");
                if (
                  await onImport(validateBrand(JSON.parse(await file.text())))
                )
                  notify("Brand kit restored.");
              } catch (e) {
                notify((e as Error).message);
              }
            })();
        }}
      />
    </>
  );
}
