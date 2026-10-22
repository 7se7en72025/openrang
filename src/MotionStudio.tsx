import { useEffect, useRef, useState } from "react";
import type { Editor } from "./editor";
import type { DesignPage } from "./project";
import { download } from "./project";
import { motionPlan } from "./motion";
import { renderVideo } from "./video";

export default function MotionStudio({
  editor,
  notify,
}: {
  editor: Editor;
  notify: (message: string) => void;
}) {
  const page = editor
    .document()
    .pages.find((p) => p.id === editor.activePageId)!;
  const [motion, setMotion] = useState<NonNullable<DesignPage["motion"]>>(
    page.motion ?? { duration: 3, effect: "fade" },
  );
  const [all, setAll] = useState(true),
    [task, setTask] = useState(""),
    [url, setUrl] = useState("");
  const controller = useRef<AbortController | null>(null),
    blob = useRef<Blob | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const update = (value: typeof motion) => {
    setMotion(value);
    editor.setMotion(value);
    setUrl("");
    blob.current = null;
  };
  const create = async () => {
    controller.current = new AbortController();
    setTask("Preparing…");
    setUrl("");
    blob.current = null;
    try {
      blob.current = await renderVideo(
        editor.document(),
        all,
        controller.current.signal,
        setTask,
      );
      setUrl(URL.createObjectURL(blob.current));
    } catch (error) {
      notify((error as Error).message);
    } finally {
      controller.current = null;
      setTask("");
    }
  };
  let summary = "";
  try {
    const p = motionPlan(editor.document(), all);
    summary = `${p.duration}s · ${p.width} × ${p.height} px · ${p.pages.length} page(s)`;
  } catch (e) {
    summary = (e as Error).message;
  }
  return (
    <div className="motion-studio">
      <p className="dialog-description">
        Turn your designs into a short video. Page order becomes your
        storyboard.
      </p>
      <label className="field">
        Current page animation
        <select
          value={motion.effect}
          disabled={!!task}
          onChange={(e) =>
            update({
              ...motion,
              effect: e.target.value as typeof motion.effect,
            })
          }
        >
          <option value="none">Still</option>
          <option value="fade">Fade in</option>
          <option value="slide">Rise up</option>
          <option value="zoom">Slow zoom</option>
        </select>
      </label>
      <label className="field">
        Page duration (seconds)
        <input
          type="number"
          min="1"
          max="15"
          step="0.5"
          value={motion.duration}
          disabled={!!task}
          onChange={(e) => {
            const duration = +e.target.value;
            if (duration >= 1 && duration <= 15)
              update({ ...motion, duration });
          }}
        />
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          checked={all}
          disabled={!!task}
          onChange={(e) => {
            setAll(e.target.checked);
            setUrl("");
            blob.current = null;
          }}
        />
        <span>Include every page</span>
      </label>
      <p className="muted small">{summary}</p>
      <p className="muted small">
        Records in real time. Keep this tab visible. Silent video, up to 60
        seconds and 1080p area; WebM or MP4 depends on your browser.
      </p>
      {url && (
        <video
          className="video-preview"
          aria-label="Animation preview"
          src={url}
          controls
          playsInline
        />
      )}
      {task ? (
        <>
          <p role="status">{task}</p>
          <button
            className="secondary full"
            onClick={() => controller.current?.abort()}
          >
            Cancel recording
          </button>
        </>
      ) : (
        <button className="primary full" onClick={() => void create()}>
          Create video preview
        </button>
      )}
      {url && (
        <button
          className="secondary full"
          onClick={() => {
            if (blob.current)
              download(
                blob.current,
                (editor.title.replace(/[^\w -]/g, "").slice(0, 80) ||
                  "openrang") +
                  (blob.current.type.startsWith("video/mp4")
                    ? ".mp4"
                    : ".webm"),
              );
          }}
        >
          Download video
        </button>
      )}
    </div>
  );
}
