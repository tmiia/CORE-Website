// Vendored from something.fm@7129c50 client/lib/ascii/charAtlas.ts
import { CanvasTexture, LinearFilter, NearestFilter, Texture } from "three";

export type FillMode = "characters" | "squares" | "circles" | "dots";

export interface AtlasOptions {
  characters: string;
  charCount: number;
  fillMode: FillMode;
  cellPixelSize: number;
  fontFamily: string;
  bold: boolean;
}

export interface Atlas {
  texture: Texture;
  count: number;
  sortedCharacters: string;
}

function measureGlyphDensity(
  ctx: CanvasRenderingContext2D,
  char: string,
  cellPixelSize: number,
  fontFamily: string,
  bold: boolean,
): number {
  ctx.clearRect(0, 0, cellPixelSize, cellPixelSize);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = Math.floor(cellPixelSize * 0.9);
  ctx.font = `${bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
  ctx.fillText(char, cellPixelSize / 2, cellPixelSize / 2);

  const data = ctx.getImageData(0, 0, cellPixelSize, cellPixelSize).data;
  let count = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) count++;
  }
  return count;
}

function sortCharactersByDensity(
  characters: string,
  cellPixelSize: number,
  fontFamily: string,
  bold: boolean,
): string {
  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = cellPixelSize;
  measureCanvas.height = cellPixelSize;
  const ctx = measureCanvas.getContext("2d", { willReadFrequently: true })!;

  const chars = Array.from(characters);
  const scored = chars.map((c) => ({
    char: c,
    density: measureGlyphDensity(ctx, c, cellPixelSize, fontFamily, bold),
  }));
  scored.sort((a, b) => a.density - b.density);
  return scored.map((s) => s.char).join("");
}

export function buildAtlas(opts: AtlasOptions): Atlas {
  const { characters, charCount, fillMode, cellPixelSize, fontFamily, bold } =
    opts;

  let workingChars = characters;
  if (fillMode === "characters") {
    const sliced = Array.from(characters).slice(0, charCount).join("");
    workingChars = sortCharactersByDensity(
      sliced,
      cellPixelSize,
      fontFamily,
      bold,
    );
  }

  const count =
    fillMode === "characters"
      ? Math.max(1, Array.from(workingChars).length)
      : Math.max(1, Math.min(charCount, 64));

  const canvas = document.createElement("canvas");
  canvas.width = cellPixelSize * count;
  canvas.height = cellPixelSize;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const charsArr = Array.from(workingChars);

  for (let i = 0; i < count; i++) {
    const x0 = i * cellPixelSize;
    const cx = x0 + cellPixelSize / 2;
    const cy = cellPixelSize / 2;
    const density = count === 1 ? 1 : i / (count - 1);

    if (fillMode === "characters") {
      const ch = charsArr[i] ?? " ";
      const fontSize = Math.floor(cellPixelSize * 0.9);
      ctx.font = `${bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
      ctx.fillText(ch, cx, cy);
    } else if (fillMode === "squares") {
      const size = density * cellPixelSize;
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    } else if (fillMode === "circles") {
      const radius = (density * cellPixelSize) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (fillMode === "dots") {
      const radius = (density * cellPixelSize) / 4;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = fillMode === "characters" ? LinearFilter : NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { texture, count, sortedCharacters: workingChars };
}
