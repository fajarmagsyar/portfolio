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
  { id: "mercury", about: "planet_mercury", tilt: 0, light: "#c9b49d" },
  { id: "venus", about: "planet_venus", tilt: 0.05, light: "#e8b665" },
  { id: "earth", about: "planet_earth", tilt: 0.41, light: "#6498e6" },
  { id: "mars", about: "planet_mars", tilt: 0.44, light: "#e86f42" },
  { id: "jupiter", about: "planet_jupiter", tilt: 0.05, light: "#e8a36f" },
  // kept upright here, so its bands run level with the lamp's own ring
  { id: "saturn", about: "planet_saturn", tilt: 0, light: "#e07d39" },
  { id: "uranus", about: "planet_uranus", tilt: 1.71, light: "#82d2da" },
  { id: "neptune", about: "planet_neptune", tilt: 0.49, light: "#547be6" },
];
