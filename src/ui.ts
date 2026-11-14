import Phaser from 'phaser';
import { C } from './ink';

/**
 * A small, shared UI kit, so every screen (HUD, toasts, the pause menu, Lost & Found) reads as one
 * considered interface instead of a pile of ad hoc stroked text. The rule that keeps it from looking
 * like a cartoon sticker: heavy painted outlines are for the hand-drawn *world* (signboards, the receipt,
 * the title lettering) only. Anything that is plainly an interface - a readout, a toast, a menu label -
 * sits on its own dark chip and uses a soft drop shadow instead of a thick white/black outline, the same
 * way a considered mobile or indie-PC HUD does (see the "typography in game interfaces" and "menu UX
 * mistakes" pieces referenced in the design notes). One font pair throughout: Fraunces for anything that
 * is a heading or a moment, Karla for everything you read quickly.
 */
export const TITLE = '"Fraunces", serif';
export const TEXT = '"Karla", sans-serif';

export const INK_BG = 0x241c38;
export const PANEL_BG = 0xfff4e0;

/** A rounded, translucent dark chip: the one consistent backing for interface text over the scene. */
export function chip(scene: Phaser.Scene, x: number, y: number, w: number, h: number, originX = 0, originY = 0.5) {
  return scene.add.rectangle(x, y, w, h, INK_BG, 0.5).setOrigin(originX, originY).setStrokeStyle(2, 0xfff2da, 0.22);
}

/** A HUD readout label: small, clean, legible on any backdrop, no comic outline. */
export function hudText(scale = 1): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: TEXT,
    fontSize: `${Math.round(26 * scale)}px`,
    color: C.cream,
    shadow: { offsetX: 0, offsetY: 2, blur: 3, color: '#120d1f', fill: true },
  };
}

/** A toast/callout: still Fraunces for a little character, but a thin controlled stroke, not a sticker outline. */
export function toastText(size = 40): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TITLE, fontSize: `${size}px`, color: C.cream, stroke: C.ink, strokeThickness: 4 };
}

/** A menu heading: display font, a thin stroke for separation from busy art, letter-spaced caps read calmer. */
export function headingText(size = 44, color: string = C.cream): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TITLE, fontSize: `${size}px`, color, stroke: C.ink, strokeThickness: 5 };
}

/** A button label: flat ink on the button's own paper colour, no outline needed. */
export function buttonText(size = 32): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TITLE, fontSize: `${size}px`, color: C.ink };
}

/** A plain interface label (menu rows, hints): Karla, a soft shadow, slight letter-spacing for polish. */
export function uiText(size = 24, color: string = C.cream): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: TEXT, fontSize: `${size}px`, color, letterSpacing: 0.2, shadow: { offsetX: 0, offsetY: 1, blur: 2, color: '#120d1f', fill: true } };
}
