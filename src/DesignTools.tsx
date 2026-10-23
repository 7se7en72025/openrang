import { useEffect, useRef, useState } from "react";
import { Textbox, type FabricObject, FabricImage, Group } from "fabric";
import type { Editor } from "./editor";
import { readFont } from "./fonts";
import { type Brand, imageData } from "./project";
import { graphics } from "./graphics";
import {
  listAssets,
  saveAsset,
  readAsset,
  removeAsset,
  imageThumbnail,
  type LibraryAsset,
} from "./assets";

export function FontTools({
  editor,
  brand,
  updateBrand,
  notify,
}: {
  editor: Editor;
  brand: Brand;
  updateBrand: (brand: Brand) => Promise<boolean>;
  notify: (s: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="design-tool-section">
      <h3 className="mini-heading">Your custom fonts</h3>
      <p className="muted small">
        WOFF2, WOFF, TTF or OTF · 2 MB per file. Upload fonts you have
        permission to use and share.
      </p>
      <button
        className="secondary full"
        disabled={busy || editor.busy}
        onClick={() => input.current?.click()}
      >
        Upload font
      </button>
      <input
        ref={input}
        type="file"
        aria-label="Upload custom font"
        accept=".woff2,.woff,.ttf,.otf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            void run(async () => {
              const font = await readFont(file);
              await editor.useFont(font);
              try {
                await saveAsset({
                  kind: "font",
                  name: font.name,
                  thumbnail: "",
                  data: font,
                });
                notify("Font added to the project and asset library.");
              } catch {
                notify(
                  "Font is embedded in this project. The asset library could not be saved.",
                );
              }
            });
        }}
      />
      {editor.fonts.map((font) => (
        <div className="font-library-row" key={font.family}>
          <button
            className="secondary"
            disabled={busy || editor.busy}
            style={{ fontFamily: font.family }}
            onClick={() => void run(() => editor.useFont(font))}
          >
            {font.name}
          </button>
          <button
            className="text-link"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const next = [
                  ...(brand.fonts ?? []).filter(
                    (f) => f.family !== font.family,
                  ),
                  font,
                ];
                if (
                  await updateBrand({
                    ...brand,
                    font: font.family,
                    fonts: next,
                  })
                )
                  notify("Custom font saved in your brand kit.");
              })
            }
          >
            Save in brand kit
          </button>
          <button
            className="text-link"
            aria-label={`Remove ${font.name} from project`}
            disabled={busy || editor.busy}
            onClick={() => void run(async () => editor.removeFont(font.family))}
          >
            Remove from project
          </button>
        </div>
      ))}
      <p className="muted small">
        Custom font files travel with your editable project and SVG. Saved
        library fonts are available under Assets.
      </p>
    </section>
  );
}

export function EffectTools({
  editor,
  object,
  run,
}: {
  editor: Editor;
  object: FabricObject;
  run: (fn: () => void | Promise<void>) => unknown;
}) {
  const change = (value: Record<string, unknown>) =>
    void run(() => editor.change(value));
  const text = object instanceof Textbox,
    shadow = object.shadow;
  return (
    <section className="design-tool-section">
      <h3 className="property-label">Effects & spacing</h3>
      {text && (
        <>
          <div className="row">
            <label className="number-field">
              <span>Letter spacing</span>
              <input
                aria-label="Letter spacing"
                type="number"
                min="-200"
                max="2000"
                value={object.charSpacing}
                onChange={(e) => {
                  const n = +e.target.value;
                  if (n >= -200 && n <= 2000) change({ charSpacing: n });
                }}
              />
            </label>
            <label className="number-field">
              <span>Line height</span>
              <input
                aria-label="Line height"
                type="number"
                min="0.5"
                max="4"
                step="0.1"
                value={object.lineHeight}
                onChange={(e) => {
                  const n = +e.target.value;
                  if (n >= 0.5 && n <= 4) change({ lineHeight: n });
                }}
              />
            </label>
          </div>
          <div className="row">
            <button
              className="secondary"
              aria-pressed={object.underline}
              onClick={() => change({ underline: !object.underline })}
            >
              Underline
            </button>
            <button
              className="secondary"
              aria-pressed={object.linethrough}
              onClick={() => change({ linethrough: !object.linethrough })}
            >
              Strikethrough
            </button>
          </div>
        </>
      )}
      {!(object instanceof FabricImage) && !(object instanceof Group) && (
        <>
          <label className="field">
            Outline width
            <input
              aria-label="Outline width"
              type="range"
              min="0"
              max="30"
              value={object.stroke ? object.strokeWidth : 0}
              onChange={(e) =>
                change({
                  stroke: object.stroke || "#20211f",
                  strokeWidth: +e.target.value,
                  paintFirst: "stroke",
                })
              }
            />
          </label>
          <label className="field">
            Outline color
            <input
              aria-label="Outline color"
              type="color"
              value={
                typeof object.stroke === "string" &&
                /^#[a-f0-9]{6}$/i.test(object.stroke)
                  ? object.stroke
                  : "#20211f"
              }
              onChange={(e) =>
                change({
                  stroke: e.target.value,
                  strokeWidth: object.strokeWidth || 2,
                  paintFirst: "stroke",
                })
              }
            />
          </label>
        </>
      )}
      <label className="check-field">
        <input
          type="checkbox"
          aria-label="Drop shadow"
          checked={!!shadow}
          onChange={(e) =>
            change({
              shadow: e.target.checked
                ? { color: "#20211f", blur: 12, offsetX: 6, offsetY: 6 }
                : null,
            })
          }
        />
        <span>Drop shadow</span>
      </label>
      {shadow && (
        <>
          <label className="field">
            Shadow color
            <input
              aria-label="Shadow color"
              type="color"
              value={shadow.color}
              onChange={(e) =>
                change({
                  shadow: { ...shadow.toObject(), color: e.target.value },
                })
              }
            />
          </label>
          {(["blur", "offsetX", "offsetY"] as const).map((key) => (
            <label className="field" key={key}>
              {
                {
                  blur: "Shadow blur",
                  offsetX: "Shadow X",
                  offsetY: "Shadow Y",
                }[key]
              }
              <input
                aria-label={
                  {
                    blur: "Shadow blur",
                    offsetX: "Shadow X",
                    offsetY: "Shadow Y",
                  }[key]
                }
                type="range"
                min={key === "blur" ? 0 : -100}
                max="100"
                value={shadow[key]}
                onChange={(e) =>
                  change({
                    shadow: { ...shadow.toObject(), [key]: +e.target.value },
                  })
                }
              />
            </label>
          ))}
        </>
      )}
      <button
        className="text-link"
        onClick={() =>
          change({
            shadow: null,
            stroke: null,
            strokeWidth: 0,
            ...(text
              ? {
                  underline: false,
                  linethrough: false,
                  charSpacing: 0,
                  lineHeight: 1.16,
                }
              : {}),
          })
        }
      >
        Reset effects
      </button>
    </section>
  );
}

export function AssetLibrary({
  editor,
  notify,
}: {
  editor: Editor;
  notify: (s: string) => void;
}) {
  const [items, setItems] = useState<Omit<LibraryAsset, "data">[]>([]),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const refresh = async () => setItems(await listAssets());
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run(refresh);
  }, []);
  const add = async (id: string) => {
    const asset = await readAsset(id);
    if (asset.kind === "image") await editor.addImage(asset.data as string);
    else await editor.useFont(asset.data as import("./font-data").EmbeddedFont);
  };
  return (
    <>
      <h3 className="mini-heading">Original editable graphics</h3>
      <div className="graphics-grid">
        {graphics.map((g) => (
          <button
            className="secondary"
            key={g.id}
            disabled={busy || editor.busy}
            aria-label={`Add ${g.name} graphic`}
            onClick={() =>
              void run(async () => {
                editor.addGraphic(g.id);
              })
            }
          >
            <span aria-hidden="true">{g.icon}</span>
            {g.name}
          </button>
        ))}
      </div>
      <h3 className="mini-heading">Your reusable library</h3>
      <p className="muted small">
        Your reusable photos and fonts, stored on this device. Projects keep
        their own embedded copies.
      </p>
      <button
        className="primary full"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        Upload to asset library
      </button>
      <input
        className="hidden"
        ref={input}
        aria-label="Upload library photo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            void run(async () => {
              const src = await imageData(file);
              await saveAsset({
                kind: "image",
                name: file.name.slice(0, 80),
                data: src,
                thumbnail: await imageThumbnail(src),
              });
              notify("Photo saved in your asset library.");
            });
        }}
      />
      <button
        className="secondary full"
        disabled={
          busy || !(editor.canvas.getActiveObject() instanceof FabricImage)
        }
        onClick={() =>
          void run(async () => {
            const image = editor.canvas.getActiveObject();
            if (!(image instanceof FabricImage)) return;
            const src = image.getSrc();
            await saveAsset({
              kind: "image",
              name: "Saved photo " + (items.length + 1),
              data: src,
              thumbnail: await imageThumbnail(src),
            });
            notify("Selected photo saved to your library.");
          })
        }
      >
        Save selected image to library
      </button>
      <label className="search">
        <input
          aria-label="Search asset library"
          placeholder="Search photos and fonts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label className="field">
        Asset type
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">All assets</option>
          <option value="image">Photos</option>
          <option value="font">Fonts</option>
        </select>
      </label>
      <div className="asset-library-grid">
        {items
          .filter(
            (a) =>
              (kind === "all" || a.kind === kind) &&
              a.name.toLowerCase().includes(query.toLowerCase()),
          )
          .map((a) => (
            <article className="asset-library-card" key={a.id}>
              <button
                className="asset-use"
                aria-label={`Add ${a.name} to design`}
                disabled={busy || editor.busy}
                onClick={() => void run(() => add(a.id))}
              >
                {a.kind === "image" ? (
                  <img src={a.thumbnail} alt="" loading="lazy" />
                ) : (
                  <span className="font-tile">Aa</span>
                )}
                <strong>{a.name}</strong>
                <small>{a.kind === "font" ? "Custom font" : "Photo"}</small>
              </button>
              <button
                className="text-link"
                aria-label={`Remove ${a.name} from library`}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await removeAsset(a.id);
                    notify(
                      "Removed from the library. Existing designs keep their copy.",
                    );
                  })
                }
              >
                Remove from library
              </button>
            </article>
          ))}
      </div>
      {!items.length && (
        <p className="empty">
          Upload a photo or custom font to start your library.
        </p>
      )}
      <p className="muted small">
        Up to 40 assets / 64 MB. Removing an item keeps existing designs intact.
        Download projects and brand-kit backups before clearing browser storage.
      </p>
    </>
  );
}
