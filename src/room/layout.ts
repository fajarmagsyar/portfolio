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

/**
 * Where a cassette is held up to be read, and the pamphlet unfolds from behind it. On a wide
 * screen the pamphlet takes the right-hand side, so the cassette steps to the left; on an
 * upright one the pamphlet takes the bottom, so it steps up.
 */
export function tapeHeld(aspect: number): V3 {
  const wide = aspect > 1.05;
  return [TAPES_X + (wide ? 0.045 : 0), POS.tapeRack[1] + 0.18 + (wide ? 0 : 0.03), POS.tapeRack[2] + 0.15];
}

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
  // the mug is on the left of the keyboard, clear of the mouse and of the view of the shelf
  coffee: [-0.335, DESK.y, 0.095] as V3,
  // the mouse to the right of the keyboard, with room to move; the dice in front of the Discman
  mouse: [0.27, DESK.y, 0.085] as V3,
  dice: [0.5, DESK.y, 0.115] as V3,
  // the receipt, folded small, near the planet lamp: far enough towards the middle that the camera in front does not hide it
  receipt: [0.62, DESK.y, -0.13] as V3,
  // the clock on the wall to the right of the window, above the notes: in sight from the chair
  clock: [1.2, 1.6, WALL_Z + 0.004] as V3,
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
  // far enough along that its leaves do not hang in front of the album when it is held up
  plant: [1.5, 0, -0.2] as V3,
  window: [WIN.x, WIN.y, WALL_Z] as V3,
};

/** The lamp model is scaled to this; its globe then sits this high and is this big. */
export const SATURN_SCALE = 0.44;
export const SATURN_GLOBE_Y = DESK.y + 0.2129 * SATURN_SCALE;
export const SATURN_GLOBE_R = 0.1343 * SATURN_SCALE;

/** The view when a CD is out of the shelf, open, with its leaflet unfolded above it. */
export const CD_OPEN_VIEW = { pos: [CDS_X, 1.12, 0.4] as V3, look: [CDS_X, 1.075, -0.2] as V3 };

/** Where the pack of contact cards is held up, and its cards after it. */
export const CARDS_HELD: V3 = [-0.76, 0.99, 0.22];

/** Through the Canonet's viewfinder the room is seen from the chair, as it always is, with a 40 mm lens's narrower field. */
export const FINDER_FOV = 40;

/** Where the receipt is held up to be read. */
export const RECEIPT_HELD: V3 = [POS.receipt[0], 0.97, 0.24];

/** Where the album is held when it is picked up, and so where the camera looks. */
export const ALBUM_HELD: V3 = [0.76, 1.0, 0.27];

// The wide view is the eyes of someone sitting at the desk: low, close, with the desk top
// running out of the bottom of the frame. Close-ups use a longer lens so objects are not distorted.
export const HOME_VIEW = { pos: [0.0, 1.17, 1.2] as V3, look: [0, 1.05, -0.3] as V3 };
/** Before the visitor has clicked to enter: leaning in towards the TV, which carries the prompt. */
export const ENTER_VIEW = { pos: [0.0, 1.1, 0.98] as V3, look: [-0.08, 1.03, -0.2] as V3 };
/** At the typing test the view draws back a little from the TV so the keyboard is in the picture too. */
export const TYPING_VIEW = { pos: [-0.056, 1.1, 0.86] as V3, look: [-0.08, 0.92, -0.03] as V3 };
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
  // the pack and its cards are held up in front of the eye
  cards: { pos: [CARDS_HELD[0], 1.05, 0.52], look: CARDS_HELD },
  // both of these are picked up off the desk when focused: the view looks at where they are held
  canonet: { pos: [0.67, 0.965, 0.43], look: [0.67, 0.9, 0.08] },
  // the open album fills the view, its spine down the middle
  album: { pos: [ALBUM_HELD[0], 1.22, 0.78], look: ALBUM_HELD },
  // close enough on the receipt to read it; it is slid up and down, not seen whole
  receipt: { pos: [RECEIPT_HELD[0], 1.02, 0.5], look: RECEIPT_HELD },
  clock: { pos: [POS.clock[0], POS.clock[1], 0.28], look: [POS.clock[0], POS.clock[1], WALL_Z] },
  // square on to the framed photo where it stands, from the way it faces, close enough to see the faces
  portrait: { pos: [-0.54, 1.03, 0.53], look: [-0.83, 0.93, 0.0] },
  // down on the dice from in front, with room for them to fly
  dice: { pos: [POS.dice[0], 1.04, 0.52], look: [POS.dice[0], DESK.y + 0.03, POS.dice[2] - 0.01] },
  // the lamp with room above it, where the planets line up to be picked
  saturn: { pos: [POS.saturn[0], 1.0, 0.31], look: [POS.saturn[0], SATURN_GLOBE_Y + 0.045, POS.saturn[2]] },
};
