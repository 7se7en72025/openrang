import { layoutProject, type Template } from "./templates";
export function TemplatePreview({ template }: { template: Template }) {
  const p = layoutProject(template);
  return (
    <svg
      className="layout-preview"
      viewBox={`0 0 ${p.width} ${p.height}`}
      aria-hidden="true"
    >
      <rect width={p.width} height={p.height} fill={p.background} />
      {p.scene.objects.map((o, i) => {
        const x = Number(o.left),
          y = Number(o.top),
          fill = String(o.fill);
        if (o.type === "Rect")
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Number(o.width)}
              height={Number(o.height)}
              fill={fill}
            />
          );
        if (o.type === "Circle")
          return (
            <circle
              key={i}
              cx={x + Number(o.radius)}
              cy={y + Number(o.radius)}
              r={Number(o.radius)}
              fill={fill}
            />
          );
        return (
          <text
            key={i}
            fill={fill}
            fontFamily={String(o.fontFamily)}
            fontSize={Number(o.fontSize)}
            fontWeight={Number(o.fontWeight)}
          >
            {String(o.text)
              .split("\n")
              .map((line, j) => (
                <tspan
                  key={j}
                  x={x}
                  y={y + Number(o.fontSize) * (0.85 + j * Number(o.lineHeight))}
                >
                  {line}
                </tspan>
              ))}
          </text>
        );
      })}
    </svg>
  );
}
