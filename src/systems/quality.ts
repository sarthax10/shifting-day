import { isTouchDevice } from '../ui/touch';

/**
 * Phones and tablets: the game is drawn at full size on a GPU that fills pixels and takes texture uploads
 * far more slowly than a desktop's, so the live pictures (moving water, the aurora) are drawn smaller and
 * refreshed less often there. Desktops keep the smoother rates.
 */
export const LOW_POWER = isTouchDevice();

/** How often a live canvas is redrawn, in milliseconds: `desktop` normally, `phone` on a low-power device. */
export const every = (desktop: number, phone: number) => (LOW_POWER ? phone : desktop);
