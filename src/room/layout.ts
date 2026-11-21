import type { FocusId } from "./store";

// World units are metres. +x right, +y up, +z towards the viewer. The back wall is at z = WALL_Z.
// The composition is a small desk pushed up against a window, with everything on it within
// arm's reach of everything else: lamp and plant crowding the TV from the left, the shelf of
// tapes and discs hard against it on the right, and the things in use in front.
export const WALL_Z = -0.62;
export const DESK = { y: 0.76, x0: -1.0, x1: 1.0, z0: -0.6, z1: 0.18, thick: 0.045 };

type V3 = [number, number, number];

export const WIN = { w: 1.4, h: 1.35, x: 0, y: 1.66 };

/** Top surface of the window sill. */
export const SILL = { x0: 0.2, y: WIN.y - WIN.h / 2 - 0.0175, z: -0.61 };

/**
 * The small wooden shelf at the back of the desk, right of the TV. Cassettes and CD cases
 * stand in it side by side like books, spines to the room: cassettes on the left of the
 * divider, CDs on the right. Heights are above the desk top; z values are world.
 */
export const SHELF = {
  x: 0.37,
  inner: 0.166, // between the two ends
  wall: 0.012, // thickness of the boards
  back: -0.462,
  front: -0.292,
  spine: -0.303, // where the spines line up
  /** from the left end to the middle of the first cassette, and from one to the next */
  tape: { start: 0.0144, pitch: 0.0168 },
  divider: 0.099,
  cd: { start: 0.1122, pitch: 0.0124 },
};
/** x of the middle of each group, for the camera and the preview */
const SHELF_LEFT = SHELF.x - SHELF.inner / 2;
const TAPES_X = SHELF_LEFT + SHELF.tape.start + SHELF.tape.pitch * 2;
const CDS_X = SHELF_LEFT + SHELF.cd.start + SHELF.cd.pitch * 1.5;

export const POS = {
  tv: [-0.05, DESK.y, -0.2] as V3,
  console: [-0.5, DESK.y, -0.07] as V3,
  gamepad: [-0.5, DESK.y + 0.002, 0.12] as V3,
  // the old keyboard, square in front of the TV
  keyboard: [-0.05, DESK.y, 0.094] as V3,
  lamp: [-0.66, DESK.y, -0.42] as V3,
  deskPlant: [-0.86, DESK.y, -0.38] as V3,
  cards: [-0.76, DESK.y, 0.1] as V3,
  // both are the middle of the group, at the top of the shelf's floor, on the line of the spines
  tapeRack: [TAPES_X, DESK.y + SHELF.wall, SHELF.spine] as V3,
  cdStack: [CDS_X, DESK.y + SHELF.wall, SHELF.spine] as V3,
  cdPlayer: [0.45, DESK.y, -0.07] as V3,
  coffee: [0.235, DESK.y, 0.11] as V3,
  notes: [1.17, 1.22, WALL_Z + 0.006] as V3,
  // the two frames stand at the back of the desk, right of the shelf
  frames: [0.74, DESK.y, -0.4] as V3,
  // the Discman in front of the shelf, the rangefinder beside it, the album at the desk's right-hand corner
  canonet: [0.67, DESK.y, 0.08] as V3,
  album: [0.86, DESK.y, 0.05] as V3,
  // the Saturn lamp at the right-hand end, between the frames and the album
  saturn: [0.92, DESK.y, -0.18] as V3,
  /** the two framed posters: one on the sill behind the lamp, one at the left end of the desk */
  sillPoster: [-0.47, SILL.y, SILL.z + 0.07] as V3,
  deskPoster: [-0.83, DESK.y, 0.0] as V3,
  /** the poster taped to the wall left of the window: x and y of its middle */
  wallPoster: [-1.2, 1.5] as [number, number],
  guitar: [-1.22, 0, -0.22] as V3,
  amp: [-1.62, 0, -0.4] as V3,
  plant: [1.3, 0, -0.05] as V3,
  window: [WIN.x, WIN.y, WALL_Z] as V3,
};

/** The view when a CD is out of the shelf, open, with its leaflet unfolded above it. */
export const CD_OPEN_VIEW = { pos: [CDS_X, 1.12, 0.4] as V3, look: [CDS_X, 1.075, -0.2] as V3 };

/** Where the album is held when it is picked up, and so where the camera looks. */
export const ALBUM_HELD: V3 = [0.76, 1.0, 0.27];

// The wide view is the eyes of someone sitting at the desk: low, close, with the desk top
// running out of the bottom of the frame. Close-ups use a longer lens so objects are not distorted.
export const HOME_VIEW = { pos: [0.0, 1.17, 1.2] as V3, look: [0, 1.05, -0.3] as V3 };
/** Before the visitor has clicked to enter: leaning in towards the TV, which carries the prompt. */
export const ENTER_VIEW = { pos: [0.0, 1.1, 0.98] as V3, look: [-0.08, 1.03, -0.2] as V3 };
export const HOME_FOV = 47;
export const FOCUS_FOV = 36;

/** Where the camera goes for each object. `look` is the object itself; the rig shifts the frame left to make room for the panel. */
export const VIEWS: Record<FocusId, { pos: V3; look: V3 }> = {
  // square on to the tube and close enough that the picture nearly fills the height
  tv: { pos: [-0.056, 1.019, 0.55], look: [-0.1, 1.019, -0.005] },
  // close on the shelf: the spines fill the lower half, and what is pulled out is held up in front
  tapes: { pos: [TAPES_X, 1.0, 0.2], look: [TAPES_X, 0.865, -0.3] },
  cds: { pos: [CDS_X, 1.0, 0.2], look: [CDS_X, 0.865, -0.3] },
  // looking down on the Discman's keys from just in front of it
  cd: { pos: [0.45, 0.99, 0.17], look: [0.445, 0.79, -0.01] },
  guitar: { pos: [-0.57, 0.72, 1.58], look: [-1.22, 0.58, -0.17] },
  frames: { pos: [0.56, 1.0, 0.36], look: [0.74, 0.91, -0.4] },
  notes: { pos: [1.17, 1.22, 0.3], look: [1.17, 1.22, WALL_Z] },
  cards: { pos: [-0.76, 1.14, 0.53], look: [-0.76, 0.77, 0.1] },
  // both of these are picked up off the desk when focused: the view looks at where they are held
  canonet: { pos: [0.67, 1.0, 0.61], look: [0.67, 0.9, 0.08] },
  album: { pos: [ALBUM_HELD[0], 1.27, 0.9], look: ALBUM_HELD },
};
