// Downloads the CC0 assets used by the 3D room from Poly Haven (https://polyhaven.com, CC0).
// Run: node scripts/fetch-assets.mjs
// Files land in public/models/<id>/ and public/textures/<id>/. See CREDITS.md.
// It also builds the photo seen through the window from a Poly Haven panorama.

import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = { "User-Agent": "portfolio-asset-fetch" };
const RES = "1k";

const MODELS = [
  "Television_01",
  "gaming_console",
  "gamepad",
  "portable_cassette_player",
  "desk_lamp_arm_01",
  "potted_plant_02",
  "hanging_picture_frame_01",
  "hanging_picture_frame_02",
  "painted_wooden_table",
  // what stands around the desk, so the room is not bare when the view is turned
  "wooden_bookshelf_worn",
  "book_encyclopedia_set_01",
  "boombox",
  "mid_century_lounge_chair",
  "side_table_01",
  "vintage_wooden_drawer_01",
  "wall_clock",
  "potted_plant_04",
  "ceramic_vase_03",
  "vintage_oil_lamp",
];

// id -> which maps to fetch
const TEXTURES = ["wood_floor", "white_plaster_02"];
const MAPS = { Diffuse: "diff", nor_gl: "nor", Rough: "rough" };

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  if (await exists(dest)) return false;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function files(id) {
  const res = await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} files/${id}`);
  return res.json();
}

for (const id of MODELS) {
  const f = await files(id);
  const g = f.gltf?.[RES]?.gltf;
  if (!g) {
    console.warn(`! ${id}: no ${RES} gltf`);
    continue;
  }
  const dir = path.join(root, "public", "models", id);
  await download(g.url, path.join(dir, `${id}.gltf`));
  for (const [rel, inc] of Object.entries(g.include ?? {})) {
    await download(inc.url, path.join(dir, rel));
  }
  console.log(`model   ${id}`);
}

for (const id of TEXTURES) {
  let f;
  try {
    f = await files(id);
  } catch (e) {
    console.warn(`! ${id}: ${e.message}`);
    continue;
  }
  const dir = path.join(root, "public", "textures", id);
  for (const [map, short] of Object.entries(MAPS)) {
    const jpg = f[map]?.[RES]?.jpg;
    if (!jpg) {
      console.warn(`! ${id}: no ${map}`);
      continue;
    }
    await download(jpg.url, path.join(dir, `${short}.jpg`));
  }
  console.log(`texture ${id}`);
}

// The view through the window: a crop of the "Vignaioli Night" panorama (CC0), cut to the
// part of the horizon the room can see. The angles here must match VIEW in src/room/objects/Shell.tsx:
// 64.8 degrees either side of the lit alley, from 25 degrees below the horizon to 45 above.
{
  const id = "vignaioli_night";
  const dest = path.join(root, "public", "textures", "window", `${id}.jpg`);
  if (!(await exists(dest))) {
    const { default: sharp } = await import("sharp");
    const f = await files(id);
    const res = await fetch(f.tonemapped.url, { headers: UA });
    if (!res.ok) throw new Error(`${res.status} ${f.tonemapped.url}`);
    const pano = sharp(Buffer.from(await res.arrayBuffer()));
    const { width: W, height: H } = await pano.metadata();
    await mkdir(path.dirname(dest), { recursive: true });
    await pano
      .extract({ left: Math.round(W * 0.34), top: Math.round(H * 0.25), width: Math.round(W * 0.36), height: Math.round(H * (70 / 180)) })
      .resize(2560)
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(dest);
  }
  console.log(`window  ${id}`);
}
