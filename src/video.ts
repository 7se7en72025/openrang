import { StaticCanvas } from "fabric";
import type { DesignDocument } from "./project";
import { motionPlan, motionFrame } from "./motion";

export async function renderVideo(
  doc: DesignDocument,
  all: boolean,
  signal: AbortSignal,
  progress: (value: string) => void,
): Promise<Blob> {
  const mime =
    typeof MediaRecorder !== "undefined" &&
    ["video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
  if (!mime || !HTMLCanvasElement.prototype.captureStream)
    throw Error(
      "This browser cannot record canvas video. Try current Chrome or Firefox.",
    );
  const plan = motionPlan(doc, all),
    canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext("2d")!;
  const scene = new StaticCanvas(undefined, {
    width: plan.width,
    height: plan.height,
    renderOnAddRemove: false,
    enableRetinaScaling: false,
  });
  let stream: MediaStream;
  let recorder: MediaRecorder;
  try {
    stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 6000000,
    });
  } catch {
    stream!?.getTracks().forEach((track) => track.stop());
    await scene.dispose();
    canvas.width = canvas.height = 0;
    throw Error(
      "The browser could not start its video encoder. Try a smaller design or another browser.",
    );
  }
  const chunks: Blob[] = [];
  let recordingError: Error | undefined;
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onerror = () => {
    recordingError = Error(
      "The browser video encoder stopped. Try a smaller design.",
    );
  };
  const finished = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  const check = () => {
    if (signal.aborted)
      throw Error("Video cancelled. Your design is unchanged.");
    if (document.hidden)
      throw Error("Keep this tab visible while recording. Please try again.");
    if (recordingError) throw recordingError;
  };
  let elapsedTotal = 0;
  try {
    for (let i = 0; i < plan.pages.length; i++) {
      check();
      const page = plan.pages[i],
        duration = page.motion?.duration ?? 3;
      progress(`Preparing page ${i + 1} of ${plan.pages.length}…`);
      await scene.loadFromJSON(page.scene);
      check();
      const scale = Math.min(
        plan.width / page.width,
        plan.height / page.height,
      );
      scene.setViewportTransform([
        scale,
        0,
        0,
        scale,
        (plan.width - page.width * scale) / 2,
        (plan.height - page.height * scale) / 2,
      ]);
      scene.backgroundColor = page.background;
      scene.renderAll();
      const image = scene.getElement();
      const draw = (elapsed: number) => {
        const frame = motionFrame(page.motion?.effect ?? "fade", elapsed);
        ctx.globalAlpha = 1;
        ctx.fillStyle = page.background;
        ctx.fillRect(0, 0, plan.width, plan.height);
        ctx.save();
        ctx.globalAlpha = frame.alpha;
        ctx.translate(plan.width / 2, plan.height / 2 + frame.y * plan.height);
        ctx.scale(frame.scale, frame.scale);
        ctx.drawImage(image, -plan.width / 2, -plan.height / 2);
        ctx.restore();
      };
      draw(0);
      if (recorder.state === "inactive") recorder.start(250);
      else recorder.resume();
      const start = performance.now();
      while (true) {
        check();
        const elapsed = (performance.now() - start) / 1000;
        draw(Math.min(elapsed, duration));
        progress(
          `Recording ${Math.min(plan.duration, elapsedTotal + elapsed).toFixed(1)} / ${plan.duration}s`,
        );
        if (elapsed >= duration) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 1000 / 30));
      }
      elapsedTotal += duration;
      recorder.pause();
    }
    recorder.stop();
    await finished;
    if (!chunks.length)
      throw Error("The browser produced an empty video. Try again.");
    return new Blob(chunks, { type: recorder.mimeType });
  } finally {
    if (recorder.state !== "inactive") {
      recorder.stop();
      await finished;
    }
    stream.getTracks().forEach((track) => track.stop());
    await scene.dispose();
    canvas.width = canvas.height = 0;
  }
}
