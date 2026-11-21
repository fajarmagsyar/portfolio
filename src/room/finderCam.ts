import { HOME_VIEW } from "./layout";

// Looking through the Canonet's viewfinder, the visitor can walk about with W A S D and look
// about with the mouse. Only so far: the room is furnished to be seen from the desk side, so
// the eye stays in the part of it in front of the desk and can never turn far enough round to
// see the bare end of it.

const HOME_TIP = Math.atan2(HOME_VIEW.look[1] - HOME_VIEW.pos[1], HOME_VIEW.pos[2] - HOME_VIEW.look[2]);

/** where the eye may go, and how far it may turn from facing the desk */
const BOUNDS = { x: [-1.25, 1.25], y: [0.95, 1.55], z: [0.5, 1.7], yaw: 0.8, tip: [-0.55, 0.35] };
const SPEED = 0.75; // metres a second

export const finderCam = {
  x: HOME_VIEW.pos[0],
  y: HOME_VIEW.pos[1],
  z: HOME_VIEW.pos[2],
  /** turned to the right of facing the desk, in radians */
  yaw: 0,
  /** tipped up from level */
  tip: HOME_TIP,
  /** the keys being held, by their place on the keyboard (KeyW and so on) */
  keys: new Set<string>(),
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Back to the chair, looking at the desk. */
export function resetFinderCam() {
  finderCam.x = HOME_VIEW.pos[0];
  finderCam.y = HOME_VIEW.pos[1];
  finderCam.z = HOME_VIEW.pos[2];
  finderCam.yaw = 0;
  finderCam.tip = HOME_TIP;
  finderCam.keys.clear();
}

/** Turns the eye by a movement of the mouse, in pixels. */
export function lookFinderCam(dx: number, dy: number) {
  finderCam.yaw = clamp(finderCam.yaw + dx * 0.0032, -BOUNDS.yaw, BOUNDS.yaw);
  finderCam.tip = clamp(finderCam.tip - dy * 0.0032, BOUNDS.tip[0], BOUNDS.tip[1]);
}

/** Walks for one frame, the way the held keys say. */
export function stepFinderCam(dt: number) {
  const k = finderCam.keys;
  const ahead = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
  const aside = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
  const rise = (k.has("KeyE") || k.has("Space") ? 1 : 0) - (k.has("KeyQ") || k.has("ShiftLeft") ? 1 : 0);
  const step = SPEED * dt;
  // ahead is the way the eye faces, kept level; aside is to its right
  finderCam.x = clamp(finderCam.x + (Math.sin(finderCam.yaw) * ahead + Math.cos(finderCam.yaw) * aside) * step, BOUNDS.x[0], BOUNDS.x[1]);
  finderCam.z = clamp(finderCam.z + (-Math.cos(finderCam.yaw) * ahead + Math.sin(finderCam.yaw) * aside) * step, BOUNDS.z[0], BOUNDS.z[1]);
  finderCam.y = clamp(finderCam.y + rise * step, BOUNDS.y[0], BOUNDS.y[1]);
}
