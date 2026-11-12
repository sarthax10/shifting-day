import { CURSOR_HOTSPOT, CURSOR_KINDS, cursorArt, type CursorKind } from './art';

/** CSS cursor values for the game's own pointers, filled in once the pictures are drawn. */
export const CURSOR: Record<CursorKind, string> = { point: 'default', open: 'pointer', grab: 'grabbing', rope: 'crosshair' };

/** Draws each cursor to a small picture the browser can use, with an ordinary pointer as a fallback. */
export async function makeCursors() {
  await Promise.all(
    CURSOR_KINDS.map(
      (kind) =>
        new Promise<void>((resolve) => {
          const art = cursorArt(kind);
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = art.w;
            canvas.height = art.h;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            const [x, y] = CURSOR_HOTSPOT[kind];
            CURSOR[kind] = `url(${canvas.toDataURL('image/png')}) ${x} ${y}, ${CURSOR[kind]}`;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`;
        }),
    ),
  );
}
