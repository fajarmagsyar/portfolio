// The shadows are drawn once (see ShadowBake in Room.tsx), so a thing that moves needs to ask for
// them to be drawn again while it does. The mouse, the dice and the contact cards do.

export const shadowLive = { until: 0 };

/** Call every frame something that casts a shadow is moving: the shadows are redrawn for a moment after. */
export function touchShadow(ms = 120) {
  shadowLive.until = Math.max(shadowLive.until, performance.now() + ms);
}
