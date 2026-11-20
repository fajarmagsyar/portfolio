"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { projects, type Lang, type Project } from "@/content/data";
import { strings } from "@/content/strings";
import { useLang } from "@/state/lang";
import { Interactive } from "../Interactive";
import { POS, SILL } from "../layout";
import { useRoom } from "../store";
import { rng, useCanvasTexture, useFonts, wrap, type Fonts } from "../textures";
import { useClone } from "./Guitar";
import { HitBox } from "./Props";

// Models: see CREDITS.md.
//  - "CD + Jewel Case" by blue man group (CC BY 4.0); its cover insert is replaced here
//  - "Sony Discman D-121 Final" by Jacques C. Valentin (CC BY 4.0)
const CASE = "/models/sk/cd_case.glb";
const DISCMAN = "/models/sk/discman.glb";

// The case file is about 2 units tall; a jewel case is 125 mm.
const CASE_SCALE = 0.125 / 1.99;
const SPACING = 0.165;

function drawCover(ctx: CanvasRenderingContext2D, w: number, h: number, p: Project, index: number, lang: Lang, fonts: Fonts | null) {
  const r = rng(index * 97 + 11);
  ctx.fillStyle = p.disc;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  for (let i = 0; i < 9; i++) {
    ctx.lineWidth = 2 + r() * 10;
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.66, 40 + i * 46, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!fonts) return;
  const t = strings[lang];
  ctx.fillStyle = "#f4ead6";
  ctx.font = `150px ${fonts.screen}`;
  ctx.fillText(String(index + 1).padStart(2, "0"), w * 0.08, h * 0.34);
  ctx.font = `700 42px ${fonts.body}`;
  wrap(ctx, p.name ?? t.empty_slot.toUpperCase(), w * 0.84).forEach((line, i) => ctx.fillText(line, w * 0.08, h * 0.5 + i * 48));
  ctx.font = `26px ${fonts.screen}`;
  ctx.fillStyle = "rgba(244,234,214,0.8)";
  ctx.fillText(p.name ? (p.year ?? "") : "PROTOTYPE", w * 0.08, h * 0.93);
}

const target = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), euler: new THREE.Euler() };

function JewelCase({ project, index }: { project: Project; index: number }) {
  const lang = useLang();
  const fonts = useFonts();
  const ref = useRef<THREE.Group>(null);
  const scene = useClone(CASE);
  const focus = useRoom((s) => s.focus);
  const selected = useRoom((s) => s.selectedCd === project.id);
  const selectCd = useRoom((s) => s.selectCd);
  const hovered = useRef(false);

  const cover = useCanvasTexture(512, 512, (ctx, w, h) => drawCover(ctx, w, h, project, index, lang, fonts), [project, index, lang, fonts]);

  // swap the printed insert for this project's cover, and leave the loose disc out
  useMemo(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === "Cover") {
        const own = mat.clone();
        own.map = cover;
        m.material = own;
      }
      if (mat.name === "Material.001" || mat.name === "Material.002") m.visible = false;
    });
  }, [scene, cover]);

  const x = SILL.x0 + 0.1 + index * SPACING;
  const rest = useMemo(() => new THREE.Vector3(x, SILL.y, SILL.z), [x]);
  const turn = [-0.12, 0.08, -0.05, 0.1][index % 4];

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    if (selected) {
      target.pos.set(POS.cdStack[0], SILL.y + 0.1, SILL.z + 0.5);
      target.euler.set(-0.1, 0, 0);
    } else {
      target.pos.copy(rest);
      if (hovered.current && focus === "cds") target.pos.y += 0.015;
      target.euler.set(0, turn, 0);
    }
    target.quat.setFromEuler(target.euler);
    const k = 1 - Math.exp(-dt * 7);
    g.position.lerp(target.pos, k);
    g.quaternion.slerp(target.quat, k);
  });

  const live = focus === "cds";
  return (
    <group
      ref={ref}
      position={rest}
      rotation={[0, turn, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!live) return;
        e.stopPropagation();
        selectCd(selected ? null : project.id);
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
      {/* in the file the case stands open with its spine along z; turn the cover to face the room */}
      <group rotation={[0, -Math.PI / 2, 0]} scale={CASE_SCALE}>
        <primitive object={scene} position={[0.11, -0.05, -0.54]} />
      </group>
    </group>
  );
}

/** Jewel cases standing on the window sill: one per project. */
export function CdStack() {
  return (
    <Interactive target="cds">
      {projects.map((p, i) => (
        <JewelCase key={p.id} project={p} index={i} />
      ))}
    </Interactive>
  );
}

/** The Discman with its headphones, on the desk. */
export function CdPlayer() {
  const scene = useClone(DISCMAN);
  // the player body is 24 units wide in the file; the real one is about 13 cm
  const s = 0.13 / 24;
  return (
    <Interactive target="cd">
      <group position={POS.cdPlayer} rotation={[0, -0.3, 0]}>
        <primitive object={scene} scale={s} />
      </group>
      <HitBox position={[POS.cdPlayer[0], POS.cdPlayer[1] + 0.04, POS.cdPlayer[2]]} size={[0.2, 0.08, 0.2]} />
    </Interactive>
  );
}

useGLTF.preload(CASE);
useGLTF.preload(DISCMAN);
