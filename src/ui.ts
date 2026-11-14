import Phaser from 'phaser';

/**
 * The small UI kit every interface piece in the game is built from - HUD chips, readouts, labels -
 * now in the title's printed identity: ink chips with a bone hairline, Anton for anything you read as
 * a word or a number that matters, Space Mono for small labels, bone on ink, ember and red for accents.
 * No soft drop shadows or rounded app chips any more: flat inks, hard edges, like the poster.
 */
export const TITLE = '"Anton", "Impact", sans-serif';
export const TEXT = '"Space Mono", monospace';

export const INK_BG = 0x0a0712;
export const PANEL_BG = 0xf3e3cc;
const BONE = '#F3E3CC';
const INK = '#0A0712';

/** An ink chip with a bone hairline: the one backing for interface text over the scene. */
export function chip(scene: Phaser.Scene, x: number, y: number, w: number, h: number, originX = 0, originY = 0.5) {
  return scene.add.rectangle(x, y, w, h, INK_BG, 0.88).setOrigin(originX, originY).setStrokeStyle(2, 0xf3e3cc, 0.3);
}

/** A HUD readout: Anton, bone, with an ink edge so it holds up over any backdrop. */
export function hudText(scale = 1): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TITLE, fontSize: `${Math.round(30 * scale)}px`, color: BONE, letterSpacing: 1 };
}

/** A menu heading. */
export function headingText(size = 44, color: string = BONE): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TITLE, fontSize: `${size}px`, color, stroke: INK, strokeThickness: 6, letterSpacing: 2 };
}

/** A button label: ink on the button's tape. */
export function buttonText(size = 32): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TITLE, fontSize: `${size}px`, color: INK };
}

/** A small interface label (chips, hints): Space Mono, bold, a little tracked. */
export function uiText(size = 24, color: string = BONE): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TEXT, fontStyle: 'bold', fontSize: `${Math.round(size * 0.82)}px`, color, letterSpacing: 2 };
}
