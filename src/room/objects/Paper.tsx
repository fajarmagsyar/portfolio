"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { certifications, education, links, skills, type Lang } from "@/content/data";
import { strings } from "@/content/strings";
import { useLang } from "@/state/lang";
import { Interactive } from "../Interactive";
import { POS } from "../layout";
import { useRoom } from "../store";
import { paper, rng, useCanvasTexture, useFonts, type Fonts } from "../textures";
import { Model } from "./Props";

/* ---------- framed education + certificates ---------- */

function drawDiploma(ctx: CanvasRenderingContext2D, w: number, h: number, lang: Lang, fonts: Fonts | null) {
  paper(ctx, w, h, "#efe4c8", 3);
  ctx.strokeStyle = "#8a6a2f";
  ctx.lineWidth = 6;
  ctx.strokeRect(26, 26, w - 52, h - 52);
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, w - 80, h - 80);
  if (!fonts) return;
  const t = strings[lang];
  ctx.textAlign = "center";
  ctx.fillStyle = "#8a6a2f";
  ctx.font = `26px ${fonts.screen}`;
  ctx.fillText(t.education.toUpperCase(), w / 2, 110);
  ctx.fillStyle = "#1d1712";
  ctx.font = `700 52px ${fonts.body}`;
  ctx.fillText(education.school, w / 2, 210);
  ctx.font = `500 34px ${fonts.body}`;
  ctx.fillText(education.degree[lang], w / 2, 272);
  ctx.font = `30px ${fonts.screen}`;
  ctx.fillStyle = "#4a3a22";
  ctx.fillText(`${education.years}   //   ${t.gpa} ${education.gpa}`, w / 2, 340);
  ctx.font = `700 64px ${fonts.hand}`;
  ctx.fillStyle = "#1f3d6b";
  ctx.fillText("Fajar Magsyar", w / 2, 440);
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

export function Frames() {
  const lang = useLang();
  const fonts = useFonts();
  const diploma = useCanvasTexture(900, 560, (c, w, h) => drawDiploma(c, w, h, lang, fonts), [lang, fonts]);
  const certs = useCanvasTexture(640, 900, (c, w, h) => drawCerts(c, w, h, lang, fonts), [lang, fonts]);
  return (
    // Stood on the desk and leaning back on the wall, the certificates in front of the degree.
    <Interactive target="frames" position={POS.frames} rotation={[-0.05, -0.4, 0]} scale={0.62}>
      {/* landscape frame: degree. The model's opening is 0.75 x 0.5 m before scaling. */}
      <group position={[-0.17, 0.2, 0]} rotation={[0, 0, -0.012]}>
        <Model asset="hanging_picture_frame_02" scale={0.6} position={[0, 0.017, 0]} />
        <mesh position={[0, 0, 0.012]}>
          <planeGeometry args={[0.375, 0.232]} />
          <meshStandardMaterial map={diploma} roughness={0.7} />
        </mesh>
      </group>
      {/* portrait frame: certificates */}
      <group position={[0.2, 0.25, 0.06]} rotation={[-0.06, -0.12, 0.015]}>
        <Model asset="hanging_picture_frame_01" scale={0.56} />
        <mesh position={[0, 0, 0.0105]}>
          <planeGeometry args={[0.268, 0.378]} />
          <meshStandardMaterial map={certs} roughness={0.7} />
        </mesh>
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

/* ---------- contact cards on the desk ---------- */

const CARDS = [
  { key: "email", title: "Email", value: links.email, href: `mailto:${links.email}`, color: "#f1e6cf", ink: "#b3341f" },
  { key: "github", title: "GitHub", value: links.github.label, href: links.github.url, color: "#e9e1d0", ink: "#1d1712" },
  { key: "linkedin", title: "LinkedIn", value: links.linkedin.label, href: links.linkedin.url, color: "#dfe8ee", ink: "#1f4f7a" },
  { key: "steam", title: "Steam", value: links.steam.label, href: links.steam.url, color: "#d8dde6", ink: "#22324a" },
] as const;

function Card({ card, index, fonts }: { card: (typeof CARDS)[number]; index: number; fonts: Fonts | null }) {
  const focus = useRoom((s) => s.focus);
  const tex = useCanvasTexture(
    512,
    320,
    (ctx, w, h) => {
      paper(ctx, w, h, card.color, index + 40);
      ctx.fillStyle = card.ink;
      ctx.fillRect(0, 0, 18, h);
      if (!fonts) return;
      ctx.font = `34px ${fonts.screen}`;
      ctx.fillText(card.title.toUpperCase(), 48, 80);
      ctx.fillStyle = "#1d1712";
      let size = 58;
      ctx.font = `700 ${size}px ${fonts.hand}`;
      while (ctx.measureText(card.value).width > w - 80 && size > 28) {
        size -= 2;
        ctx.font = `700 ${size}px ${fonts.hand}`;
      }
      ctx.fillText(card.value, 48, 190);
      ctx.strokeStyle = "rgba(60,40,20,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(48, 212);
      ctx.lineTo(w - 48, 212);
      ctx.stroke();
    },
    [card, fonts, index],
  );
  // fanned out like a hand of cards dropped on the desk
  const spread = index - (CARDS.length - 1) / 2;
  const live = focus === "cards";
  return (
    <mesh
      position={[spread * 0.085, 0.002 + index * 0.0012, -Math.abs(spread) * 0.012 + index * 0.012]}
      rotation={[-Math.PI / 2, 0, -spread * 0.2 + 0.08]}
      castShadow
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!live) return;
        e.stopPropagation();
        window.open(card.href, card.key === "email" ? "_self" : "_blank", "noopener");
      }}
      onPointerOver={() => {
        if (live) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (live) document.body.style.cursor = "";
      }}
    >
      <planeGeometry args={[0.15, 0.094]} />
      <meshStandardMaterial map={tex} roughness={0.8} />
    </mesh>
  );
}

export function Cards() {
  const fonts = useFonts();
  return (
    <Interactive target="cards" position={POS.cards}>
      {CARDS.map((c, i) => (
        <Card key={c.key} card={c} index={i} fonts={fonts} />
      ))}
    </Interactive>
  );
}
