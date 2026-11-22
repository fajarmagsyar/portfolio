// Looking around by hand. Dragging on the room turns the view about whatever the camera
// is looking at, and the wheel moves it nearer or farther. These are the values asked
// for; CameraRig eases towards them. When the Canonet is picked up, the same drag turns
// the camera in the hand instead (see objects/Canonet.tsx).
export const orbit = {
  yaw: 0,
  pitch: 0,
  zoom: 1,
  /** how fast the view was moving when the finger or mouse was lifted */
  vYaw: 0,
  vPitch: 0,
  dragging: false,
  /** set while something in the room (an album page) has taken the drag for itself */
  locked: false,
};

export type OrbitLimits = { yaw: number; pitch: [number, number]; zoom: [number, number] };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** After a drag, let the view coast to a stop instead of halting dead. */
export function glideOrbit(dt: number, limits: OrbitLimits | null) {
  if (!limits || orbit.dragging) return;
  if (Math.abs(orbit.vYaw) + Math.abs(orbit.vPitch) < 0.001) {
    orbit.vYaw = 0;
    orbit.vPitch = 0;
    return;
  }
  orbit.yaw = clamp(orbit.yaw + orbit.vYaw * dt, -limits.yaw, limits.yaw);
  orbit.pitch = clamp(orbit.pitch + orbit.vPitch * dt, limits.pitch[0], limits.pitch[1]);
  const decay = Math.exp(-dt * 5);
  orbit.vYaw *= decay;
  orbit.vPitch *= decay;
}

export function resetOrbit() {
  orbit.yaw = 0;
  orbit.pitch = 0;
  orbit.zoom = 1;
  orbit.vYaw = 0;
  orbit.vPitch = 0;
}
