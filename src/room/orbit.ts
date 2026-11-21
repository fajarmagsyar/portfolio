// Looking around by hand. Dragging on the room turns the view about whatever the camera
// is looking at, and the wheel moves it nearer or farther. These are the values asked
// for; CameraRig eases towards them. When the Canonet is picked up, the same drag turns
// the camera in the hand instead (see objects/Canonet.tsx).
export const orbit = {
  yaw: 0,
  pitch: 0,
  zoom: 1,
  dragging: false,
  /** set while something in the room (an album page) has taken the drag for itself */
  locked: false,
};

export function resetOrbit() {
  orbit.yaw = 0;
  orbit.pitch = 0;
  orbit.zoom = 1;
}
