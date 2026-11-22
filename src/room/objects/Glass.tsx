"use client";

import * as THREE from "three";
import { useCanvasTexture } from "../textures";

/**
 * What makes a print look like it is behind glass, laid over it: the shadow the frame's lip
 * throws on the paper (deeper along the top and left, where the light comes from), a faint
 * sheen across the pane, soft slanted streaks of reflection, and the glass itself, which only
 * shows as what it mirrors. `w` and `h` are the opening, `z` is the paper's depth.
 */
export function Glass({ w, h, z, opacity = 0.035, glare: glareOpacity = 0.45, shade: shadeOpacity = 1 }: { w: number; h: number; z: number; opacity?: number; glare?: number; shade?: number }) {
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
      edge(0, 0, 0, ch * 0.07, 0.32); // top
      edge(0, 0, cw * 0.05, 0, 0.26); // left
      edge(0, ch, 0, ch * 0.95, 0.12); // bottom
      edge(cw, 0, cw * 0.95, 0, 0.12); // right
    },
    [],
  );
  const glare = useCanvasTexture(
    px,
    py,
    (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      const sheen = ctx.createLinearGradient(0, 0, cw, ch);
      sheen.addColorStop(0, "rgba(255,244,228,0.05)");
      sheen.addColorStop(0.6, "rgba(255,244,228,0.008)");
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
      band(0.18, 0.1, 0.08);
      band(0.46, 0.035, 0.05);
    },
    [],
  );
  return (
    <>
      <mesh position={[0, 0, z]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={shade} transparent opacity={shadeOpacity} depthWrite={false} />
      </mesh>
      {/* the pane, a hair in front: clear, and polished enough to mirror the room */}
      <mesh position={[0, 0, z + 0.006]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial color="#f4fbfc" transparent opacity={opacity} roughness={0.01} metalness={0} clearcoat={1} clearcoatRoughness={0.015} envMapIntensity={1.1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, z + 0.007]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={glare} transparent opacity={glareOpacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
