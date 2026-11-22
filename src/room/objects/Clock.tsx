"use client";

import { asset } from "@/asset";
import { useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";
import { tick } from "@/audio/sfx";
import { useRoom } from "../store";
import { useClone } from "./Guitar";

// Poly Haven "Wall Clock" (CC0). Its three hands are separate pieces that turn about the
// middle of the face, so it is made to keep the visitor's own time.
const CLOCK = asset("/models/wall_clock/wall_clock.gltf");

const tip = new THREE.Vector3();

/** Which way a hand points in the file: the angle of its far end, anticlockwise from three o'clock. */
function restAngle(hand: THREE.Object3D) {
  const pos = (hand as THREE.Mesh).geometry.attributes.position;
  let far = 0;
  let angle = 0;
  for (let i = 0; i < pos.count; i++) {
    tip.fromBufferAttribute(pos, i);
    const d = tip.x * tip.x + tip.y * tip.y;
    if (d > far) {
      far = d;
      angle = Math.atan2(tip.y, tip.x);
    }
  }
  return angle;
}

/** A wall clock showing the time it really is. */
export function Clock(props: ThreeElements["group"]) {
  const scene = useClone(CLOCK);
  const root = useRef<THREE.Group>(null);
  // once the lettering can be drawn, every part of the clock that uses the dial's picture is given the renamed one
  const hands = useMemo(() => {
    const find = (name: string) => {
      const hand = scene.getObjectByName(name);
      return hand ? { hand, rest: restAngle(hand) } : null;
    };
    return { hours: find("wall_clock_hours_hand"), minutes: find("wall_clock_minute_hand"), seconds: find("wall_clock_second_hand") };
  }, [scene]);
  const last = useRef(-1);

  useFrame(() => {
    const now = new Date();
    const sec = now.getSeconds();
    const s = sec + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    const rs = useRoom.getState();
    if (last.current !== sec) {
      if (last.current !== -1 && rs.sound && !rs.clockMuted) tick(sec);
      last.current = sec;
    }
    // twelve o'clock is straight up, and the hands go round clockwise
    const point = (part: typeof hands.hours, turn: number) => {
      if (part) part.hand.rotation.z = Math.PI / 2 - turn * Math.PI * 2 - part.rest;
    };
    point(hands.hours, h / 12);
    point(hands.minutes, m / 60);
    // the second hand goes in steps, with a little overshoot as it lands
    const whole = Math.floor(s);
    const landing = Math.min(1, (s - whole) / 0.12);
    point(hands.seconds, (whole + landing + Math.sin(landing * Math.PI) * 0.12 - 1) / 60);
    if (root.current) {
      const t = (performance.now() - rs.clockNudge) / 1000;
      const nudge = t >= 0 && t < 0.45 ? Math.sin(t * Math.PI * 7) * Math.exp(-t * 9) * 0.045 : 0;
      root.current.rotation.z = nudge;
      root.current.position.x = nudge * 0.12;
    }
  });

  return (
    <group ref={root} {...props}>
      <primitive object={scene} />
    </group>
  );
}
