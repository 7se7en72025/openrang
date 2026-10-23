import { Rect, Circle, Textbox, Polygon, type FabricObject } from "fabric";
import type { Project } from "./project";

export interface Template {
  id: string;
  name: string;
  category: string;
  bg: string;
  ink: string;
  accent: string;
  headline: string;
  eyebrow: string;
  footer: string;
  label: string;
  family: string;
  width?: number;
  height?: number;
  layout?:
    "story" | "thumbnail" | "slide" | "card" | "menu" | "resume" | "letter";
}
export const templates: Template[] = [
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
templates.push(
  {
    id: "product-story",
    name: "Product story",
    category: "Social",
    bg: "#173e33",
    ink: "#f7f1df",
    accent: "#f6ce55",
    headline: "YOUR NEXT\nFAVOURITE.",
    eyebrow: "THE WEEKEND EDIT",
    footer: "Made for your everyday.",
    label: "SHOP THE DROP",
    family: "Space Grotesk Variable",
    width: 1080,
    height: 1920,
    layout: "story",
  },
  {
    id: "event-story",
    name: "Event reminder",
    category: "Event",
    bg: "#d8b8e9",
    ink: "#33243c",
    accent: "#f85c3a",
    headline: "GOOD PEOPLE.\nGREAT NIGHT.",
    eyebrow: "YOU'RE INVITED",
    footer: "Saturday · 7 PM · Studio 04",
    label: "SAVE YOUR SPOT",
    family: "Space Grotesk Variable",
    width: 1080,
    height: 1920,
    layout: "story",
  },
  {
    id: "tutorial-thumb",
    name: "Tutorial thumbnail",
    category: "Social",
    bg: "#3155e7",
    ink: "#ffffff",
    accent: "#f6ce55",
    headline: "MAKE IT\nIN MINUTES.",
    eyebrow: "A PRACTICAL GUIDE",
    footer: "Your channel · New episode",
    label: "HOW TO",
    family: "Space Grotesk Variable",
    width: 1280,
    height: 720,
    layout: "thumbnail",
  },
  {
    id: "launch-thumb",
    name: "Product launch",
    category: "Social",
    bg: "#20211f",
    ink: "#f7f1df",
    accent: "#f85c3a",
    headline: "SMALL IDEA.\nBIG LAUNCH.",
    eyebrow: "BEHIND THE BUILD",
    footer: "From sketch to something real.",
    label: "NEW",
    family: "Space Grotesk Variable",
    width: 1280,
    height: 720,
    layout: "thumbnail",
  },
  {
    id: "pitch-cover",
    name: "Pitch deck cover",
    category: "Slides",
    bg: "#f7f1df",
    ink: "#173e33",
    accent: "#3155e7",
    headline: "A BETTER\nWAY FORWARD.",
    eyebrow: "YOUR STUDIO / 2026",
    footer: "A clear idea. A considered plan.",
    label: "01",
    family: "Space Grotesk Variable",
    width: 1920,
    height: 1080,
    layout: "slide",
  },
  {
    id: "webinar-slide",
    name: "Webinar slide",
    category: "Slides",
    bg: "#d8b8e9",
    ink: "#33243c",
    accent: "#f85c3a",
    headline: "LET'S MAKE\nSOMETHING GOOD.",
    eyebrow: "A LIVE CREATIVE SESSION",
    footer: "Your name · Designer & maker",
    label: "LIVE",
    family: "Space Grotesk Variable",
    width: 1920,
    height: 1080,
    layout: "slide",
  },
  {
    id: "studio-card",
    name: "Studio business card",
    category: "Business",
    bg: "#173e33",
    ink: "#f7f1df",
    accent: "#f6ce55",
    headline: "YOUR\nSTUDIO.",
    eyebrow: "DESIGN & GOOD IDEAS",
    footer: "hello@example.com\n+91 90000 00000",
    label: "YOUR NAME / DESIGNER",
    family: "Space Grotesk Variable",
    width: 1050,
    height: 600,
    layout: "card",
  },
  {
    id: "booking-card",
    name: "Booking card",
    category: "Business",
    bg: "#e9d1b2",
    ink: "#593a29",
    accent: "#f85c3a",
    headline: "SEE YOU\nSOON.",
    eyebrow: "A LITTLE TIME FOR YOURSELF",
    footer: "Date: __________\nTime: __________",
    label: "YOUR LOCAL STUDIO",
    family: "Georgia",
    width: 1050,
    height: 600,
    layout: "card",
  },
  {
    id: "cafe-menu",
    name: "Cafe menu",
    category: "Business",
    bg: "#f7f1df",
    ink: "#593a29",
    accent: "#f85c3a",
    headline: "The daily\ngood stuff.",
    eyebrow: "THE CORNER CAFE",
    footer: "Made fresh. Served with a smile.",
    label: "COFFEE / LUNCH / TREATS",
    family: "Georgia",
    width: 794,
    height: 1123,
    layout: "menu",
  },
  {
    id: "workshop-flyer",
    name: "Workshop flyer",
    category: "Event",
    bg: "#f6ce55",
    ink: "#20211f",
    accent: "#3155e7",
    headline: "MAKE TIME\nTO MAKE.",
    eyebrow: "A HANDS-ON CREATIVE WORKSHOP",
    footer: "Saturday · 10 AM · Your studio",
    label: "BOOK A PLACE",
    family: "Space Grotesk Variable",
    width: 794,
    height: 1123,
    layout: "menu",
  },
  {
    id: "modern-resume",
    name: "Modern resume",
    category: "Documents",
    bg: "#ffffff",
    ink: "#20211f",
    accent: "#3155e7",
    headline: "YOUR NAME",
    eyebrow: "DESIGNER / MAKER / PROBLEM SOLVER",
    footer: "hello@example.com · Your city · portfolio.example",
    label: "SELECTED EXPERIENCE",
    family: "Inter Variable",
    width: 794,
    height: 1123,
    layout: "resume",
  },
  {
    id: "letterhead",
    name: "Clean letterhead",
    category: "Documents",
    bg: "#ffffff",
    ink: "#173e33",
    accent: "#f85c3a",
    headline: "YOUR STUDIO",
    eyebrow: "A NOTE FROM",
    footer: "hello@example.com · Your address · Your city",
    label: "DATE / RECIPIENT",
    family: "Inter Variable",
    width: 794,
    height: 1123,
    layout: "letter",
  },
);
export function layoutProject(t: Template): Project {
  const width = t.width!,
    height = t.height!,
    objects: Record<string, unknown>[] = [];
  const text = (
    content: string,
    x: number,
    y: number,
    size: number,
    w: number,
    color = t.ink,
    weight = 400,
  ) =>
    objects.push({
      type: "Textbox",
      text: content,
      left: x,
      top: y,
      width: w,
      fontSize: size,
      fontFamily: t.family,
      fontWeight: weight,
      fill: color,
      lineHeight: 1.12,
    });
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    objects.push({ type: "Rect", left: x, top: y, width: w, height: h, fill });
  const circle = (x: number, y: number, r: number, fill: string) =>
    objects.push({ type: "Circle", left: x, top: y, radius: r, fill });
  if (t.layout === "story") {
    text(t.eyebrow, 80, 120, 24, 900, t.ink, 600);
    text(t.headline, 75, 330, 104, 930, t.ink, 700);
    rect(80, 800, 920, 620, t.accent);
    circle(310, 880, 220, t.bg);
    text("YOUR\nPRODUCT", 340, 1010, 62, 400, t.ink, 700);
    text(t.footer, 80, 1510, 32, 920);
    rect(80, 1660, 920, 110, t.ink);
    text(t.label, 130, 1691, 30, 820, t.bg, 600);
  } else if (t.layout === "thumbnail") {
    rect(900, 0, 380, 720, t.accent);
    text(t.eyebrow, 65, 65, 20, 760, t.ink, 600);
    text(t.headline, 60, 180, 92, 830, t.ink, 700);
    circle(955, 220, 115, t.bg);
    text(t.label, 972, 305, 36, 220, t.ink, 700);
    text(t.footer, 65, 625, 22, 1100);
  } else if (t.layout === "slide") {
    rect(0, 0, 28, height, t.accent);
    text(t.eyebrow, 120, 100, 30, 1600, t.ink, 600);
    text(t.headline, 110, 280, 130, 1600, t.ink, 700);
    rect(120, 800, 1680, 3, t.accent);
    text(t.footer, 120, 880, 30, 1450);
    text(t.label, 1690, 880, 36, 160, t.ink, 700);
  } else if (t.layout === "card") {
    rect(0, 0, 28, height, t.accent);
    text(t.headline, 70, 65, 70, 560, t.ink, 700);
    text(t.eyebrow, 75, 270, 17, 800, t.ink, 600);
    rect(670, 70, 310, 310, t.accent);
    text(t.label, 75, 400, 21, 820, t.ink, 600);
    text(t.footer, 75, 462, 22, 820);
  } else if (t.layout === "resume") {
    rect(0, 0, 22, height, t.accent);
    text(t.headline, 65, 65, 54, 660, t.ink, 700);
    text(t.eyebrow, 68, 146, 16, 650, t.accent, 600);
    text(t.footer, 68, 192, 15, 660);
    rect(68, 245, 658, 2, t.accent);
    text("PROFILE", 68, 280, 17, 150, t.accent, 700);
    text(
      "Write two or three lines about your work, strengths\nand the kind of problems you enjoy solving.",
      260,
      280,
      18,
      465,
    );
    text(t.label, 68, 420, 17, 180, t.accent, 700);
    text(
      "ROLE TITLE / YOUR COMPANY\n2024 — PRESENT\n\nDescribe a useful outcome you helped deliver.\nKeep it specific and easy to understand.\n\nPREVIOUS ROLE / COMPANY\n2022 — 2024\n\nShow the impact of your work in a few clear lines.",
      260,
      420,
      18,
      465,
      t.ink,
      400,
    );
    text("EDUCATION\n& SKILLS", 68, 880, 17, 170, t.accent, 700);
    text(
      "Your qualification · Your institution\nDesign · Communication · Your key skills",
      260,
      880,
      18,
      465,
    );
  } else if (t.layout === "letter") {
    text(t.eyebrow, 70, 65, 15, 650, t.accent, 600);
    text(t.headline, 65, 105, 42, 660, t.ink, 700);
    rect(70, 200, 655, 2, t.accent);
    text(t.label, 70, 245, 15, 650, t.accent, 600);
    text(
      "Dear [name],\n\nStart with the purpose of your message.\n\nAdd your context, details and next steps here.\nKeep your paragraphs clear and considered.\n\nThank you for your time.\n\nWarm regards,\nYour name",
      70,
      320,
      20,
      650,
    );
    rect(70, 980, 655, 2, t.accent);
    text(t.footer, 70, 1020, 14, 650);
  } else {
    text(t.eyebrow, 60, 65, 16, 675, t.ink, 600);
    text(t.headline, 55, 135, 66, 680, t.ink, 700);
    rect(60, 350, 675, 3, t.accent);
    text(t.label, 60, 390, 19, 675, t.accent, 700);
    if (t.id === "cafe-menu") {
      [
        ["Espresso", "120"],
        ["Flat white", "180"],
        ["Cold brew", "190"],
        ["Garden sandwich", "240"],
        ["Warm toast", "180"],
        ["Something sweet", "160"],
      ].forEach(([item, price], i) => {
        text(item, 60, 465 + i * 66, 25, 490);
        text(price, 640, 465 + i * 66, 25, 95);
      });
    } else
      text(
        "Learn a new way to make.\nMeet other curious people.\nLeave with something you created.\n\nMaterials included. All levels welcome.\n\nYour studio address\nRegistration: hello@example.com",
        60,
        465,
        25,
        675,
      );
    rect(60, 960, 675, 70, t.accent);
    text(t.footer, 82, 982, 18, 630, t.bg, 600);
  }
  return {
    schemaVersion: 1,
    title: t.name,
    width,
    height,
    background: t.bg,
    scene: { objects },
  };
}
export function templateProject(id: string): Project {
  const t = templates.find((x) => x.id === id) ?? templates[0];
  if (t.layout) return layoutProject(t);
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
