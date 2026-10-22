import { Rect, Circle, Textbox, Polygon, type FabricObject } from "fabric";
import type { Project } from "./project";

export const templates = [
  {
    id: "good",
    name: "Good things",
    category: "Social",
    bg: "#f7f1df",
    ink: "#173e33",
    accent: "#3155e7",
    headline: "MAKE\nGOOD\nTHINGS.",
    eyebrow: "A LITTLE MORE FREEDOM TO CREATE",
    footer: "An idea is a pretty good place to start.",
    label: "Made to make.",
    family: "Space Grotesk Variable",
  },
  {
    id: "bloom",
    name: "In full bloom",
    category: "Social",
    bg: "#d8b8e9",
    ink: "#33243c",
    accent: "#f85c3a",
    headline: "IN FULL\nBLOOM.",
    eyebrow: "A NEW SEASON OF POSSIBILITIES",
    footer: "Grow at your own pace. Always.",
    label: "Keep growing.",
    family: "Georgia",
  },
  {
    id: "night",
    name: "After hours",
    category: "Event",
    bg: "#20211f",
    ink: "#f7f1df",
    accent: "#d8b8e9",
    headline: "AFTER\nHOURS.",
    eyebrow: "THE GOOD COMPANY CLUB PRESENTS",
    footer: "FRIDAY / 8 PM / YOUR FAVOURITE PLACE",
    label: "Stay a little.",
    family: "Space Grotesk Variable",
  },
  {
    id: "studio",
    name: "Studio notes",
    category: "Social",
    bg: "#3155e7",
    ink: "#ffffff",
    accent: "#f6ce55",
    headline: "IDEAS\nIN THE\nMAKING.",
    eyebrow: "NOTES FROM THE STUDIO / VOL. 01",
    footer: "Less waiting. More creating.",
    label: "Work in play.",
    family: "Space Grotesk Variable",
  },
  {
    id: "coffee",
    name: "Slow mornings",
    category: "Business",
    bg: "#e9d1b2",
    ink: "#593a29",
    accent: "#f85c3a",
    headline: "Good days\nstart slow.",
    eyebrow: "THE CORNER COFFEE HOUSE",
    footer: "Fresh coffee. Familiar faces. Every day.",
    label: "Take a sip.",
    family: "Georgia",
  },
  {
    id: "sale",
    name: "The good sale",
    category: "Business",
    bg: "#f85c3a",
    ink: "#f7f1df",
    accent: "#173e33",
    headline: "BIG\nLITTLE\nFINDS.",
    eyebrow: "YOUR NEW FAVOURITES ARE HERE",
    footer: "The weekend edit. Up to 40% off.",
    label: "Oh, hello.",
    family: "Space Grotesk Variable",
  },
  {
    id: "earth",
    name: "Outside club",
    category: "Event",
    bg: "#173e33",
    ink: "#f6ce55",
    accent: "#f7f1df",
    headline: "GO GET\nA LITTLE\nLOST.",
    eyebrow: "THE OUTSIDE CLUB / SATURDAY WALKS",
    footer: "Find your people. Take the scenic route.",
    label: "See you out.",
    family: "Space Grotesk Variable",
  },
  {
    id: "blank",
    name: "A fresh canvas",
    category: "Blank",
    bg: "#ffffff",
    ink: "#20211f",
    accent: "#f85c3a",
    headline: "Your next\nbig idea.",
    eyebrow: "START SOMETHING",
    footer: "",
    label: "",
    family: "Space Grotesk Variable",
  },
];
export function templateProject(id: string): Project {
  const t = templates.find((x) => x.id === id) ?? templates[0];
  const objects: FabricObject[] = [];
  if (id !== "blank") {
    objects.push(
      new Textbox(t.eyebrow, {
        left: 70,
        top: 65,
        width: 900,
        fontSize: 19,
        fontFamily: "Inter Variable",
        fontWeight: 600,
        charSpacing: 100,
        fill: t.ink,
      }),
    );
    objects.push(
      new Rect({
        left: 70,
        top: 119,
        width: 940,
        height: 2,
        fill: t.ink,
        opacity: 0.35,
      }),
    );
    objects.push(
      new Textbox(t.headline, {
        left: 65,
        top: 185,
        width: 960,
        fontSize: 145,
        fontFamily: t.family,
        fontWeight: t.family === "Georgia" ? 400 : 700,
        lineHeight: 0.92,
        charSpacing: -55,
        fill: t.ink,
      }),
    );
    const points = Array.from({ length: 32 }, (_, i) => {
      const a = (i * Math.PI) / 16,
        r = i % 2 ? 100 : 135;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
    objects.push(
      new Polygon(points, { left: 744, top: 680, fill: t.accent, angle: 8 }),
    );
    objects.push(
      new Textbox(t.label, {
        left: 786,
        top: 776,
        width: 182,
        fontSize: 30,
        fontFamily: "Georgia",
        fontStyle: "italic",
        textAlign: "center",
        angle: 8,
        fill: t.bg,
      }),
    );
    objects.push(
      new Circle({ left: 74, top: 867, radius: 23, fill: t.accent }),
    );
    objects.push(
      new Textbox(t.footer, {
        left: 70,
        top: 974,
        width: 900,
        fontSize: 22,
        fontFamily: "Inter Variable",
        fill: t.ink,
      }),
    );
  }
  return {
    schemaVersion: 1,
    title: t.name,
    width: 1080,
    height: 1080,
    background: t.bg,
    scene: { objects: objects.map((o) => o.toObject()) },
  };
}
