import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Bold,
  Check,
  ChevronDown,
  Circle as CircleIcon,
  Copy,
  Download,
  Expand,
  FolderOpen,
  HelpCircle,
  ImagePlus,
  Italic,
  Layers,
  LayoutTemplate,
  LockKeyholeOpen,
  Maximize2,
  Minus,
  MousePointer2,
  Palette,
  Plus,
  Redo2,
  Search,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Upload,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  WandSparkles,
} from "lucide-react";
import { FabricImage, Textbox, ActiveSelection } from "fabric";
import { Editor, type EditorState } from "./editor";
import {
  color,
  dimension,
  download,
  fonts,
  imageData,
  readLocal,
  swatches,
  writeLocal,
  readCurrentDocument,
  validateBrand,
  type Brand,
} from "./project";
import { templates, templateProject } from "./templates";
import {
  ProjectsPanel,
  PagesBar,
  LayersPanel,
  SelectionTools,
  ImageTools,
  BrandRestore,
} from "./StudioPanels";
const CloudStudio = lazy(() => import("./CloudStudio"));
const MotionStudio = lazy(() => import("./MotionStudio"));

const initial: EditorState = {
  title: "Good things",
  width: 1080,
  height: 1080,
  background: "#f7f1df",
  layers: [],
  active: null,
  canUndo: false,
  canRedo: false,
  save: "Opening studio…",
  zoom: 1,
  busy: true,
  pages: [],
  activePageId: "",
  selectionCount: 0,
  documentId: "",
  historyBytes: 0,
};
type Panel =
  | "Projects"
  | "Templates"
  | "Elements"
  | "Text"
  | "Uploads"
  | "Brand kit"
  | "Layers";
const panels = [
  { name: "Projects", icon: FolderOpen },
  { name: "Templates", icon: LayoutTemplate },
  { name: "Elements", icon: Shapes },
  { name: "Text", icon: Type },
  { name: "Uploads", icon: ImagePlus },
  { name: "Brand kit", icon: Palette },
  { name: "Layers", icon: Layers },
] as const;
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => {
      d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-label={title}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Tool({
  label,
  onClick,
  children,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      className="icon-button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ModalHost({
  visible,
  close,
  children,
}: {
  visible: boolean;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (visible && !dialog.open) dialog.showModal();
    else if (!visible && dialog.open) dialog.close();
  }, [visible]);
  return (
    <dialog
      ref={ref}
      aria-label="Cloud and team"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-head">
        <h2>Cloud and team</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    hostRef = useRef<HTMLDivElement>(null),
    editor = useRef<Editor | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null),
    projectRef = useRef<HTMLInputElement>(null),
    logoRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(initial),
    [panel, setPanel] = useState<Panel>("Templates"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All");
  const [toast, setToast] = useState(""),
    [modal, setModal] = useState<
      "export" | "resize" | "help" | "cloud" | "motion" | null
    >(null),
    [task, setTask] = useState(""),
    [ready, setReady] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(1080),
    [resizeHeight, setResizeHeight] = useState(1080),
    [scaleContent, setScaleContent] = useState(true);
  const [format, setFormat] = useState<"png" | "jpeg" | "svg" | "pdf" | "json">(
      "png",
    ),
    [exportScale, setExportScale] = useState(1),
    [transparent, setTransparent] = useState(false);
  const [allPages, setAllPages] = useState(true);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [cloudStatus, setCloudStatus] = useState({
    message: "Optional cloud library",
    conflict: false,
  });
  useEffect(() => {
    if (ready && new URLSearchParams(location.hash.slice(1)).has("cloud")) {
      setCloudLoaded(true);
      setModal("cloud");
    }
  }, [ready]);
  const [brand, setBrand] = useState<Brand>({
    name: "My creative studio",
    colors: ["#f85c3a", "#3155e7", "#f7f1df", "#173e33"],
    font: fonts[0],
  });
  const [mobilePanel, setMobilePanel] = useState(false),
    [properties, setProperties] = useState(false);
  const notify = (text: string) => setToast(text);
  const run = async (fn: () => void | Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "Something went wrong. Your design is still here.",
      );
    }
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let cancelled = false;
    let instance: Editor | undefined;
    let observer: ResizeObserver | undefined;
    const start = async () => {
      await document.fonts.ready;
      if (cancelled) return;
      instance = new Editor(
        canvasRef.current!,
        hostRef.current!,
        setState,
        notify,
      );
      editor.current = instance;
      try {
        const saved = await readCurrentDocument();
        await instance.load(saved ?? templateProject("good"));
      } catch (e) {
        notify(
          "Could not restore device storage. Starting a fresh canvas; your previous stored file is untouched.",
        );
        await instance.load(templateProject("good"), false);
        instance.history.push(instance.document());
        instance.save = "Restore failed · original storage preserved";
        instance.emit();
      }
      if (cancelled) {
        await instance.dispose();
        return;
      }
      observer = new ResizeObserver(() => instance?.fit(false));
      observer.observe(hostRef.current!);
      instance.fit();
      setReady(true);
      try {
        const b = await readLocal("brand");
        if (b) setBrand(validateBrand(b));
      } catch {}
    };
    void start().catch((e) => notify(String(e)));
    return () => {
      cancelled = true;
      observer?.disconnect();
      editor.current = null;
      if (instance) void instance.dispose();
    };
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const ed = editor.current;
      if (!ed || ed.busy || document.querySelector("dialog[open]")) return;
      const element = event.target as HTMLElement;
      if (
        element.closest('input,textarea,select,[contenteditable="true"]') ||
        (ed.canvas.getActiveObject() instanceof Textbox &&
          (ed.canvas.getActiveObject() as Textbox).isEditing)
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void run(() => ed.undo(event.shiftKey ? 1 : -1));
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        void run(() => ed.duplicate());
      }
      const command = event.ctrlKey || event.metaKey;
      if (command && ["a", "c", "v", "g"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        const key = event.key.toLowerCase();
        void run(() =>
          key === "a"
            ? ed.selectAll()
            : key === "c"
              ? ed.copy()
              : key === "v"
                ? ed.paste()
                : event.shiftKey
                  ? ed.ungroup()
                  : ed.group(),
        );
      }
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        ed.nudge(
          event.key === "ArrowLeft"
            ? -step
            : event.key === "ArrowRight"
              ? step
              : 0,
          event.key === "ArrowUp"
            ? -step
            : event.key === "ArrowDown"
              ? step
              : 0,
        );
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        ed.remove();
      }
      if (event.key === "Escape") {
        ed.canvas.discardActiveObject();
        ed.canvas.requestRenderAll();
        ed.emit();
      }
    };
    document.addEventListener("keydown", handler);
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (editor.current?.save === "Saving…" || editor.current?.busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => {
      document.removeEventListener("keydown", handler);
      window.removeEventListener("beforeunload", warnBeforeLeaving);
    };
  }, []);
  const ed = () => {
    if (!editor.current) throw Error("Studio is still loading.");
    return editor.current;
  };
  const updateBrand = async (next: Brand) => {
    setBrand(next);
    try {
      await writeLocal("brand", next);
    } catch {
      notify("Brand kit could not be saved. Device storage may be full.");
    }
  };
  const change = (values: Record<string, unknown>) =>
    run(() => ed().change(values));
  const object = state.active;
  const textObject = object instanceof Textbox;
  const selectionFill =
    object instanceof ActiveSelection
      ? object.getObjects().find((o) => !(o instanceof FabricImage))?.fill
      : object?.fill;
  const selectionOpacity =
    object instanceof ActiveSelection
      ? (object.getObjects()[0]?.opacity ?? 1)
      : (object?.opacity ?? 1);
  const openResize = () => {
    setResizeWidth(state.width);
    setResizeHeight(state.height);
    setModal("resize");
  };
  const upload = async (file?: File) => {
    if (file)
      await run(async () => {
        await ed().addImage(await imageData(file));
        setPanel("Layers");
        notify("Image added. Select it to remove its background.");
      });
  };
  const exportFile = async () => {
    setTask("Preparing your download…");
    try {
      await ed().export(format, exportScale, transparent, allPages);
      notify("Your download is ready. Go make something with it.");
      setModal(null);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setTask("");
    }
  };
  const visibleTemplates = templates.filter(
    (t) =>
      (filter === "All" || t.category === filter) &&
      (t.name + " " + t.category).toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setModal("help");
          }}
          aria-label="About OpenRang"
        >
          <img src="/favicon.svg" alt="" />
          <span>
            OpenRang<span className="brand-dot">.</span>
          </span>
          <span className="studio-label">STUDIO</span>
        </a>
        <div className="top-divider" />
        <div className="document-title">
          <input
            aria-label="Design title"
            value={state.title}
            maxLength={160}
            disabled={!ready || state.busy}
            onChange={(e) => ed().rename(e.target.value)}
          />
          <span
            className={
              state.save.startsWith("Save failed")
                ? "save-status error"
                : "save-status"
            }
          >
            <span className="status-dot" />
            {state.save}
          </span>
        </div>
        <div className="top-actions">
          <span className="free-badge">
            <LockKeyholeOpen size={13} /> Free by design
          </span>
          <Tool
            label="Saved designs"
            onClick={() => {
              setPanel("Projects");
              setMobilePanel(true);
            }}
            disabled={!ready || state.busy}
          >
            <Layers size={18} />
          </Tool>
          <Tool
            label="Open project"
            onClick={() => projectRef.current?.click()}
            disabled={!ready || state.busy}
          >
            <FolderOpen size={18} />
          </Tool>
          <Tool
            label="Undo"
            onClick={() => run(() => ed().undo())}
            disabled={!state.canUndo || state.busy}
          >
            <Undo2 size={18} />
          </Tool>
          <Tool
            label="Redo"
            onClick={() => run(() => ed().undo(1))}
            disabled={!state.canRedo || state.busy}
          >
            <Redo2 size={18} />
          </Tool>
          <button
            className="secondary resize-top"
            onClick={openResize}
            disabled={!ready || state.busy}
          >
            <Expand size={16} /> Resize
          </button>
          <Tool
            label="Cloud and team"
            onClick={() => {
              setCloudLoaded(true);
              setModal("cloud");
            }}
            disabled={!ready || state.busy}
          >
            <Upload size={18} />
            <span
              className={
                cloudStatus.conflict
                  ? "cloud-indicator conflict"
                  : "cloud-indicator"
              }
              title={cloudStatus.message}
            >
              {cloudStatus.conflict ? "Sync paused" : "Cloud"}
            </span>
          </Tool>
          <Tool
            label="Animate and video"
            onClick={() => setModal("motion")}
            disabled={!ready || state.busy}
          >
            <Sparkles size={18} />
          </Tool>
          <button
            className="primary"
            onClick={() => setModal("export")}
            disabled={!ready || state.busy}
          >
            <ArrowDownToLine size={17} />
            <span>Export design</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </header>
      <div className="editor-body">
        <nav className="rail" aria-label="Design tools">
          {panels.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={panel === name ? "rail-item active" : "rail-item"}
              onClick={() => {
                setPanel(name);
                setMobilePanel(true);
              }}
              aria-pressed={panel === name}
            >
              <Icon size={22} strokeWidth={1.6} />
              <span>{name}</span>
              {name === "Brand kit" && <span className="rail-new" />}
            </button>
          ))}
          <div className="rail-bottom">
            <Tool label="Help and shortcuts" onClick={() => setModal("help")}>
              <HelpCircle size={21} />
            </Tool>
            <div className="avatar" title="Your local workspace">
              YOU
            </div>
          </div>
        </nav>
        <aside
          className={`library ${mobilePanel ? "mobile-open" : ""}`}
          aria-label={panel}
        >
          <div className="panel-heading">
            <div>
              <h1>{panel}</h1>
              <p>
                {panel === "Templates"
                  ? "A little inspiration. All yours."
                  : panel === "Brand kit"
                    ? "Your signature, on everything."
                    : panel === "Layers"
                      ? "A place for every little thing."
                      : "Make it feel like you."}
              </p>
            </div>
            <button
              className="icon-button mobile-close"
              aria-label="Close tools"
              onClick={() => setMobilePanel(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="library-scroll">
            {panel === "Projects" && ready && editor.current && (
              <ProjectsPanel
                editor={editor.current}
                revision={state.documentId + state.save}
                notify={notify}
                onOpen={() => setMobilePanel(false)}
              />
            )}
            {panel === "Templates" && (
              <>
                <label className="search">
                  <Search size={16} />
                  <input
                    placeholder="Search templates"
                    aria-label="Search templates"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span>⌕</span>
                </label>
                <div className="filter-row">
                  {["All", "Social", "Business", "Event"].map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "filter active" : "filter"}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="section-label">
                  <span>MADE FOR YOUR NEXT IDEA</span>
                  <span>{visibleTemplates.length}</span>
                </div>
                <div className="templates-grid">
                  {visibleTemplates.map((t) => (
                    <button
                      key={t.id}
                      className="template-card"
                      onClick={() =>
                        run(async () => {
                          await ed().applyTemplate(templateProject(t.id));
                          setMobilePanel(false);
                        })
                      }
                      disabled={!ready || state.busy}
                      aria-label={`Use ${t.name} template`}
                    >
                      <div
                        className={`template-art art-${t.id}`}
                        style={{
                          background: t.bg,
                          color: t.ink,
                          fontFamily: t.family,
                        }}
                      >
                        <span className="art-eyebrow">{t.eyebrow}</span>
                        <strong>{t.headline}</strong>
                        {t.id !== "blank" && (
                          <>
                            <i style={{ background: t.accent }} />
                            <small style={{ color: t.bg }}>{t.label}</small>
                            <span className="art-footer">{t.footer}</span>
                          </>
                        )}
                        {t.id === "blank" && <Plus size={28} />}
                      </div>
                      <div className="template-caption">
                        <span>{t.name}</span>
                        <span className="free-tag">FREE</span>
                      </div>
                    </button>
                  ))}
                </div>
                {visibleTemplates.length === 0 && (
                  <p className="empty">No matches. Try another search.</p>
                )}
                <div className="little-note">
                  <Sparkles size={16} />
                  <p>
                    Big ideas. Zero paywalls.
                    <br />
                    <span>Every template is yours to remix.</span>
                  </p>
                </div>
              </>
            )}
            {panel === "Elements" && (
              <>
                <div className="tip-card">
                  <Shapes size={21} />
                  <h3>Start with the simple things.</h3>
                  <p>
                    Build something that’s entirely yours with editable shapes.
                  </p>
                </div>
                <div className="shape-grid">
                  {[
                    { kind: "rect", label: "Rounded rectangle", icon: Square },
                    { kind: "circle", label: "Circle", icon: CircleIcon },
                    { kind: "triangle", label: "Triangle", icon: Triangle },
                  ].map(({ kind, label, icon: Icon }) => (
                    <button
                      key={kind}
                      className="shape-card"
                      aria-label={`Add ${label}`}
                      onClick={() =>
                        run(() => ed().add(kind as "rect", brand.colors[0]))
                      }
                    >
                      <Icon size={46} fill="currentColor" strokeWidth={1} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <h3 className="mini-heading">A color to start with</h3>
                <div className="swatches">
                  {swatches.map((c) => (
                    <button
                      key={c}
                      aria-label={`Add shape in ${c}`}
                      title={c}
                      style={{ background: c }}
                      onClick={() => run(() => ed().add("circle", c))}
                    />
                  ))}
                </div>
              </>
            )}
            {panel === "Text" && (
              <>
                <button
                  className="primary full"
                  onClick={() => run(() => ed().add("text", brand.colors[0]))}
                >
                  <Plus size={17} /> Add a text box
                </button>
                <p className="muted small">
                  Double-click text on the canvas to write. Pick a layer to
                  change its font and color.
                </p>
                <h3 className="mini-heading">Say it your way</h3>
                {[
                  {
                    label: "A BIG IDEA",
                    size: 100,
                    family: fonts[0],
                    weight: 700,
                  },
                  {
                    label: "A little more you.",
                    size: 72,
                    family: "Georgia",
                    weight: 400,
                  },
                  {
                    label: "THE LITTLE DETAILS",
                    size: 36,
                    family: fonts[1],
                    weight: 500,
                  },
                ].map((t) => (
                  <button
                    className="text-preset"
                    key={t.label}
                    style={{ fontFamily: t.family, fontWeight: t.weight }}
                    onClick={() =>
                      run(() => {
                        ed().add("text", brand.colors[0]);
                        ed().change({
                          text: t.label,
                          fontSize: t.size,
                          fontFamily: t.family,
                          fontWeight: t.weight,
                        });
                      })
                    }
                  >
                    {t.label}
                    <Plus size={17} />
                  </button>
                ))}
              </>
            )}
            {panel === "Uploads" && (
              <>
                <button
                  className="upload-zone"
                  onClick={() => uploadRef.current?.click()}
                >
                  <Upload size={30} />
                  <strong>Your photos belong here.</strong>
                  <span>Choose a PNG, JPG or WebP</span>
                  <small>Up to 12 MB · stays on your device</small>
                </button>
                <div className="tip-card">
                  <WandSparkles size={22} />
                  <h3>A clean cut. On the house.</h3>
                  <p>
                    Upload an image, select it, then use Remove background in
                    the properties panel. The AI runs on your device.
                  </p>
                  <span className="tiny-label">
                    FIRST USE DOWNLOADS THE AI MODEL
                  </span>
                </div>
                <h3 className="mini-heading">Images in this design</h3>
                <div className="upload-grid">
                  {state.layers
                    .filter((o) => o instanceof FabricImage)
                    .map((o, i) => (
                      <button
                        key={i}
                        aria-label={`Select image ${i + 1}`}
                        onClick={() => ed().select(o)}
                      >
                        <img
                          src={(o as FabricImage).getSrc()}
                          alt={`Uploaded image ${i + 1}`}
                        />
                      </button>
                    ))}
                </div>
              </>
            )}
            {panel === "Brand kit" && (
              <>
                <div className="kit-label">
                  <Palette size={15} />
                  <span>YOUR BRAND. NO SUBSCRIPTION.</span>
                </div>
                <label className="field">
                  Kit name
                  <input
                    value={brand.name}
                    maxLength={60}
                    onChange={(e) =>
                      void updateBrand({ ...brand, name: e.target.value })
                    }
                  />
                </label>
                <h3 className="mini-heading">
                  Brand colors <span>Click to apply</span>
                </h3>
                <div className="brand-colors">
                  {brand.colors.map((c, i) => (
                    <div key={i}>
                      <button
                        style={{ background: c }}
                        aria-label={`Apply brand color ${c}`}
                        onClick={() =>
                          object ? change({ fill: c }) : ed().setBackground(c)
                        }
                      />
                      <label title="Edit brand color">
                        <input
                          type="color"
                          value={c}
                          aria-label={`Edit brand color ${i + 1}`}
                          onChange={(e) =>
                            void updateBrand({
                              ...brand,
                              colors: brand.colors.map((v, j) =>
                                j === i ? e.target.value : v,
                              ),
                            })
                          }
                        />
                        <span>{c.toUpperCase()}</span>
                      </label>
                    </div>
                  ))}
                </div>
                <label className="field">
                  Brand font
                  <select
                    value={brand.font}
                    onChange={(e) =>
                      void updateBrand({ ...brand, font: e.target.value })
                    }
                  >
                    {fonts.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary full"
                  disabled={!textObject}
                  onClick={() => change({ fontFamily: brand.font })}
                >
                  Apply font to selected text
                </button>
                <h3 className="mini-heading">Your logo</h3>
                {brand.logo ? (
                  <>
                    <button
                      className="logo-preview"
                      aria-label="Add saved logo to design"
                      onClick={() => run(() => ed().addImage(brand.logo!))}
                    >
                      <img src={brand.logo} alt="Your brand logo" />
                      <span>
                        <Plus size={14} /> Add to design
                      </span>
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        void updateBrand({ ...brand, logo: undefined })
                      }
                    >
                      Remove saved logo
                    </button>
                  </>
                ) : (
                  <button
                    className="secondary full"
                    onClick={() => logoRef.current?.click()}
                  >
                    <Upload size={16} /> Upload your logo
                  </button>
                )}
                <p className="muted small">
                  Your kit is saved in this browser. Download a kit backup to
                  take it with you.
                </p>
                <button
                  className="secondary full"
                  onClick={() =>
                    download(
                      new Blob([JSON.stringify(brand, null, 2)], {
                        type: "application/json",
                      }),
                      "openrang-brand-kit.json",
                    )
                  }
                >
                  <Download size={15} /> Download kit backup
                </button>
                <BrandRestore onImport={updateBrand} notify={notify} />
              </>
            )}
            {panel === "Layers" && ready && editor.current && (
              <>
                <button
                  className="secondary full"
                  disabled={state.busy}
                  onClick={() => ed().selectAll()}
                >
                  Select all layers
                </button>
                <LayersPanel
                  editor={editor.current}
                  state={state}
                  onAdd={() => setPanel("Elements")}
                />
              </>
            )}
          </div>
          <div className="library-footer">
            <span className="status-dot" /> PRIVATE BY DEFAULT. CREATIVE BY
            NATURE.
          </div>
        </aside>
        <main className="workspace">
          <div className="workspace-toolbar">
            <div className="breadcrumb">
              <span>Your workspace</span>
              <span>/</span>
              <strong>{state.title || "Untitled design"}</strong>
            </div>
            <div className="workspace-tools">
              <span className="size-label">
                {state.width} × {state.height} px
              </span>
              <button
                className="icon-button mobile-properties"
                aria-label="Toggle properties"
                onClick={() => setProperties(!properties)}
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>
          </div>
          <div
            className="canvas-host"
            ref={hostRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void upload(e.dataTransfer.files[0]);
            }}
          >
            <div className="canvas-stage">
              <div
                className="canvas-paper"
                style={{ pointerEvents: state.busy ? "none" : "auto" }}
                aria-label="Design canvas"
                aria-busy={state.busy}
              >
                <canvas
                  ref={canvasRef}
                  aria-label="Interactive design artwork"
                />
              </div>
            </div>
            {!ready && (
              <div className="loading-card">
                <span className="spinner" />
                Opening your studio…
              </div>
            )}
            {task && (
              <div className="task-card" role="status">
                <span className="spinner" />
                {task}
                {state.busy && (
                  <button
                    className="secondary"
                    onClick={() => ed().cancelBackground()}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
          <PagesBar editor={editor.current} state={state} run={run} />
          <div className="workspace-bottom">
            <span>
              <MousePointer2 size={14} />
              {object
                ? "Drag to move · handles to resize"
                : "Select anything to make it yours"}
            </span>
            <div>
              <span className="page-label">
                PAGE{" "}
                {String(
                  Math.max(
                    1,
                    state.pages.findIndex((p) => p.id === state.activePageId) +
                      1,
                  ),
                ).padStart(2, "0")}{" "}
                <span>
                  / {String(state.pages.length || 1).padStart(2, "0")}
                </span>
              </span>
              <span className="bottom-divider" />
              <Tool
                label="Zoom out"
                disabled={!ready || state.busy}
                onClick={() => ed().zoomBy(0.8)}
              >
                <Minus size={13} />
              </Tool>
              <button
                className="zoom-button"
                onClick={() => ed().fit()}
                title="Fit canvas"
                aria-label="Fit canvas"
              >
                <Maximize2 size={14} />
                {Math.round(state.zoom * 100)}%
              </button>
              <Tool
                label="Zoom in"
                disabled={!ready || state.busy}
                onClick={() => ed().zoomBy(1.25)}
              >
                <Plus size={13} />
              </Tool>
            </div>
          </div>
        </main>
        <aside
          className={`properties ${properties ? "mobile-open" : ""}`}
          aria-label="Properties"
        >
          <div className="properties-title">
            <span>{object ? "Make it yours" : "Canvas settings"}</span>
            <SlidersHorizontal size={16} />
          </div>
          <div className="properties-scroll">
            <div className="selection-label">
              {object ? (
                <>
                  <span className="selection-symbol">
                    {textObject ? (
                      <Type size={19} />
                    ) : object instanceof FabricImage ? (
                      <ImagePlus size={19} />
                    ) : (
                      <Shapes size={19} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {textObject
                        ? "Text layer"
                        : object instanceof FabricImage
                          ? "Image layer"
                          : `${object.type} layer`}
                    </strong>
                    <small>Selected and ready to edit</small>
                  </div>
                </>
              ) : (
                <>
                  <span className="selection-symbol">
                    <LayoutTemplate size={19} />
                  </span>
                  <div>
                    <strong>Your canvas</strong>
                    <small>A little space for a big idea</small>
                  </div>
                </>
              )}
            </div>
            {object ? (
              <>
                <SelectionTools editor={ed()} state={state} run={run} />
                {textObject && (
                  <>
                    <h3 className="property-label">Typography</h3>
                    <label className="sr-only" htmlFor="text-content">
                      Text content
                    </label>
                    <textarea
                      id="text-content"
                      className="text-content"
                      maxLength={50000}
                      value={object.text}
                      onChange={(e) => change({ text: e.target.value })}
                    />
                    <select
                      aria-label="Font family"
                      value={object.fontFamily}
                      onChange={(e) => change({ fontFamily: e.target.value })}
                    >
                      {fonts.map((f) => (
                        <option key={f} value={f}>
                          {f.replace(" Variable", "")}
                        </option>
                      ))}
                    </select>
                    <div className="row">
                      <label className="number-field">
                        <span>Size</span>
                        <input
                          type="number"
                          aria-label="Font size"
                          min={4}
                          max={1200}
                          value={Math.round(object.fontSize)}
                          onChange={(e) => {
                            const v = +e.target.value;
                            if (v >= 4 && v <= 1200)
                              void change({ fontSize: v });
                          }}
                        />
                      </label>
                      <Tool
                        label="Bold"
                        onClick={() =>
                          change({
                            fontWeight:
                              Number(object.fontWeight) >= 600 ? 400 : 700,
                          })
                        }
                      >
                        <Bold size={17} />
                      </Tool>
                      <Tool
                        label="Italic"
                        onClick={() =>
                          change({
                            fontStyle:
                              object.fontStyle === "italic"
                                ? "normal"
                                : "italic",
                          })
                        }
                      >
                        <Italic size={17} />
                      </Tool>
                    </div>
                    <div className="segmented">
                      {[
                        { align: "left", icon: AlignLeft },
                        { align: "center", icon: AlignCenter },
                        { align: "right", icon: AlignRight },
                      ].map(({ align, icon: Icon }) => (
                        <button
                          key={align}
                          aria-label={`Align text ${align}`}
                          className={
                            object.textAlign === align ? "selected" : ""
                          }
                          onClick={() => change({ textAlign: align })}
                        >
                          <Icon size={16} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {!(object instanceof FabricImage) && (
                  <>
                    <h3 className="property-label">Color</h3>
                    <label className="color-field">
                      <input
                        type="color"
                        aria-label="Layer color"
                        value={color(selectionFill) ? selectionFill : "#20211f"}
                        onChange={(e) => change({ fill: e.target.value })}
                      />
                      <span>{String(selectionFill).toUpperCase()}</span>
                      <span className="muted">100%</span>
                    </label>
                    <div className="swatches compact">
                      {brand.colors.map((c, i) => (
                        <button
                          key={i}
                          style={{ background: c }}
                          aria-label={`Set layer color ${c}`}
                          onClick={() => change({ fill: c })}
                        />
                      ))}
                    </div>
                  </>
                )}
                {object instanceof FabricImage && (
                  <>
                    <ImageTools editor={ed()} image={object} />
                    <h3 className="property-label">Image tools</h3>
                    <button
                      className="ai-button full"
                      disabled={state.busy}
                      onClick={() =>
                        run(async () => {
                          try {
                            await ed().removeBackground(setTask);
                            notify(
                              "Background removed. Your original is one Undo away.",
                            );
                          } finally {
                            setTask("");
                          }
                        })
                      }
                    >
                      <WandSparkles size={17} /> Remove background{" "}
                      <span>FREE</span>
                    </button>
                    <p className="muted small">
                      On-device AI. First use downloads a model. Keep this tab
                      open while it works.
                    </p>
                  </>
                )}
                <h3 className="property-label">Position & size</h3>
                <div className="property-grid">
                  {[
                    { label: "X", key: "left", value: object.left },
                    { label: "Y", key: "top", value: object.top },
                    { label: "Rotate", key: "angle", value: object.angle },
                  ].map((f) => (
                    <label key={f.key} className="number-field">
                      <span>{f.label}</span>
                      <input
                        type="number"
                        aria-label={`Layer ${f.label}`}
                        value={Math.round(f.value)}
                        onChange={(e) => {
                          const n = +e.target.value;
                          if (Number.isFinite(n) && Math.abs(n) <= 100000)
                            void change({ [f.key]: n });
                        }}
                      />
                    </label>
                  ))}
                  <span className="size-readout">
                    {Math.round(object.getScaledWidth())} ×{" "}
                    {Math.round(object.getScaledHeight())}
                  </span>
                </div>
                <div className="segmented">
                  {[
                    { p: "left", icon: AlignLeft },
                    { p: "center", icon: AlignCenter },
                    { p: "right", icon: AlignRight },
                  ].map(({ p, icon: Icon }) => (
                    <button
                      key={p}
                      aria-label={`Position ${p} on canvas`}
                      onClick={() => ed().align(p as "left")}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
                <h3 className="property-label">
                  Opacity <span>{Math.round(selectionOpacity * 100)}%</span>
                </h3>
                <input
                  className="range"
                  type="range"
                  min="0"
                  max="100"
                  aria-label="Layer opacity"
                  value={Math.round(selectionOpacity * 100)}
                  onChange={(e) => change({ opacity: +e.target.value / 100 })}
                />
                <h3 className="property-label">Arrange</h3>
                <div className="row arrange">
                  <Tool label="Bring forward" onClick={() => ed().order(1)}>
                    <ArrowUp size={17} />
                  </Tool>
                  <Tool label="Send backward" onClick={() => ed().order(-1)}>
                    <ArrowDown size={17} />
                  </Tool>
                  <Tool
                    label="Duplicate layer"
                    onClick={() => run(() => ed().duplicate())}
                  >
                    <Copy size={17} />
                  </Tool>
                  <Tool label="Delete layer" onClick={() => ed().remove()}>
                    <Trash2 size={17} />
                  </Tool>
                </div>
                <button
                  className="secondary full deselect"
                  onClick={() => {
                    ed().canvas.discardActiveObject();
                    ed().canvas.requestRenderAll();
                    ed().emit();
                  }}
                >
                  Back to canvas settings
                </button>
              </>
            ) : (
              <>
                <label className="field">
                  <span>Page name</span>
                  <input
                    aria-label="Page name"
                    value={
                      state.pages.find((p) => p.id === state.activePageId)
                        ?.name || ""
                    }
                    maxLength={80}
                    disabled={!ready || state.busy}
                    onChange={(e) => ed().renamePage(e.target.value)}
                  />
                </label>
                <h3 className="property-label">Background</h3>
                <label className="color-field">
                  <input
                    type="color"
                    aria-label="Canvas background"
                    value={state.background}
                    disabled={!ready || state.busy}
                    onChange={(e) => ed().setBackground(e.target.value)}
                  />
                  <span>{state.background.toUpperCase()}</span>
                </label>
                <div className="swatches compact">
                  {swatches.map((c) => (
                    <button
                      key={c}
                      style={{ background: c }}
                      aria-label={`Set background ${c}`}
                      disabled={!ready || state.busy}
                      onClick={() => ed().setBackground(c)}
                    />
                  ))}
                </div>
                <h3 className="property-label">Canvas size</h3>
                <div className="dimension-card">
                  <div>
                    <span>Width</span>
                    <strong>
                      {state.width}
                      <small> px</small>
                    </strong>
                  </div>
                  <X size={12} />
                  <div>
                    <span>Height</span>
                    <strong>
                      {state.height}
                      <small> px</small>
                    </strong>
                  </div>
                </div>
                <button
                  className="secondary full"
                  onClick={openResize}
                  disabled={!ready || state.busy}
                >
                  <Expand size={15} /> Resize design
                </button>
                <div className="canvas-tip">
                  <span>✳</span>
                  <strong>
                    Good things start
                    <br />
                    with a blank canvas.
                  </strong>
                  <p>
                    Choose a template or add your own text, shapes and photos.
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="properties-bottom">
            <LockKeyholeOpen size={16} />
            <div>
              <strong>All the tools. All yours.</strong>
              <span>No watermarks. No subscriptions.</span>
            </div>
          </div>
        </aside>
      </div>
      <input
        type="file"
        ref={uploadRef}
        className="hidden"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={logoRef}
        className="hidden"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void run(async () => {
              await updateBrand({ ...brand, logo: await imageData(file) });
            });
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={projectRef}
        className="hidden"
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void run(async () => {
              if (file.size > 25 * 1024 * 1024)
                throw Error("Project files must be smaller than 25 MB.");
              await ed().openDocument(JSON.parse(await file.text()), true);
              notify(
                "Project opened. Your previous design is saved in Projects.",
              );
            });
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "resize" && (
        <Modal title="A new size. Same good idea." close={() => setModal(null)}>
          <p className="dialog-description">
            Choose a format or make a size of your own.
          </p>
          <div className="preset-sizes">
            {[
              { name: "Square post", w: 1080, h: 1080 },
              { name: "Story", w: 1080, h: 1920 },
              { name: "Landscape", w: 1920, h: 1080 },
              { name: "A4 poster", w: 2480, h: 3508 },
            ].map((s) => (
              <button
                key={s.name}
                className={
                  resizeWidth === s.w && resizeHeight === s.h ? "active" : ""
                }
                onClick={() => {
                  setResizeWidth(s.w);
                  setResizeHeight(s.h);
                }}
              >
                <span>{s.name}</span>
                <small>
                  {s.w} × {s.h}
                </small>
              </button>
            ))}
          </div>
          <div className="row">
            <label className="field">
              Width (px)
              <input
                type="number"
                min="100"
                max="6000"
                value={resizeWidth}
                onChange={(e) => setResizeWidth(+e.target.value)}
              />
            </label>
            <span className="times">×</span>
            <label className="field">
              Height (px)
              <input
                type="number"
                min="100"
                max="6000"
                value={resizeHeight}
                onChange={(e) => setResizeHeight(+e.target.value)}
              />
            </label>
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={scaleContent}
              onChange={(e) => setScaleContent(e.target.checked)}
            />
            <span>
              Scale and center the artwork to fit
              <small>
                Preserves proportions. You can adjust the layout afterwards.
              </small>
            </span>
          </label>
          <button
            className="primary full"
            disabled={!dimension(resizeWidth) || !dimension(resizeHeight)}
            onClick={() =>
              run(() => {
                ed().resize(resizeWidth, resizeHeight, scaleContent);
                setModal(null);
              })
            }
          >
            <Expand size={16} /> Resize canvas
          </button>
          <p className="dialog-footnote">
            100–6,000 px per side · Your previous size is one Undo away.
          </p>
        </Modal>
      )}
      {cloudLoaded && ready && (
        <ModalHost visible={modal === "cloud"} close={() => setModal(null)}>
          <Suspense fallback={<p>Loading cloud library…</p>}>
            <CloudStudio
              editor={ed()}
              visible={modal === "cloud"}
              notify={notify}
              onStatus={setCloudStatus}
            />
          </Suspense>
        </ModalHost>
      )}
      {modal === "motion" && (
        <Modal title="Animate your story" close={() => setModal(null)}>
          <Suspense fallback={<p>Loading motion studio…</p>}>
            <MotionStudio editor={ed()} notify={notify} />
          </Suspense>
        </Modal>
      )}
      {modal === "export" && (
        <Modal
          title="Made by you. Ready for the world."
          close={() => {
            if (!task) setModal(null);
          }}
        >
          <p className="dialog-description">
            No watermarks. No upgrade button. Just your design.
          </p>
          <button className="secondary full" onClick={() => setModal("motion")}>
            Create an animated video instead
          </button>
          <label className="field">
            File type
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
            >
              <option value="png">PNG — crisp, high-quality image</option>
              <option value="jpeg">JPEG — smaller photo file</option>
              <option value="svg">SVG — scalable artwork</option>
              <option value="pdf">PDF — raster document</option>
              <option value="json">OpenRang project — keep it editable</option>
            </select>
          </label>
          {(format === "png" || format === "jpeg" || format === "pdf") && (
            <label className="field">
              Export resolution
              <select
                value={exportScale}
                onChange={(e) => setExportScale(+e.target.value)}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}× · {state.width * n} × {state.height * n} px
                  </option>
                ))}
              </select>
            </label>
          )}
          {(format === "png" || format === "svg") && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              <span>
                Transparent background <span className="free-tag">FREE</span>
                <small>Exports without the canvas background.</small>
              </span>
            </label>
          )}
          {format === "pdf" && state.pages.length > 1 && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={allPages}
                onChange={(e) => setAllPages(e.target.checked)}
              />
              <span>
                Export all {state.pages.length} pages
                <small>Each page keeps its own size.</small>
              </span>
            </label>
          )}
          {format === "pdf" && (
            <p className="muted small">
              PDF contains a raster page in RGB. Professional CMYK, bleed and
              editable PDF text are not supported.
            </p>
          )}
          {format === "svg" && (
            <p className="muted small">
              SVG text uses font names. Install the same fonts on the device
              where you open it.
            </p>
          )}
          {format === "json" && (
            <p className="muted small">
              Includes your text, layers and embedded images. Open it again
              using the folder button. Brand kit is saved separately.
            </p>
          )}
          <div className="export-summary">
            <Check size={18} />
            <span>
              {format === "json"
                ? "All your editable layers"
                : `${state.width} × ${state.height} px design`}
              <small>Yours to keep, share and make your own.</small>
            </span>
          </div>
          <button
            className="primary full"
            disabled={!!task}
            onClick={() => void exportFile()}
          >
            <Download size={17} />
            {task
              ? "Preparing…"
              : format === "json"
                ? "Download project"
                : "Download design"}
          </button>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="A little more freedom to create."
          close={() => setModal(null)}
        >
          <p className="dialog-description">
            OpenRang is a free, open-source design studio. Start with a
            template, make it yours, and export without a watermark.
          </p>
          <div className="help-grid">
            <span>Undo / redo</span>
            <kbd>Ctrl/⌘ Z · Shift Z</kbd>
            <span>Duplicate a layer</span>
            <kbd>Ctrl/⌘ D</kbd>
            <span>Copy / paste layers</span>
            <kbd>Ctrl/⌘ C · V</kbd>
            <span>Group / ungroup</span>
            <kbd>Ctrl/⌘ G · Shift G</kbd>
            <span>Nudge selected</span>
            <kbd>Arrows · Shift = 10 px</kbd>
            <span>Delete selected</span>
            <kbd>Delete</kbd>
            <span>Edit text</span>
            <kbd>Double-click</kbd>
            <span>Deselect</span>
            <kbd>Escape</kbd>
          </div>
          <a
            className="secondary full"
            href="https://github.com/7se7en72025/openrang"
            target="_blank"
            rel="noreferrer"
          >
            View the source on GitHub <ArrowRight size={15} />
          </a>
          <div className="tip-card">
            <h3>Local by default. Cloud when you choose.</h3>
            <p>
              Your designs and brand kit autosave in this browser. Clearing
              browser data removes them. Download editable project backups for
              anything you want to keep.
            </p>
            <p>
              Use Cloud and team for optional signed-in cloud saves and editor
              invites. Animate and video turns your pages into a short, silent
              video.
            </p>
            <p>
              Background removal downloads an AI model from IMG.LY; image
              processing runs locally, in a cancellable background worker. Each
              project supports up to 20 pages.
            </p>
          </div>
          <button className="primary full" onClick={() => setModal(null)}>
            Let’s make something <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </div>
  );
}
