import * as THREE from "three";
import { FOCUS_FOV, POS } from "./layout";

// Where the Telecaster stands and how it is measured, shared by the guitar itself
// (objects/Guitar.tsx) and the camera that turns to look along it.

/** the stand's turn on the floor, and how the guitar rests in it: body in the cradle, neck leaning back */
export const STAND_YAW = 0.45;
export const REST = { pos: [0, 0.062, 0.168] as [number, number, number], lean: -0.4 };

// The guitar file lies flat on its back, face up (+y), with its length along x: the strap
// button at one end, the headstock at the other, 1.555 units from end to end. These numbers
// are in the file's own units.
const FILE = {
  scale: 0.99 / 1.555, // a real one is about 99 cm long
  bottomX: -0.7214, // strap-button end of the body
  axisZ: -0.0025, // centre line of the strings
  stringY: 0.0865, // height of the strings above the back
  nutX: 0.5502,
  saddleX: -0.49,
};
export const TELE = { scale: FILE.scale, bottomX: FILE.bottomX, axisZ: FILE.axisZ };

// Stood upright, the guitar is measured from the bottom of its body: +y towards the
// headstock, +x across the strings from the low E to the high one, +z out of its face. Metres.
const up = (x: number) => (x - FILE.bottomX) * FILE.scale;
export const NUT_Y = up(FILE.nutX);
export const SADDLE_Y = up(FILE.saddleX);
export const STRING_Z = FILE.stringY * FILE.scale;
export const LENGTH = 0.99;

// The frets are painted on the model's fingerboard, not built, and not quite where a ruler
// would put them. These are where they are: read off the texture, as distances from the nut.
const FRET_MARKS = [
  0, 0.0486, 0.0957, 0.1401, 0.1821, 0.2222, 0.26, 0.2956, 0.3296, 0.3618, 0.3921, 0.4209, 0.4482, 0.4741, 0.4985, 0.522, 0.5439, 0.5649, 0.5849, 0.6037, 0.6216, 0.6389,
  0.655, 0.6704,
];
/** height of each fret wire; [0] is the nut */
export const FRET_Y = FRET_MARKS.map((d) => NUT_Y - d * 1.1315 * FILE.scale);
export const FRETS = FRET_Y.length - 1;

/** The strings fan out from the nut to the saddles. Gap between neighbours at a given height. */
export const stringGap = (y: number) => {
  const t = Math.min(1, Math.max(0, (NUT_Y - y) / (NUT_Y - SADDLE_Y)));
  return 0.007 + (0.0104 - 0.007) * t;
};
/** x of string i (0 = low E) at a given height */
export const stringX = (i: number, y: number) => (i - 2.5) * stringGap(y);

/** The fret a finger at this height is holding: the one just towards the bridge from it. 0 = open, past the end of the board. */
export function fretAt(y: number) {
  if (y >= NUT_Y) return 0;
  for (let n = 1; n <= FRETS; n++) if (y > FRET_Y[n]) return n;
  return 0;
}
/** where a finger presses to hold fret n: just behind the wire */
export const fingerY = (n: number) => FRET_Y[n] + (FRET_Y[n - 1] - FRET_Y[n]) * 0.32;

const M = new THREE.Matrix4()
  .makeTranslation(...POS.guitar)
  .multiply(new THREE.Matrix4().makeRotationY(STAND_YAW))
  .multiply(new THREE.Matrix4().makeTranslation(...REST.pos))
  .multiply(new THREE.Matrix4().makeRotationX(REST.lean));

/** A point on the upright guitar, in the room. */
export const guitarToWorld = (x: number, y: number, z: number, out = new THREE.Vector3()) => out.set(x, y, z).applyMatrix4(M);

/** A direction on the upright guitar, in the room. */
export const guitarDir = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize().transformDirection(M);

type V3 = [number, number, number];
const centre = guitarToWorld(0, LENGTH / 2, 0.03);
const normal = new THREE.Vector3(0, 0, 1).transformDirection(M);
const across = new THREE.Vector3(1, 0, 0).transformDirection(M);
const spread = 2 * Math.tan(THREE.MathUtils.degToRad(FOCUS_FOV / 2));

/**
 * The camera for playing: square on to the face of the guitar. On a wide screen it is rolled
 * a quarter turn so the neck runs across the picture, headstock to the left and the low E at
 * the bottom, and the guitar fills the width. On an upright one the guitar is left standing.
 */
export function guitarView(aspect: number): { pos: V3; look: V3; up: V3 } {
  const wide = aspect > 1.05;
  const room = LENGTH + 0.1;
  const d = wide ? room / (spread * aspect) : Math.max(room / spread, 0.4 / (spread * aspect));
  const pos = centre.clone().addScaledVector(normal, d);
  return { pos: pos.toArray() as V3, look: centre.toArray() as V3, up: wide ? (across.toArray() as V3) : [0, 1, 0] };
}

/** where the lead goes in: the jack on the edge of the lower bout, and the way it points */
export const JACK = { at: [0.138, 0.135, 0.022] as V3, out: [0.82, -0.57, 0] as V3 };
