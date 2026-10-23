export interface EmbeddedFont {
  family: string;
  name: string;
  src: string;
}
export const embeddedFont =
  /^data:font\/(woff2|woff|ttf|otf);base64,[A-Za-z0-9+/]+={0,2}$/;
export function validateFonts(input: unknown): EmbeddedFont[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 8)
    throw Error("Keep up to eight custom fonts per project or brand kit.");
  let bytes = 0;
  const fonts = input.map((f) => {
    if (
      !f ||
      typeof f !== "object" ||
      typeof f.name !== "string" ||
      !f.name.trim() ||
      f.name.length > 80 ||
      typeof f.family !== "string" ||
      !/^OpenRangFont_[a-f0-9]{64}$/.test(f.family) ||
      typeof f.src !== "string" ||
      !embeddedFont.test(f.src)
    )
      throw Error(
        "Invalid embedded font. Upload WOFF2, WOFF, TTF or OTF files.",
      );
    if (f.src.length > 2800000)
      throw Error("Each font must be smaller than 2 MB.");
    const data = atob(f.src.split(",")[1]);
    if (data.length < 12 || data.length > 2 * 1024 * 1024)
      throw Error("Each font must be smaller than 2 MB.");
    const header = data.slice(0, 4),
      format = f.src.slice(10, f.src.indexOf(";"));
    if (
      !(
        {
          woff2: "wOF2",
          woff: "wOFF",
          ttf: "\u0000\u0001\u0000\u0000",
          otf: "OTTO",
        } as Record<string, string>
      )[format] ||
      header !==
        (
          {
            woff2: "wOF2",
            woff: "wOFF",
            ttf: "\u0000\u0001\u0000\u0000",
            otf: "OTTO",
          } as Record<string, string>
        )[format]
    )
      throw Error("The font file header does not match its format.");
    bytes += f.src.length;
    return { family: f.family, name: f.name, src: f.src };
  });
  if (
    bytes > 6 * 1024 * 1024 ||
    new Set(fonts.map((f) => f.family)).size !== fonts.length
  )
    throw Error(
      "Custom fonts must be unique and stay within 6 MB of embedded data.",
    );
  return fonts;
}
