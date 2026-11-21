"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { jobs, type Job } from "@/content/data";
import { Interactive } from "../Interactive";
import { POS, SHELF } from "../layout";
import { useRoom } from "../store";
import { paper, useCanvasTexture, useFonts } from "../textures";

// Model: "Audio Cassettes (Low Poly)" by Mobius1 (CC BY 4.0). See CREDITS.md.
const CASSETTES = "/models/sk/cassettes.glb";

// Shown a little larger than life (a real cassette is 100 mm wide) so labels read from the desk.
const W = 0.118;

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
const tmp = new THREE.Quaternion();
// On the shelf a cassette stands on end like a book: its long top edge is the spine facing
// the room, the writing on it running downwards.
const SHELVED = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
const SHOWN = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.28, 0, 0));
const ease = (t: number) => t * t * (3 - 2 * t);

function Cassette({ job, index, shell }: { job: Job; index: number; shell: Shell }) {
  const fonts = useFonts();
  const ref = useRef<THREE.Group>(null);
  const focus = useRoom((s) => s.focus);
  const selected = useRoom((s) => s.selectedTape === job.id);
  const selectTape = useRoom((s) => s.selectTape);
  const hovered = useRef(false);
  /** 0 on the shelf, 1 held up to be read */
  const out = useRef(0);

  // a strip of masking tape with the workplace written on it: one on the face, one along the spine
  const label = (w: number, h: number, size0: number) => (ctx: CanvasRenderingContext2D) => {
    paper(ctx, w, h, "#ead9b0", job.from);
    if (!fonts) return;
    ctx.fillStyle = "#1d1712";
    ctx.textAlign = "center";
    let size = size0;
    ctx.font = `700 ${size}px ${fonts.hand}`;
    while (ctx.measureText(job.company).width > w - 36 && size > 24) {
      size -= 2;
      ctx.font = `700 ${size}px ${fonts.hand}`;
    }
    ctx.fillText(job.company, w / 2, h / 2 + size * 0.3);
  };
  const strip = useCanvasTexture(512, 96, label(512, 96, 70), [job, fonts]);
  const spine = useCanvasTexture(512, 60, label(512, 60, 50), [job, fonts]);

  const slotX = SHELF.x - SHELF.inner / 2 + SHELF.tape.start + index * SHELF.tape.pitch;
  // standing on its short edge, spine level with the others
  const rest = useMemo(() => new THREE.Vector3(slotX, POS.tapeRack[1] + W / 2 + 0.0005, POS.tapeRack[2] - shell.h / 2), [slotX, shell.h]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    out.current = Math.min(1, Math.max(0, out.current + (selected ? dt : -dt) / 0.75));
    {
      // first it is drawn straight out of the row, then it turns to face the chair as it comes up
      const draw = ease(Math.min(1, out.current / 0.42));
      const turn = ease(Math.max(0, (out.current - 0.42) / 0.58));
      const nudge = hovered.current && focus === "tapes" ? 0.014 : 0;
      target.pos.copy(rest);
      target.pos.z += nudge + draw * (shell.h + 0.03);
      tmp.copy(SHELVED);
      if (turn > 0) {
        target.pos.lerp(v.set(POS.tapeRack[0], POS.tapeRack[1] + 0.18, POS.tapeRack[2] + 0.15), turn);
        tmp.slerp(SHOWN, turn);
      }
      target.quat.copy(tmp);
    }
    const k = 1 - Math.exp(-dt * 14);
    g.position.lerp(target.pos, k);
    g.quaternion.slerp(target.quat, k);
  });

  const live = focus === "tapes";
  return (
    <group
      ref={ref}
      position={rest}
      quaternion={SHELVED}
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
      {/* along the top edge, which is the spine when it stands on the shelf */}
      <mesh position={[0, shell.h / 2 + 0.0006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 0.86, Math.min(shell.d * 0.8, W * 0.1)]} />
        <meshStandardMaterial map={spine} roughness={0.9} />
      </mesh>
    </group>
  );
}
const v = new THREE.Vector3();

/** Five cassettes standing in the shelf like books: one per job. */
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

useGLTF.preload(CASSETTES);
