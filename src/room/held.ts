// While a cassette or a CD is held, a click anywhere but on it puts it back. The held thing, its
// pamphlet and its leaflet say "that click was on me" here; Room.tsx does the rest (see
// PutBackOnOutsideClick there).
export const held = { hit: false, heldAtDown: false };
