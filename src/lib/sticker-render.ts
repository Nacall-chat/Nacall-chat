/** Desenho da figurinha (512×512): recorte, ajuste, formato e remoção de fundo liso. As contas ficam aqui para serem testáveis. */
export const STICKER_SIZE = 512;
export type StickerShape = 'square' | 'rounded' | 'circle';
export type StickerEdit = { zoom: number; x: number; y: number; fit: 'cover' | 'contain'; shape: StickerShape; turns: number; removeBg: boolean; tolerance: number };
export const defaultEdit: StickerEdit = { zoom: 1, x: 0, y: 0, fit: 'cover', shape: 'square', turns: 0, removeBg: false, tolerance: 40 };

/** Onde a imagem cai no quadro: escala, centro e deslocamento já limitado para não deixar o quadro vazio no modo "Preencher". */
export function placement(width: number, height: number, edit: StickerEdit, size = STICKER_SIZE) {
  const turned = edit.turns % 2 !== 0;
  const w = turned ? height : width, h = turned ? width : height;
  const base = edit.fit === 'cover' ? Math.max(size / w, size / h) : Math.min(size / w, size / h);
  const scale = base * edit.zoom;
  const limitX = edit.fit === 'cover' ? Math.max(0, (w * scale - size) / 2) : size / 2;
  const limitY = edit.fit === 'cover' ? Math.max(0, (h * scale - size) / 2) : size / 2;
  const x = Math.min(limitX, Math.max(-limitX, edit.x)) || 0, y = Math.min(limitY, Math.max(-limitY, edit.y)) || 0;
  return { scale, x, y, cx: size / 2 + x, cy: size / 2 + y, limitX, limitY };
}

type Pixels = { data: Uint8ClampedArray; width: number; height: number };

/** Cor média dos quatro cantos (imagem pequena e esticada), usada como "cor do fundo". */
export function cornerColor(pixels: Pixels): [number, number, number] {
  const { data, width, height } = pixels;
  const spots = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const sum = [0, 0, 0];
  for (const [x, y] of spots) { const o = (y * width + x) * 4; sum[0] += data[o]; sum[1] += data[o + 1]; sum[2] += data[o + 2]; }
  return [Math.round(sum[0] / 4), Math.round(sum[1] / 4), Math.round(sum[2] / 4)];
}

/**
 * Remove fundo liso: parte das bordas (e de áreas já transparentes) e apaga os pixels vizinhos parecidos com a cor
 * do fundo, sem atravessar o desenho. Uma faixa estreita acima da tolerância vira meia transparência para suavizar o contorno.
 */
export function removeBackground(pixels: Pixels, reference: [number, number, number], tolerance: number) {
  const { data, width: w, height: h } = pixels;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;
  const soft = tolerance * 1.4;
  const distance = (i: number) => Math.hypot(data[i * 4] - reference[0], data[i * 4 + 1] - reference[1], data[i * 4 + 2] - reference[2]);
  const visit = (i: number) => {
    if (seen[i]) return;
    seen[i] = 1;
    if (data[i * 4 + 3] === 0) { stack[top++] = i; return; }
    const d = distance(i);
    if (d <= tolerance) { data[i * 4 + 3] = 0; stack[top++] = i; }
    else if (d <= soft) data[i * 4 + 3] = Math.round(data[i * 4 + 3] * ((d - tolerance) / (soft - tolerance)));
  };
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1); }
  while (top > 0) {
    const i = stack[--top], x = i % w, y = (i - x) / w;
    if (x > 0) visit(i - 1);
    if (x < w - 1) visit(i + 1);
    if (y > 0) visit(i - w);
    if (y < h - 1) visit(i + w);
  }
}

function shapePath(ctx: CanvasRenderingContext2D, size: number, shape: StickerShape) {
  if (shape === 'square') { ctx.rect(0, 0, size, size); return; }
  const r = shape === 'circle' ? size / 2 : size * 0.18;
  ctx.moveTo(r, 0); ctx.arcTo(size, 0, size, size, r); ctx.arcTo(size, size, 0, size, r); ctx.arcTo(0, size, 0, 0, r); ctx.arcTo(0, 0, size, 0, r); ctx.closePath();
}

/** Desenha a figurinha no canvas (512×512, fundo transparente). `reference` é a cor do fundo, se for removê-lo. */
export function drawSticker(canvas: HTMLCanvasElement, bitmap: ImageBitmap, edit: StickerEdit, reference?: [number, number, number]) {
  const size = STICKER_SIZE;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Este navegador não consegue desenhar a figurinha.');
  ctx.clearRect(0, 0, size, size);
  const place = placement(bitmap.width, bitmap.height, edit, size);
  ctx.save();
  ctx.beginPath(); shapePath(ctx, size, edit.shape); ctx.clip();
  ctx.translate(place.cx, place.cy); ctx.rotate((edit.turns % 4) * Math.PI / 2); ctx.scale(place.scale, place.scale);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
  if (edit.removeBg && reference) {
    const pixels = ctx.getImageData(0, 0, size, size);
    removeBackground(pixels, reference, edit.tolerance);
    ctx.putImageData(pixels, 0, 0);
  }
}

/** Lê a cor dos cantos da imagem original para usar como fundo a remover. */
export function sampleBackground(bitmap: ImageBitmap): [number, number, number] {
  const probe = document.createElement('canvas'); probe.width = 16; probe.height = 16;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [255, 255, 255];
  ctx.drawImage(bitmap, 0, 0, 16, 16);
  return cornerColor(ctx.getImageData(0, 0, 16, 16));
}

/** Gera o arquivo WEBP (PNG se o navegador não codifica WEBP) abaixo de 1 MB, baixando a qualidade se preciso. */
export async function stickerBlob(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  const encode = (type: string, quality?: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
  for (const quality of [0.92, 0.8, 0.65, 0.5]) {
    const blob = await encode('image/webp', quality);
    if (blob && blob.type === 'image/webp') { if (blob.size <= maxBytes) return blob; continue; }
    const png = await encode('image/png');
    if (png && png.size <= maxBytes) return png;
    break;
  }
  throw new Error('Não consegui deixar a figurinha abaixo de 1 MB. Escolha uma imagem mais simples.');
}
