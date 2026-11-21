"use client";

import { certifications, education, skills, type Lang } from "@/content/data";
import { strings, type StringKey } from "@/content/strings";
import { useLang } from "@/state/lang";
import { useEffect, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { hint } from "../hint";
import { Interactive } from "../Interactive";
import { POS } from "../layout";
import { useRoom } from "../store";
import { paper, rng, useCanvasTexture, useFonts, type Fonts } from "../textures";
import { Glass } from "./Glass";
import { Model } from "./Props";

/* ---------- framed education + certificates ---------- */

/** Loads an image for painting into a canvas; null until it has arrived. */
function useImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const el = new Image();
    let alive = true;
    el.onload = () => alive && setImg(el);
    el.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}

/** A pen signature: a quick loop-and-trail, different for each seed. Drawn, so it is nobody's in particular. */
function scribble(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number) {
  const r = rng(seed);
  ctx.save();
  ctx.strokeStyle = "#1c2f55";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  let px = x;
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const nx = x + ((i + 1) / steps) * w;
    const up = 22 + r() * 46;
    ctx.bezierCurveTo(px + (nx - px) * 0.2, y - up, px + (nx - px) * 0.55, y + 14 + r() * 16, nx, y - 4 + r() * 10);
    px = nx;
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + 16);
  ctx.quadraticCurveTo(x + w * 0.5, y + 6 + r() * 10, x + w * 1.04, y + 2);
  ctx.stroke();
  ctx.restore();
}

function drawDiploma(ctx: CanvasRenderingContext2D, w: number, h: number, lang: Lang, fonts: Fonts | null, logo: HTMLImageElement | null) {
  paper(ctx, w, h, "#f2ead3", 3);
  if (!fonts) return;
  const t = strings[lang];
  const cx = w / 2;
  const caps = (text: string, y: number, size: number, weight = 500, spacing = 3, color = "#1d1a17") => {
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${fonts.serif}`;
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text.toUpperCase(), cx, y);
    ctx.letterSpacing = "0px";
  };
  const id = lang === "id";
  // the name of the university, in blackletter, shrunk until it sits inside the margins
  let size = 128;
  ctx.textAlign = "center";
  ctx.fillStyle = "#2a2623";
  ctx.font = `700 ${size}px ${fonts.black}`;
  while (ctx.measureText(education.school).width > w * 0.84 && size > 60) {
    size -= 4;
    ctx.font = `700 ${size}px ${fonts.black}`;
  }
  ctx.fillText(education.school, cx, 200);
  caps(id ? "Dengan ini menyatakan bahwa" : "This is to certify that", 318, 31);
  caps("Fajar Magsyar", 402, 62, 700, 4);
  caps(id ? "Telah menyelesaikan pendidikan dan berhak atas gelar" : "Has completed the course of study and is awarded the degree of", 478, 29);
  caps(education.degree[lang], 548, 42, 700, 3);
  caps(`${t.gpa} ${education.gpa}`, 604, 30);
  caps(`${id ? "Masa studi" : "Period of study"} ${education.years}`, 650, 30);
  // the school's own mark stands where a seal would, as it is
  if (logo) {
    const s = 104;
    const lh = (s * logo.height) / logo.width;
    ctx.save();
    ctx.shadowColor = "rgba(40,25,10,0.35)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.drawImage(logo, cx - s / 2, 784 - lh / 2, s, lh);
    ctx.restore();
  }
  // two signatures to either side of it: what each signs for stays under the line
  const sig = (x: number, label: string | null, seed: number) => {
    scribble(ctx, x - 130, 786, 260, seed);
    ctx.fillStyle = "#1d1a17";
    ctx.fillRect(x - 150, 806, 300, 2);
    if (label) caps(label, 838, 21, 500, 2);
  };
  ctx.textAlign = "center";
  const sx = [w * 0.2, w * 0.8];
  sig(sx[0], null, 11);
  sig(sx[1], null, 23);
}

function drawCerts(ctx: CanvasRenderingContext2D, w: number, h: number, lang: Lang, fonts: Fonts | null) {
  paper(ctx, w, h, "#f3ead4", 5);
  if (!fonts) return;
  ctx.fillStyle = "#8a6a2f";
  ctx.font = `30px ${fonts.screen}`;
  ctx.textAlign = "center";
  ctx.fillText(strings[lang].certs.toUpperCase(), w / 2, 92);
  ctx.textAlign = "left";
  certifications.forEach((c, i) => {
    const y = 180 + i * 142;
    ctx.fillStyle = "#b3341f";
    ctx.font = `34px ${fonts.screen}`;
    ctx.fillText(String(c.year), 56, y);
    ctx.fillStyle = "#1d1712";
    ctx.font = `700 38px ${fonts.body}`;
    ctx.fillText(c.title, 56, y + 46);
    ctx.fillStyle = "#4a3a22";
    ctx.font = `400 26px ${fonts.body}`;
    ctx.fillText(c.issuer, 56, y + 82);
    ctx.strokeStyle = "rgba(60,40,20,0.2)";
    ctx.beginPath();
    ctx.moveTo(56, y + 104);
    ctx.lineTo(w - 56, y + 104);
    ctx.stroke();
  });
}

/** From across the room each frame is named for what is in it, rather than both as "frames". */
const named = (tip: StringKey) => ({
  // on every move, not only on arriving: the pointer can come onto one frame straight off the
  // other, where they overlap, and the name has to follow it
  onPointerMove: (e: ThreeEvent<PointerEvent>) => {
    const s = useRoom.getState();
    if (!s.booted || s.focus !== null) return;
    // the frame in front is the one being pointed at
    e.stopPropagation();
    hint(tip);
    s.setHover("frames");
  },
  onPointerOut: () => {
    const s = useRoom.getState();
    if (s.tip === tip) hint(null);
    // the move above stops the event, so the wrapper never hears of the pointer leaving: it is
    // cleared here, or the name would stay on and follow the pointer about the room
    if (s.hover === "frames") s.setHover(null);
  },
});

export function Frames() {
  const lang = useLang();
  const fonts = useFonts();
  const logo = useImage("/art/diploma/unsy-logo.webp");
  const diploma = useCanvasTexture(1440, 891, (c, w, h) => drawDiploma(c, w, h, lang, fonts, logo), [lang, fonts, logo]);
  const certs = useCanvasTexture(640, 900, (c, w, h) => drawCerts(c, w, h, lang, fonts), [lang, fonts]);
  // Both stand on the desk, each on its own bottom edge and tipped back a little: the tall
  // one behind and to the right, the wide one in front of it and to the left, overlapping.
  // Positions are in the group's own space (it is drawn at 0.62 of the models' size); the
  // inner offsets lift each frame by exactly the distance from its middle to its bottom edge.
  return (
    <Interactive target="frames" position={POS.frames} scale={0.62}>
      {/* portrait frame: certificates. The model is 0.594 x 0.84 m before scaling. */}
      <group position={[0.2, 0, -0.03]} rotation={[0, -0.22, 0]} {...named("tip_certs")}>
        <group rotation={[-0.11, 0, 0]}>
          <group position={[0, 0.2355, 0]}>
            <Model asset="hanging_picture_frame_01" scale={0.56} />
            <mesh position={[0, 0, 0.0105]}>
              <planeGeometry args={[0.268, 0.378]} />
              <meshStandardMaterial map={certs} color="#a9a297" roughness={0.9} />
            </mesh>
            <Glass w={0.268} h={0.378} z={0.0112} />
          </group>
        </group>
      </group>
      {/* landscape frame: degree. The model's opening is 0.75 x 0.5 m before scaling. */}
      <group position={[-0.17, 0, 0.06]} rotation={[0, 0.1, 0]} {...named("tip_degree")}>
        <group rotation={[-0.14, 0, 0]}>
          <group position={[0, 0.151, 0]}>
            <Model asset="hanging_picture_frame_02" scale={0.6} position={[0, 0.017, 0]} />
            <mesh position={[0, 0, 0.012]}>
              <planeGeometry args={[0.375, 0.232]} />
              <meshStandardMaterial map={diploma} color="#b8b1a6" roughness={0.9} />
            </mesh>
            <Glass w={0.375} h={0.232} z={0.0127} />
          </group>
        </group>
      </group>
    </Interactive>
  );
}

/* ---------- sticky notes: skills ---------- */

const NOTE_COLORS = ["#f6d860", "#f4a6b0", "#a9dcc0", "#f7b267", "#bcd4f2"];
const NOTE = 0.082;

function StickyNote({ text, index, fonts }: { text: string; index: number; fonts: Fonts | null }) {
  const r = rng(index * 31 + 7);
  const color = NOTE_COLORS[index % NOTE_COLORS.length];
  const tex = useCanvasTexture(
    192,
    192,
    (ctx, w, h) => {
      paper(ctx, w, h, color, index + 20);
      // the gummed strip along the top is a shade darker
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, w, 30);
      if (!fonts) return;
      ctx.fillStyle = "#2a2018";
      ctx.textAlign = "center";
      const words = text.split(" ");
      let size = 54;
      ctx.font = `700 ${size}px ${fonts.hand}`;
      while (Math.max(...words.map((x) => ctx.measureText(x).width)) > w * 0.84 && size > 26) {
        size -= 2;
        ctx.font = `700 ${size}px ${fonts.hand}`;
      }
      words.forEach((word, i) => ctx.fillText(word, w / 2, h / 2 + 22 + (i - (words.length - 1) / 2) * size * 0.9));
    },
    [text, color, fonts, index],
  );
  const cols = 5;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = (col - (cols - 1) / 2) * (NOTE + 0.012) + (r() - 0.5) * 0.012 + (row === 2 ? NOTE / 2 : 0);
  const y = (1 - row) * (NOTE + 0.012) + (r() - 0.5) * 0.012;
  return (
    <mesh position={[x, y, 0.001 + index * 0.0002]} rotation={[0.03, 0, (r() - 0.5) * 0.22]} castShadow>
      <planeGeometry args={[NOTE, NOTE]} />
      <meshStandardMaterial map={tex} roughness={0.9} />
    </mesh>
  );
}

export function Notes() {
  const fonts = useFonts();
  return (
    <Interactive target="notes" position={POS.notes}>
      {skills.map((sk, i) => (
        <StickyNote key={sk} text={sk} index={i} fonts={fonts} />
      ))}
    </Interactive>
  );
}
