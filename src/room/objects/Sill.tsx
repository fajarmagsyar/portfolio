"use client";

import { asset } from "@/asset";
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SILL } from "../layout";
import { useClone } from "./Guitar";

// Models: "Helmet Redbull - Max Verstappen" by Maubian and "Nintendo DS Lite" by Cianon
// (both CC BY 4.0). See CREDITS.md.
const HELMET = asset("/models/sk/helmet_redbull.glb");
const DS = asset("/models/sk/nintendo_ds.glb");

/**
 * A model stood on a surface: scaled so its longest side is `size` metres, centred over
 * its spot, with its lowest point resting on it, whatever units and origin its file used.
 */
function Stood({ url, size, position, rotation }: { url: string; size: number; position: [number, number, number]; rotation: [number, number, number] }) {
  const model = useClone(url);
  const { scale, offset } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const dim = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const k = size / Math.max(dim.x, dim.y, dim.z);
    return { scale: k, offset: new THREE.Vector3(-c.x * k, -box.min.y * k, -c.z * k) };
  }, [model, size]);
  return (
    <group position={position} rotation={rotation}>
      <primitive object={model} scale={scale} position={offset} />
    </group>
  );
}

/** Things kept on the window sill, right of the TV: a racing helmet and a DS Lite. */
export function SillDecor() {
  return (
    <group>
      <Stood url={HELMET} size={0.12} position={[0.56, SILL.y, SILL.z + 0.1]} rotation={[0, Math.PI - 0.5, 0]} />
      <Stood url={DS} size={0.125} position={[0.40, SILL.y, SILL.z + 0.08]} rotation={[0, 0.35, 0]} />
    </group>
  );
}
useGLTF.preload(HELMET);
useGLTF.preload(DS);
