import Phaser from 'phaser';
import type { BiomeKey } from './legs';

/**
 * Screen-wide polish, built from Phaser 4's camera filter stack: a frame-darkening vignette so the eye
 * settles on the road, and a per-biome colour grade so each leg reads as its own mood (the same trick as a
 * LUT in a photo or film edit) rather than the same flat colours everywhere. The cyberpunk town also gets a
 * cheap, tightly thresholded bloom, since neon is the one place a glow earns its keep; everywhere else stays
 * crisp and flat, in keeping with the game's hand-painted look.
 *
 * Reference points: colour grading and vignetting are the two cheapest, highest-return post effects a 2D
 * game can add (see Phaser's own FX docs and the "Post-Processing: Bloom, HDR, and Color Grading" write-up
 * at kindatechnical.com); bloom is reserved for neon/night scenes for the same reason real photographers only
 * see blooming highlights around actual light sources, not across a sunlit field.
 */

/** Applies (or re-applies) this leg's look to a camera: vignette, grade, and town's neon bloom. */
export function applyBiomeFX(camera: Phaser.Cameras.Scene2D.Camera, biome: BiomeKey) {
  try {
    camera.filters.internal.clear();
    camera.filters.external.clear();
    gradeFor(camera, biome);
    vignette(camera, 0x000000, biome === 'town' ? 0.4 : 0.3);
    if (biome === 'town') neonBloom(camera);
  } catch {
    // Canvas fallback, or a renderer without filter support: carry on unfiltered.
  }
}

/** A soft, warm vignette for the title screen's golden-hour look. */
export function applyTitleFX(camera: Phaser.Cameras.Scene2D.Camera) {
  try {
    camera.filters.internal.clear();
    camera.filters.external.clear();
    const cm = camera.filters.internal.addColorMatrix();
    cm.colorMatrix.saturate(0.12, false);
    cm.colorMatrix.contrast(0.05, true);
    cm.colorMatrix.brightness(1.015, true);
    vignette(camera, 0x2a1810, 0.32);
  } catch {
    // ignore
  }
}

function vignette(camera: Phaser.Cameras.Scene2D.Camera, color: number, strength: number) {
  camera.filters.external.addVignette(0.5, 0.5, 0.82, strength, color);
}

/** One ColorMatrix grade per biome: each call after the first composes (multiply=true) onto the last. */
function gradeFor(camera: Phaser.Cameras.Scene2D.Camera, biome: BiomeKey) {
  const cm = camera.filters.internal.addColorMatrix().colorMatrix;
  switch (biome) {
    case 'meadow':
      // A clean, sunny midday: a little extra punch, nothing moody.
      cm.saturate(0.12, false);
      cm.contrast(0.05, true);
      break;
    case 'autumn':
      // Misty morning turning amber: warm hue, richer colour.
      cm.hue(-5, false);
      cm.saturate(0.22, true);
      cm.contrast(0.07, true);
      cm.brightness(1.01, true);
      break;
    case 'snow':
      // Blue hour on the pass: cool, slightly flattened, a touch brighter.
      cm.hue(6, false);
      cm.saturate(-0.1, true);
      cm.contrast(0.04, true);
      cm.brightness(1.03, true);
      break;
    case 'town':
      // Rainy neon night: heavy saturation and contrast so the signs sing, pulled a hair darker.
      cm.saturate(0.4, false);
      cm.contrast(0.18, true);
      cm.brightness(0.97, true);
      break;
    case 'coast':
      // Bright sea light: airy and a little bleached, like a beach photo at noon.
      cm.saturate(0.08, false);
      cm.contrast(0.05, true);
      cm.brightness(1.03, true);
      break;
  }
}

/** A tight, thresholded bloom: only the near-white neon cores and lamps catch a glow, not the whole street. */
function neonBloom(camera: Phaser.Cameras.Scene2D.Camera) {
  const pf = camera.filters.internal.addParallelFilters();
  pf.top.addThreshold(0.82, 1);
  pf.top.addBlur(0, 3, 3, 1);
  pf.blend.blendMode = Phaser.BlendModes.ADD;
  pf.blend.amount = 0.45;
}
