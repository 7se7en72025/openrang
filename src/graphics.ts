import { Circle, Rect, Polygon, Group, type FabricObject } from "fabric";
export const graphics = [
  { id: "star", name: "Star", icon: "★" },
  { id: "heart", name: "Heart", icon: "♥" },
  { id: "arrow", name: "Arrow", icon: "➜" },
  { id: "flower", name: "Flower", icon: "✿" },
  { id: "checker", name: "Checker", icon: "▦" },
  { id: "speech", name: "Speech bubble", icon: "▱" },
];
export function makeGraphic(id: string, fill: string): FabricObject {
  if (id === "star")
    return new Polygon(
      Array.from({ length: 10 }, (_, i) => {
        const a = (i * Math.PI) / 5 - Math.PI / 2,
          r = i % 2 ? 44 : 100;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r };
      }),
      { fill },
    );
  if (id === "heart")
    return new Polygon(
      Array.from({ length: 40 }, (_, i) => {
        const a = (i * Math.PI) / 20;
        return {
          x: 8 * (16 * Math.sin(a) ** 3),
          y:
            -8 *
            (13 * Math.cos(a) -
              5 * Math.cos(2 * a) -
              2 * Math.cos(3 * a) -
              Math.cos(4 * a)),
        };
      }),
      { fill },
    );
  if (id === "arrow")
    return new Polygon(
      [
        { x: 0, y: 60 },
        { x: 120, y: 60 },
        { x: 120, y: 0 },
        { x: 220, y: 100 },
        { x: 120, y: 200 },
        { x: 120, y: 140 },
        { x: 0, y: 140 },
      ],
      { fill },
    );
  if (id === "speech")
    return new Polygon(
      [
        { x: 0, y: 0 },
        { x: 220, y: 0 },
        { x: 220, y: 145 },
        { x: 90, y: 145 },
        { x: 30, y: 200 },
        { x: 30, y: 145 },
        { x: 0, y: 145 },
      ],
      { fill },
    );
  if (id === "checker")
    return new Group([
      new Rect({ left: 0, top: 0, width: 100, height: 100, fill }),
      new Rect({ left: 100, top: 100, width: 100, height: 100, fill }),
      new Rect({
        left: 100,
        top: 0,
        width: 100,
        height: 100,
        fill,
        opacity: 0.22,
      }),
      new Rect({
        left: 0,
        top: 100,
        width: 100,
        height: 100,
        fill,
        opacity: 0.22,
      }),
    ]);
  if (id === "flower")
    return new Group([
      ...Array.from(
        { length: 6 },
        (_, i) =>
          new Circle({
            left: 75 + Math.cos((i * Math.PI) / 3) * 65,
            top: 75 + Math.sin((i * Math.PI) / 3) * 65,
            radius: 45,
            fill,
          }),
      ),
      new Circle({ left: 90, top: 90, radius: 30, fill: "#f7f1df" }),
    ]);
  throw Error("Unknown graphic.");
}
