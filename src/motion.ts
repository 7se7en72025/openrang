import type { DesignDocument, DesignPage } from "./project";
export function motionPlan(doc: DesignDocument, all: boolean) {
  const pages = all
    ? doc.pages
    : doc.pages.filter((p) => p.id === doc.activePageId);
  const duration = pages.reduce((n, p) => n + (p.motion?.duration ?? 3), 0);
  if (duration > 60)
    throw Error(
      "Keep a video within 60 seconds. Shorten pages or export the current page.",
    );
  const first = pages[0],
    scale = Math.min(
      1,
      1920 / first.width,
      1920 / first.height,
      Math.sqrt(2073600 / (first.width * first.height)),
    );
  return {
    pages,
    duration,
    width: Math.max(2, Math.floor((first.width * scale) / 2) * 2),
    height: Math.max(2, Math.floor((first.height * scale) / 2) * 2),
  };
}
export function motionFrame(
  effect: NonNullable<DesignPage["motion"]>["effect"],
  elapsed: number,
) {
  const progress = Math.min(1, Math.max(0, elapsed / 0.6)),
    ease = 1 - (1 - progress) ** 3;
  return {
    alpha: effect === "fade" ? ease : 1,
    y: effect === "slide" ? (1 - ease) * 0.25 : 0,
    scale: effect === "zoom" ? 1 + (1 - ease) * 0.12 : 1,
  };
}
