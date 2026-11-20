"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { jobs, type Job } from "@/content/data";
import { Interactive } from "../Interactive";
import { POS, WALL_Z } from "../layout";
import { useRoom } from "../store";
import { paper, useCanvasTexture, useFonts } from "../textures";
import { HitBox, Model } from "./Props";

// Model: "Audio Cassettes (Low Poly)" by Mobius1 (CC BY 4.0). See CREDITS.md.
const CASSETTES = "/models/sk/cassettes.glb";

// Shown a little larger than life (a real cassette is 100 mm wide) so labels read from the desk.
const W = 0.118;
const GAP = 0.128;

type Shell = { geometry: THREE.BufferGeometry; material: THREE.Material; matrix: THREE.Matrix4; h: number; d: number };

/**
 * The file holds three cassettes scattered on a table. This takes each one's geometry as
 * it is (the file stores it compressed, so it is not edited) and works out a matrix that
 * centres it and turns it so width is x, height is y and thickness is z.
 */
function useShells(): Shell[] {
  const { scene } = useGLTF(CASSETTES);
  return useMemo(() => {
    const out: Shell[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const box = new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position as THREE.BufferAttribute);
      const size = box.getSize(new THREE.Vector3()).toArray();
      const centre = box.getCenter(new THREE.Vector3());
      if (!(size[0] > 0 && size[1] > 0 && size[2] > 0)) return;
      // longest local axis becomes x, the middle one y, the shortest z
      const order = [0, 1, 2].sort((p, q) => size[q] - size[p]);
      const basis = order.map((axis) => new THREE.Vector3().setComponent(axis, 1));
      const rot = new THREE.Matrix4().makeBasis(basis[0], basis[1], basis[2]).transpose();
      if (rot.determinant() < 0) rot.premultiply(new THREE.Matrix4().makeScale(1, 1, -1));
      const k = W / size[order[0]];
      const matrix = new THREE.Matrix4()
        .makeScale(k, k, k)
        .multiply(rot)
        .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z));
      out.push({ geometry: m.geometry, material: m.material as THREE.Material, matrix, h: size[order[1]] * k, d: size[order[2]] * k });
    });
    return out;
  }, [scene]);
}

const target = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), euler: new THREE.Euler() };
const LEAN = -0.24;

function Cassette({ job, index, shell }: { job: Job; index: number; shell: Shell }) {
  const fonts = useFonts();
  const ref = useRef<THREE.Group>(null);
  const focus = useRoom((s) => s.focus);
  const selected = useRoom((s) => s.selectedTape === job.id);
  const loaded = useRoom((s) => s.loadedTape === job.id);
  const selectTape = useRoom((s) => s.selectTape);
  const hovered = useRef(false);

  // a strip of masking tape with the workplace written on it
  const strip = useCanvasTexture(
    512,
    96,
    (ctx, w, h) => {
      paper(ctx, w, h, "#ead9b0", job.from);
      if (!fonts) return;
      ctx.fillStyle = "#1d1712";
      ctx.textAlign = "center";
      let size = 70;
      ctx.font = `700 ${size}px ${fonts.hand}`;
      while (ctx.measureText(job.company).width > w - 36 && size > 30) {
        size -= 2;
        ctx.font = `700 ${size}px ${fonts.hand}`;
      }
      ctx.fillText(job.company, w / 2, h / 2 + size * 0.3);
    },
    [job, fonts],
  );

  const slotX = POS.tapeRack[0] + (index - (jobs.length - 1) / 2) * GAP;
  // leaning against the wall at the back of the desk
  const restY = POS.tapeRack[1] + (shell.h / 2) * Math.cos(LEAN) + 0.002;
  const restZ = WALL_Z + 0.03 + (shell.h / 2) * Math.sin(-LEAN) + shell.d / 2;

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (loaded) {
      // lying on the player, label up
      target.pos.set(POS.cassette[0] + 0.005, POS.cassette[1] + 0.05, POS.cassette[2] + 0.004);
      target.euler.set(-Math.PI / 2, 0, 0.06);
    } else if (selected) {
      target.pos.set(slotX, POS.tapeRack[1] + 0.13, POS.tapeRack[2] + 0.26);
      target.euler.set(-0.34, 0, 0);
    } else {
      const lift = hovered.current && focus === "tapes" ? 0.012 : 0;
      target.pos.set(slotX, restY + lift, restZ);
      target.euler.set(LEAN, 0, 0);
    }
    target.quat.setFromEuler(target.euler);
    const k = 1 - Math.exp(-dt * 7);
    g.position.lerp(target.pos, k);
    g.quaternion.slerp(target.quat, k);
  });

  const live = focus === "tapes";
  return (
    <group
      ref={ref}
      position={[slotX, restY, restZ]}
      rotation={[LEAN, 0, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!live) return;
        e.stopPropagation();
        selectTape(selected ? null : job.id);
      }}
      onPointerOver={(e) => {
        if (!live) return;
        e.stopPropagation();
        hovered.current = true;
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        hovered.current = false;
        if (live) document.body.style.cursor = "";
      }}
    >
      <mesh geometry={shell.geometry} material={shell.material} matrix={shell.matrix} matrixAutoUpdate={false} castShadow receiveShadow />
      <mesh position={[0, shell.h * 0.33, shell.d / 2 + 0.0006]} rotation={[0, 0, (index % 2 ? -1 : 1) * 0.025]}>
        <planeGeometry args={[W * 0.8, W * 0.15]} />
        <meshStandardMaterial map={strip} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Five cassettes leaning against the wall: one per job. */
export function TapeRack() {
  const shells = useShells();
  if (shells.length === 0) return null;
  return (
    <Interactive target="tapes">
      {jobs.map((job, i) => (
        <Cassette key={job.id} job={job} index={i} shell={shells[i % shells.length]} />
      ))}
    </Interactive>
  );
}

/** Portable cassette player lying flat on the desk (Poly Haven, CC0). */
export function CassettePlayer() {
  return (
    <Interactive target="cassette">
      <group position={[POS.cassette[0], POS.cassette[1] + 0.021, POS.cassette[2]]} rotation={[-Math.PI / 2, 0, 0.06]}>
        <Model asset="portable_cassette_player" />
      </group>
      <HitBox position={[POS.cassette[0], POS.cassette[1] + 0.03, POS.cassette[2]]} size={[0.2, 0.06, 0.19]} />
    </Interactive>
  );
}

useGLTF.preload(CASSETTES);
