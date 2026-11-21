"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { pick, pluck, retune, strum } from "@/audio/guitar";
import { click } from "@/audio/sfx";
import { hint } from "../hint";
import { Interactive } from "../Interactive";
import { POS } from "../layout";
import { FRET_Y, FRETS, JACK, NUT_Y, REST, SADDLE_Y, STAND_YAW, STRING_Z, TELE as T, fingerY, fretAt, guitarDir, guitarToWorld, stringGap, stringX } from "../guitarView";
import { useRoom } from "../store";

// Models: see CREDITS.md.
//  - "Telecaster" by aledororo (CC BY-NC 4.0)
//  - "Marshall Guitar Amp" by D3 (CC BY 4.0)
//  - "Wooden guitar stand | Guitar rack asset" by Hineline (CC BY 4.0)
const TELE = "/models/sk/telecaster.glb";
const AMP = "/models/sk/amp.glb";
const STAND = "/models/sk/guitar_stand.glb";

/** Clone of a loaded scene with shadows switched on. */
export function useClone(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
}

// Stood up: the file's length becomes height, its face turns to the front, its width runs across.
const UPRIGHT = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
const SIX = [0, 1, 2, 3, 4, 5];
// How thick each string is, low E first: a light set, 46 to 10. From where the guitar is
// played the fine ones are less than a pixel wide, and from across the room all of them are;
// drawn to scale they break up into dashes. So no string is ever drawn narrower than a pixel
// of the screen: one finer than that is drawn a pixel wide and fainter instead.
const GAUGE = [0.00117, 0.00091, 0.00066, 0.00043, 0.00033, 0.00025];
const CENTRE = guitarToWorld(0, 0.48, 0.05);

/** Lays a string segment (a box one unit long) between two points on the face of the guitar, `width` across. */
function lay(m: THREE.Mesh | null, x0: number, y0: number, x1: number, y1: number, width: number, alpha: number) {
  if (!m) return;
  const dx = x1 - x0;
  const dy = y1 - y0;
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, STRING_Z);
  m.rotation.z = -Math.atan2(dx, dy);
  m.scale.set(width, Math.hypot(dx, dy), width);
  (m.material as THREE.MeshStandardMaterial).opacity = alpha;
}

// The file has strings of its own, modelled into the same mesh as everything else. They
// cannot move, so they are cut out and the ones made here take their place. They are the
// faces painted from one small patch of the texture; those past the nut, running up the
// headstock to the tuners, are kept.
const STRING_PATCH = { u: [0.5, 0.7], v: [0.11, 0.155], nutX: 35.8 };
function cutStrings(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry.index || !m.geometry.attributes.uv) return;
    const g = m.geometry.clone();
    const { index, attributes } = g;
    const kept: number[] = [];
    const isString = (i: number) => {
      const u = attributes.uv.getX(i);
      const v = attributes.uv.getY(i);
      return u > STRING_PATCH.u[0] && u < STRING_PATCH.u[1] && v > STRING_PATCH.v[0] && v < STRING_PATCH.v[1];
    };
    for (let t = 0; t < index!.count; t += 3) {
      const tri = [index!.getX(t), index!.getX(t + 1), index!.getX(t + 2)];
      const onNeck = Math.min(...tri.map((i) => attributes.position.getX(i))) < STRING_PATCH.nutX;
      if (!(tri.every(isString) && onNeck)) kept.push(...tri);
    }
    g.setIndex(kept);
    m.geometry = g;
  });
}

const now = () => performance.now() / 1000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mark = (s: number) => useRoom.getState().markPluck(s, now());
const point = new THREE.Vector3();

/**
 * What the pressed pointer is doing. Lead: one string is held at a fret; moving along it
 * slides to other frets, pulling it sideways bends it. Rhythm: the pointer is a pick, and
 * every string it is dragged across sounds, at the fret the chord holds it at.
 */
type Hold = { kind: "lead"; string: number; fret: number; at: number; x0: number; y: number; pull: number } | { kind: "strum"; x: number };

/**
 * The Telecaster, stood upright: origin at the bottom of the body on the string axis,
 * +y towards the headstock, +z out of the front.
 */
function Telecaster() {
  const whole = useClone(TELE);
  const scene = useMemo(() => {
    cutStrings(whole);
    return whole;
  }, [whole]);
  const live = useRoom((s) => s.focus === "guitar");
  const root = useRef<THREE.Group>(null);
  // each string is drawn in two lengths that meet where it is held, or at its middle
  const upper = useRef<(THREE.Mesh | null)[]>([]);
  const lower = useRef<(THREE.Mesh | null)[]>([]);
  const dots = useRef<(THREE.Mesh | null)[]>([]);
  const hold = useRef<Hold | null>(null);
  const lamp = useRef<THREE.PointLight>(null);

  // the left hand: keys 1-8 change the chord. Space strums (shift = upstroke).
  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || useRoom.getState().guitarMode !== "rhythm") return;
      const n = Number(e.key);
      if (n >= 1 && n <= useRoom.getState().chords.length) useRoom.getState().setSlot(n - 1);
      if (e.key === " ") {
        e.preventDefault();
        strum(mark, e.shiftKey);
      }
    };
    const letGo = () => {
      hold.current = null;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerup", letGo);
    window.addEventListener("pointercancel", letGo);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerup", letGo);
      window.removeEventListener("pointercancel", letGo);
      hold.current = null;
    };
  }, [live]);

  /** the pointer, in the guitar's own measure */
  const local = (e: ThreeEvent<PointerEvent>) => (root.current ? root.current.worldToLocal(point.copy(e.point)) : null);
  /** the string under a point, or -1 if it is off to the side of all six */
  const stringNear = (x: number, y: number) => {
    const i = x / stringGap(y) + 2.5;
    return i > -0.8 && i < 5.8 ? clamp(Math.round(i), 0, 5) : -1;
  };

  const down = (e: ThreeEvent<PointerEvent>) => {
    if (!live || e.button !== 0) return;
    const p = local(e);
    if (!p) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const s = stringNear(p.x, p.y);
    if (useRoom.getState().guitarMode === "rhythm") {
      // On the neck a click is the left hand: it puts a finger on that string at that fret.
      // On the finger already there it lifts it off, leaving the string open; at the nut it
      // mutes the string, or lets it ring again.
      if (s >= 0 && p.y > FRET_Y[FRETS] && p.y < NUT_Y + 0.02) {
        const { chords, slot, setFret } = useRoom.getState();
        const was = chords[slot][s];
        const fret = p.y >= NUT_Y ? (was < 0 ? 0 : -1) : fretAt(p.y);
        setFret(s, fret === was && fret > 0 ? 0 : fret);
        if (pluck(s, 0.8)) mark(s);
        return;
      }
      // over the body it is the pick
      hold.current = { kind: "strum", x: p.x };
      if (s >= 0 && pluck(s, 0.85)) mark(s);
      return;
    }
    if (s < 0 || p.y < SADDLE_Y - 0.012 || p.y > NUT_Y + 0.004) return;
    const fret = fretAt(p.y);
    if (pick(s, fret, 1)) mark(s);
    hold.current = { kind: "lead", string: s, fret, at: fret, x0: p.x, y: p.y, pull: 0 };
  };

  const move = (e: ThreeEvent<PointerEvent>) => {
    const h = hold.current;
    if (!live) return;
    const p = local(e);
    if (!p) return;
    if (!h) {
      // not pressed: say what pressing here would do
      const onStrings = stringNear(p.x, p.y) >= 0 && p.y > SADDLE_Y - 0.012 && p.y < NUT_Y + 0.02;
      const onNeck = p.y > FRET_Y[FRETS];
      hint(!onStrings ? null : useRoom.getState().guitarMode === "lead" ? "tip_lead" : onNeck ? "tip_finger" : "tip_strum");
      return;
    }
    e.stopPropagation();
    if (h.kind === "strum") {
      // every string between where the pick was and where it is now has been crossed
      const dir = p.x > h.x ? 1 : -1;
      const hard = clamp(0.55 + Math.abs(p.x - h.x) * 35, 0.55, 1);
      let n = 0;
      for (let k = 0; k < 6; k++) {
        const s = dir > 0 ? k : 5 - k;
        const sx = stringX(s, p.y);
        if ((h.x - sx) * (p.x - sx) >= 0) continue;
        // a fast sweep crosses several in one move; they still sound one after the other
        setTimeout(() => pluck(s, hard) && mark(s), n++ * 14);
      }
      h.x = p.x;
      return;
    }
    // a fretted note slides to whichever fret the finger is over now
    if (h.fret > 0) {
      const over = fretAt(clamp(p.y, SADDLE_Y, NUT_Y - 0.0005));
      if (over > 0) h.at = clamp(over, 1, FRETS);
    }
    // and pulling the string across the board raises it, up to a tone and a half
    h.pull = p.x - h.x0;
    h.y = clamp(p.y, SADDLE_Y + 0.02, NUT_Y - 0.01);
    const bend = clamp(((Math.abs(h.pull) - 0.004) / stringGap(p.y)) * 1.5, 0, 3);
    retune(h.string, h.at - h.fret + bend, bend > 0 ? 0.012 : 0.03);
  };

  const up = (e: ThreeEvent<PointerEvent>) => {
    if (!hold.current) return;
    e.stopPropagation();
    (e.target as Element).releasePointerCapture(e.pointerId);
    hold.current = null;
  };

  const length = NUT_Y - SADDLE_Y;
  const middle = (NUT_Y + SADDLE_Y) / 2;
  useFrame(({ camera, size }, dt) => {
    const t = now();
    // how much of the guitar one pixel of the screen covers, from where it is being seen
    const pixel = (camera.position.distanceTo(CENTRE) * 2 * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2))) / size.height;
    const { plucks, guitarMode, chords, slot } = useRoom.getState();
    // taken up to play, it is brought into the light: the corner it stands in is a dark one
    if (lamp.current) lamp.current.intensity += ((live ? 1.3 : 0) - lamp.current.intensity) * (1 - Math.exp(-dt * 3));
    const h = hold.current;
    SIX.forEach((i) => {
      const held = h?.kind === "lead" && h.string === i ? h : null;
      // The string never leaves the nut or its saddle. A plucked one swings out at its middle
      // for a couple of seconds; a bent one is pulled aside where the finger has it.
      const age = t - plucks[i];
      const shiver = age < 2.5 ? Math.sin(age * (70 + i * 14)) * 0.0011 * Math.exp(-age * 2.6) : 0;
      const pulled = held ? clamp(held.pull, -0.012, 0.012) * 0.8 : 0;
      const y = held ? (held.fret > 0 ? fingerY(held.at) : held.y) : middle;
      const x = stringX(i, y) + pulled + (held ? shiver * 0.3 : shiver);
      const width = Math.max(GAUGE[i], pixel * 1.1);
      const alpha = clamp((GAUGE[i] / width) * 1.3, 0.22, 1);
      lay(upper.current[i], x, y, stringX(i, NUT_Y), NUT_Y, width, alpha);
      lay(lower.current[i], stringX(i, SADDLE_Y), SADDLE_Y, x, y, width, alpha);
      const dot = dots.current[i];
      if (!dot) return;
      // where the fingers are: the chord's shape, or the one note being held
      const rhythm = live && guitarMode === "rhythm";
      const fret = rhythm ? chords[slot][i] : live && held ? held.at : 0;
      // a muted string is marked at the nut, in red
      const muted = rhythm && fret < 0;
      dot.visible = fret > 0 || muted;
      if (!dot.visible) return;
      const at = muted ? NUT_Y + 0.007 : fingerY(fret);
      dot.position.set(stringX(i, at) + pulled, at, STRING_Z + 0.0022);
      dot.scale.setScalar(muted ? 0.7 : 1);
      (dot.material as THREE.MeshBasicMaterial).color.set(muted ? "#c93a2b" : "#ffb24a");
    });
  });

  return (
    <group ref={root}>
      {/* low and off to one side, so its glare on the lacquer falls outside the picture */}
      <pointLight ref={lamp} position={[-0.5, 0.2, 0.4]} color="#ffd2a0" intensity={0} distance={2.4} decay={1.5} />
      <group quaternion={UPRIGHT} scale={T.scale}>
        <primitive object={scene} position={[-T.bottomX, 0, -T.axisZ]} />
      </group>
      {SIX.map((i) => (
        <group key={i}>
          {/* the string itself, nut to saddle: wound and heavy at the low end, a bare wire at the top */}
          {[upper, lower].map((half, k) => (
            <mesh
              key={k}
              ref={(m) => {
                half.current[i] = m;
              }}
            >
              <boxGeometry args={[1, 1, 1]} />
              {/* a little light of its own: the far end of the neck is in the dark, and a string that only shone where the lamp caught it read as half a string */}
              <meshStandardMaterial color={i < 3 ? "#c9b188" : "#e4e4e4"} emissive={i < 3 ? "#c9b188" : "#e4e4e4"} emissiveIntensity={0.45} metalness={0.5} roughness={0.45} envMapIntensity={1.5} transparent depthWrite={false} />
            </mesh>
          ))}
          {/* a fingertip's worth of light where the string is held down */}
          <mesh
            ref={(m) => {
              dots.current[i] = m;
            }}
            visible={false}
          >
            <circleGeometry args={[0.0034, 20]} />
            <meshBasicMaterial color="#ffb24a" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* one sheet over the strings takes the pointer; it is wide, so a bend that leaves the neck is still followed */}
      {/* It is only there while the guitar is played: it is far wider than the guitar, and from across the room it took clicks meant for things near it. */}
      {live && (
        <mesh position={[0, middle, STRING_Z + 0.003]} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerOut={() => live && hint(null)}>
          <planeGeometry args={[0.5, length + 0.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// the amp: the file is 0.136 wide and centred on its middle; a practice combo is about 45 cm
const AMP_SCALE = 0.45 / 0.136;
const AMP_YAW = 0.5;

function Amp() {
  const scene = useClone(AMP);
  return (
    <group position={POS.amp} rotation={[0, AMP_YAW, 0]}>
      <primitive object={scene} scale={AMP_SCALE} position={[0, 0.0669 * AMP_SCALE, 0]} />
    </group>
  );
}

/* ---------- the lead ---------- */

const UP = new THREE.Vector3(0, 1, 0);
const ampPoint = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyAxisAngle(UP, AMP_YAW).add(new THREE.Vector3(...POS.amp));
// one end stays in the amp's input, on the front under the handle
const AMP_IN = ampPoint(-0.13, 0.405, 0.135);
const AMP_OUT = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, AMP_YAW);
// the other is plugged into the guitar when it is taken up to play, and lies on the floor by the stand otherwise
const JACK_AT = guitarToWorld(...JACK.at);
const JACK_OUT = guitarDir(...JACK.out);
const FLOOR_AT = guitarToWorld(0.3, 0.02, 0.2).setY(0.012);
const FLOOR_OUT = new THREE.Vector3(-0.5, 0, 0.3).normalize();
const ease = (t: number) => t * t * (3 - 2 * t);
// there is one lead in the room: the line it follows, and where its free end is
const curve = new THREE.CatmullRomCurve3(Array.from({ length: 7 }, () => new THREE.Vector3()));
const tip = { at: new THREE.Vector3(), out: new THREE.Vector3() };

/** The guitar lead. It lifts off the floor and goes into the jack as the guitar is taken up, and swings a little as it is played. */
function Lead() {
  const live = useRoom((s) => s.focus === "guitar");
  const cable = useRef<THREE.Mesh>(null);
  const plug = useRef<THREE.Group>(null);
  const state = useRef({ in: 0, drawn: -1 });

  useFrame((_, dt) => {
    const s = state.current;
    const before = s.in;
    s.in = clamp(s.in + (live ? dt : -dt) / 0.9, 0, 1);
    if (before < 1 && s.in >= 1) click(0.45);
    // the strings shake it; so does being moved
    const t = now();
    const shake = Math.max(...useRoom.getState().plucks.map((at) => Math.exp(-(t - at) * 2.4)));
    const moving = s.in !== before || shake > 0.02 || live;
    if (!moving && s.drawn === s.in) return;
    s.drawn = s.in;

    const e = ease(s.in);
    tip.at.lerpVectors(FLOOR_AT, JACK_AT, e);
    tip.at.y += Math.sin(Math.PI * e) * 0.16;
    tip.out.lerpVectors(FLOOR_OUT, JACK_OUT, e).normalize();
    const sway = Math.sin(t * 1.1) * 0.004 * e + Math.sin(t * 19) * 0.006 * shake * e;
    const p = curve.points;
    p[0].copy(tip.at).addScaledVector(tip.out, 0.034);
    p[1].copy(tip.at).addScaledVector(tip.out, 0.1);
    p[1].y -= 0.03 * e;
    p[1].x += sway;
    // it hangs to the floor, runs across it, and climbs the front of the amp
    p[2].lerpVectors(tip.at, AMP_IN, 0.3).setY(0.008);
    p[2].z += 0.1 + sway * 2;
    p[3].lerpVectors(tip.at, AMP_IN, 0.68).setY(0.008);
    p[3].z += 0.16;
    p[4].copy(AMP_IN).addScaledVector(AMP_OUT, 0.11);
    p[4].y -= 0.2;
    p[5].copy(AMP_IN).addScaledVector(AMP_OUT, 0.06);
    p[5].y -= 0.02;
    p[6].copy(AMP_IN);
    if (cable.current) {
      cable.current.geometry.dispose();
      cable.current.geometry = new THREE.TubeGeometry(curve, 56, 0.0032, 6);
    }
    if (plug.current) {
      plug.current.position.copy(tip.at);
      plug.current.quaternion.setFromUnitVectors(UP, tip.out);
    }
  });

  return (
    <>
      <mesh ref={cable} castShadow frustumCulled={false}>
        <bufferGeometry />
        <meshStandardMaterial color="#141210" roughness={0.6} />
      </mesh>
      {/* the plug: its shaft goes into the jack, the barrel stays outside */}
      <group ref={plug}>
        <mesh position={[0, -0.006, 0]}>
          <cylinderGeometry args={[0.0031, 0.0031, 0.03, 12]} />
          <meshStandardMaterial color="#d9d9d9" metalness={1} roughness={0.25} envMapIntensity={2} />
        </mesh>
        <mesh position={[0, 0.022, 0]} castShadow>
          <cylinderGeometry args={[0.0058, 0.0066, 0.03, 14]} />
          <meshStandardMaterial color="#1b1b1d" roughness={0.45} />
        </mesh>
      </group>
    </>
  );
}

export function Guitar() {
  const stand = useClone(STAND);
  return (
    <>
      <Amp />
      <Lead />
      <Interactive target="guitar" position={POS.guitar} rotation={[0, STAND_YAW, 0]}>
        {/* the stand's two sides meet at a right angle; turned 45 degrees its cradle faces forward */}
        <primitive object={stand} rotation={[0, Math.PI / 4, 0]} />
        {/* body resting in the cradle, neck leaning back on the upright */}
        <group position={REST.pos} rotation={[REST.lean, 0, 0]}>
          <Telecaster />
        </group>
      </Interactive>
    </>
  );
}

useGLTF.preload(TELE);
useGLTF.preload(AMP);
useGLTF.preload(STAND);
