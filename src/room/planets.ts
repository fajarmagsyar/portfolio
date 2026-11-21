import type { StringKey } from "@/content/strings";

export type PlanetId = "mercury" | "venus" | "earth" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune";

type Planet = {
  id: PlanetId;
  /** its name, a few figures and one thing worth knowing, shown beside the cursor: a title and then lines */
  about: StringKey;
  /** how far its axis leans, in radians */
  tilt: number;
  /** the colour it throws on the desk as a lamp */
  light: string;
};

/** The planets the lamp's globe can be, in order from the Sun. Their surfaces are in objects/Planets.tsx. */
export const PLANETS: Planet[] = [
  { id: "mercury", about: "planet_mercury", tilt: 0, light: "#d9c4ae" },
  { id: "venus", about: "planet_venus", tilt: 0.05, light: "#ffc56e" },
  { id: "earth", about: "planet_earth", tilt: 0.41, light: "#6fa8ff" },
  { id: "mars", about: "planet_mars", tilt: 0.44, light: "#ff7a45" },
  { id: "jupiter", about: "planet_jupiter", tilt: 0.05, light: "#ffb37a" },
  // kept upright here, so its bands run level with the lamp's own ring
  { id: "saturn", about: "planet_saturn", tilt: 0, light: "#ff8a3c" },
  { id: "uranus", about: "planet_uranus", tilt: 1.71, light: "#8fe6ee" },
  { id: "neptune", about: "planet_neptune", tilt: 0.49, light: "#5b86ff" },
];
