import type { FocusId } from "./store";

// World units are metres. +x right, +y up, +z towards the viewer. The back wall is at z = WALL_Z.
// The composition follows the reference: a desk pushed up against a wide window, lamp and
// plant on the left, the TV in the middle, tapes and discs on the right.
export const WALL_Z = -0.62;
export const DESK = { y: 0.76, x0: -1.25, x1: 1.25, z0: -0.6, z1: 0.18, thick: 0.045 };

type V3 = [number, number, number];

export const WIN = { w: 1.9, h: 1.35, x: 0, y: 1.66 };

/** Top surface of the window sill, where the CD cases stand. */
export const SILL = { x0: 0.2, y: WIN.y - WIN.h / 2 - 0.0175, z: -0.61 };

export const POS = {
  tv: [-0.12, DESK.y, -0.2] as V3,
  console: [-0.62, DESK.y + 0.03, -0.1] as V3,
  gamepad: [-0.3, DESK.y + 0.002, 0.09] as V3,
  lamp: [-0.82, DESK.y, -0.38] as V3,
  deskPlant: [-1.08, DESK.y, -0.36] as V3,
  cards: [-0.72, DESK.y, 0.09] as V3,
  tapeRack: [0.56, DESK.y, -0.42] as V3,
  cassette: [0.42, DESK.y, -0.12] as V3,
  cdStack: [0.55, SILL.y, SILL.z] as V3,
  cdPlayer: [0.84, DESK.y, -0.04] as V3,
  coffee: [0.25, DESK.y, 0.08] as V3,
  notes: [1.47, 1.2, WALL_Z + 0.006] as V3,
  // the two frames stand on the desk now, leaning on the wall at its right-hand end
  frames: [1.07, DESK.y, -0.33] as V3,
  guitar: [-1.37, 0, -0.22] as V3,
  amp: [-1.82, 0, -0.38] as V3,
  plant: [1.74, 0, 0.0] as V3,
  window: [WIN.x, WIN.y, WALL_Z] as V3,
};

// The wide view is the eyes of someone sitting at the desk: low, close, with the desk top
// running out of the bottom of the frame. Close-ups use a longer lens so objects are not distorted.
export const HOME_VIEW = { pos: [0.0, 1.2, 1.45] as V3, look: [0, 1.1, -0.3] as V3 };
/** Before the visitor has clicked to enter: leaning in towards the TV, which carries the prompt. */
export const ENTER_VIEW = { pos: [-0.07, 1.1, 0.98] as V3, look: [-0.15, 1.03, -0.2] as V3 };
export const HOME_FOV = 50;
export const FOCUS_FOV = 36;

/** Where the camera goes for each object. `look` is the object itself; the rig shifts the frame left to make room for the panel. */
export const VIEWS: Record<FocusId, { pos: V3; look: V3 }> = {
  // square on to the tube and close enough that the picture nearly fills the height
  tv: { pos: [-0.126, 1.019, 0.55], look: [-0.17, 1.019, -0.005] },
  tapes: { pos: [0.56, 0.98, 0.5], look: [0.56, 0.82, -0.48] },
  cassette: { pos: [0.42, 1.12, 0.3], look: [0.42, 0.77, -0.12] },
  cds: { pos: [0.55, 1.12, 0.5], look: [0.55, 1.04, -0.61] },
  cd: { pos: [0.84, 1.16, 0.44], look: [0.84, 0.79, -0.04] },
  guitar: { pos: [-0.72, 0.72, 1.58], look: [-1.37, 0.58, -0.17] },
  frames: { pos: [0.82, 1.0, 0.42], look: [1.07, 0.93, -0.33] },
  notes: { pos: [1.47, 1.2, 0.3], look: [1.47, 1.2, WALL_Z] },
  cards: { pos: [-0.72, 1.14, 0.52], look: [-0.72, 0.77, 0.09] },
};
