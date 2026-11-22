// The site may be served from a sub-folder (GitHub Pages serves a project at /<repo>/), so
// anything that points at a file in /public or at a page of the site starts from the base path
// the build was given (NEXT_PUBLIC_BASE_PATH; empty when the site is at the root).

import * as THREE from "three";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** A site-absolute path ("/models/x.glb") with the base path in front. Full URLs, data and blob URLs are left alone. */
export function asset<T extends string | undefined>(path: T): T {
  if (!path || !BASE_PATH || !path.startsWith("/") || path.startsWith("//") || path.startsWith(BASE_PATH + "/")) return path;
  return (BASE_PATH + path) as T;
}

if (typeof window !== "undefined") THREE.DefaultLoadingManager.setURLModifier((url) => asset(url));
