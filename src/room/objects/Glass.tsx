"use client";

import * as THREE from "three";
import { useCanvasTexture } from "../textures";

/**
 * What makes a print look like it is behind glass, laid over it: the shadow the frame's lip
 * throws on the paper (deeper along the top and left, where the light comes from), a faint
 * sheen across the pane, soft slanted streaks of reflection, and the glass itself, which only
 * shows as what it mirrors. `w` and `h` are the opening, `z` is the paper's depth.
 */
export function Glass({ w, h, z }: { w: number; h: number; z: number }) {
  const px = 512;
  const py = Math.round((px * h) / w);
  const shade = useCanvasTexture(
    px,
    py,
    (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      const edge = (x0: number, y0: number, x1: number, y1: number, a: number) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, cw, ch);
      };
      edge(0, 0, 0, ch * 0.07, 0.5); // top
      edge(0, 0, cw * 0.05, 0, 0.42); // left
      edge(0, ch, 0, ch * 0.95, 0.22); // bottom
      edge(cw, 0, cw * 0.95, 0, 0.22); // right
    },
    [],
  );
  const glare = useCanvasTexture(
    px,
    py,
    (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      const sheen = ctx.createLinearGradient(0, 0, cw, ch);
      sheen.addColorStop(0, "rgba(255,244,228,0.10)");
      sheen.addColorStop(0.6, "rgba(255,244,228,0.015)");
      sheen.addColorStop(1, "rgba(255,244,228,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, cw, ch);
      // two bands of reflected light, slanted
      const band = (c: number, wid: number, a: number) => {
        const g = ctx.createLinearGradient(cw * (c - wid), 0, cw * (c + wid) + ch * 0.45, ch);
        g.addColorStop(0, "rgba(255,246,232,0)");
        g.addColorStop(0.5, `rgba(255,246,232,${a})`);
        g.addColorStop(1, "rgba(255,246,232,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, cw, ch);
      };
      band(0.18, 0.1, 0.2);
      band(0.46, 0.035, 0.12);
    },
    [],
  );
  return (
    <>
      <mesh position={[0, 0, z]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={shade} transparent depthWrite={false} />
      </mesh>
      {/* the pane, a hair in front: clear, and polished enough to mirror the room */}
      <mesh position={[0, 0, z + 0.006]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial color="#e6f2f4" transparent opacity={0.07} roughness={0.02} metalness={0} clearcoat={1} clearcoatRoughness={0.02} envMapIntensity={2.2} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, z + 0.007]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={glare} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
