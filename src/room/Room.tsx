"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { type DepthOfFieldEffect, Effect, SMAAPreset, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { CD_OPEN_VIEW, ENTER_VIEW, TYPING_VIEW, FINDER_FOV, FOCUS_FOV, HOME_FOV, HOME_VIEW, POS, VIEWS, WALL_Z } from "./layout";
import { glideOrbit, orbit, resetOrbit, type OrbitLimits } from "./orbit";
import { useRoom, type FocusId } from "./store";
import { touch } from "./touch";
import { Shell } from "./objects/Shell";
import { Props } from "./objects/Props";
import { TapeRack } from "./objects/Tapes";
import { CdPlayer, CdStack } from "./objects/Cds";
import { Guitar } from "./objects/Guitar";
import { finderCam, stepFinderCam } from "./finderCam";
import { guitarView } from "./guitarView";
import { Frames, Notes } from "./objects/Paper";
import { ContactPack } from "./objects/ContactPack";
import { Receipt } from "./objects/Receipt";
import { receiptRange } from "./receipt";
import { Posters } from "./objects/Posters";
import { Coffee, Haze, LampGlow } from "./objects/Cozy";
import { typingFront } from "./tv/os";
import { Pamphlet } from "./objects/Pamphlet";
import { SillDecor } from "./objects/Sill";
import { Canonet } from "./objects/Canonet";
import { Shelf } from "./objects/Shelf";
import { Keyboard } from "./objects/Keyboard";
import { Dice, Mouse } from "./objects/DeskToys";
import { Furniture } from "./objects/Furniture";
import { Album, albumPhotoView } from "./objects/Album";

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
/** the point the camera is looking at this frame: what is kept sharp when the background is blurred */
const focusPoint = new THREE.Vector3(0, 1, 0);
const LEVEL: [number, number, number] = [0, 1, 0];
const sph = new THREE.Spherical();
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Phones run the same room with fewer pixels and no shadow maps, so a drag stays smooth. */
const LOW_POWER = typeof window !== "undefined" && (matchMedia("(pointer: coarse)").matches || matchMedia("(max-width: 700px)").matches);

/** Close-ups where a drag turns the thing itself and the camera stays put. */
const turnsObject = (focus: FocusId | null) => focus === "canonet" || focus === "saturn" || focus === "cards" || focus === "receipt";

/** How far the view may be turned and zoomed by hand, depending on what is being looked at. */
function reach(focus: FocusId | null): OrbitLimits | null {
  // the tube fills the frame and takes the pointer itself; on the guitar every drag is playing
  if (focus === "tv" || focus === "guitar") return null;
  // the receipt is slid up and down in the hand to read it, as far as its foot
  if (focus === "receipt") return { yaw: 0, pitch: [-receiptRange.max, 0], zoom: [0.7, 1.3] };
  // the Canonet is turned in the hand, all the way round, and so is the lamp's planet
  if (turnsObject(focus)) return { yaw: Infinity, pitch: [-1.1, 1.1], zoom: [0.55, 1.5] };
  if (focus) return { yaw: 0.8, pitch: [-0.2, 0.5], zoom: [0.6, 1.5] };
  return { yaw: 0.8, pitch: [-0.12, 0.45], zoom: [0.45, 1.5] };
}

/** With the eye at the finder, or a cassette open, there is nothing to turn. */
function orbitLimits(): OrbitLimits | null {
  const s = useRoom.getState();
  if (s.focus === "tapes" && s.selectedTape) return null;
  return s.booted && !s.finder ? reach(s.focus) : null;
}

/** Drag to turn the view, pinch or wheel to zoom. A drag must not also count as a click. */
function useOrbitInput() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    /** every finger currently down on the glass, so two of them can pinch */
    const fingers = new Map<number, { x: number; y: number }>();
    let from: { x: number; y: number } | null = null;
    let moved = false;
    let swallow = false;
    let pinch: { gap: number; zoom: number } | null = null;
    let lastAt = 0;
    const gap = () => {
      const [a, b] = Array.from(fingers.values());
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const down = (e: PointerEvent) => {
      swallow = false;
      if (e.pointerType === "touch") fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (e.button !== 0 || !orbitLimits()) return;
      orbit.vYaw = 0;
      orbit.vPitch = 0;
      if (fingers.size >= 2) {
        // the second finger turns the gesture into a zoom, never a turn or a click
        from = null;
        moved = true;
        swallow = true;
        pinch = { gap: gap(), zoom: orbit.zoom };
        return;
      }
      from = { x: e.clientX, y: e.clientY };
      moved = false;
      lastAt = performance.now();
    };
    const move = (e: PointerEvent) => {
      if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const l = orbitLimits();
      if (!l || orbit.locked) return;
      if (pinch && fingers.size >= 2) {
        const now = gap();
        if (now > 8) {
          moved = true;
          orbit.zoom = clamp((pinch.zoom * pinch.gap) / now, l.zoom[0], l.zoom[1]);
        }
        return;
      }
      if (!from) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      if (!moved && Math.hypot(dx, dy) < (e.pointerType === "touch" ? 8 : 5)) return;
      moved = true;
      orbit.dragging = true;
      document.body.classList.add("orbiting");
      const finger = e.pointerType === "touch";
      const turn = turnsObject(useRoom.getState().focus) ? (finger ? 0.007 : 0.009) : finger ? 0.0038 : 0.005;
      orbit.yaw = clamp(orbit.yaw - dx * turn, -l.yaw, l.yaw);
      orbit.pitch = clamp(orbit.pitch + dy * turn * 0.8, l.pitch[0], l.pitch[1]);
      const now = performance.now();
      const span = Math.max(8, now - lastAt) / 1000;
      lastAt = now;
      const coast = finger ? 0.25 : 0.5;
      orbit.vYaw = clamp((-dx * turn * coast) / span, -2.2, 2.2);
      orbit.vPitch = clamp((dy * turn * 0.8 * coast) / span, -1.8, 1.8);
      from = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      if (pinch && fingers.size < 2) pinch = null;
      if (from && moved) swallow = true;
      from = null;
      orbit.dragging = false;
      document.body.classList.remove("orbiting");
    };
    const click = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.stopPropagation();
    };
    const wheel = (e: WheelEvent) => {
      const l = orbitLimits();
      if (!l) {
        // the wheel belongs to the receipt, not to the page or the camera
        if (useRoom.getState().selectedTape) e.preventDefault();
        return;
      }
      e.preventDefault();
      // the receipt is a long strip: the wheel runs along it, as it would down a page
      if (useRoom.getState().focus === "receipt") {
        orbit.pitch = clamp(orbit.pitch - e.deltaY * 0.006, l.pitch[0], l.pitch[1]);
        return;
      }
      orbit.zoom = clamp(orbit.zoom * Math.exp(e.deltaY * 0.0012), l.zoom[0], l.zoom[1]);
    };
    // Wherever a drag would turn the view (or the thing in the hand), the pointer is an open
    // hand, and a closed one while it does. Controls put their own pointer over this.
    const hand = () => document.body.classList.toggle("can-orbit", !!orbitLimits());
    hand();
    const unwatch = useRoom.subscribe((s, was) => {
      if (s.focus !== was.focus || s.booted !== was.booted || s.finder !== was.finder || s.selectedTape !== was.selectedTape) hand();
    });
    el.addEventListener("pointerdown", down);
    el.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("click", click, true);
    return () => {
      unwatch();
      document.body.classList.remove("can-orbit", "orbiting");
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("wheel", wheel);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("click", click, true);
    };
  }, [gl]);
}

/** Eases the camera between the wide view and each object's close-up, with a little mouse drift, and lets the visitor turn and zoom it. */
function CameraRig() {
  const focus = useRoom((s) => s.focus);
  const booted = useRoom((s) => s.booted);
  const zoomed = useRoom((s) => s.zoomed);
  // the view stays on a CD that has been put back until its case has shut
  const cdOut = useRoom((s) => s.selectedCd !== null || s.cdOpen !== null);
  const finder = useRoom((s) => s.finder);
  const tapeOpen = useRoom((s) => s.selectedTape !== null);
  const look = useRef(new THREE.Vector3(...HOME_VIEW.look));
  const first = useRef(true);
  const shift = useRef(0);
  const size = useThree((s) => s.size);
  const hand = useRef({ yaw: 0, pitch: 0, zoom: 1 });
  useOrbitInput();
  // every view starts square on; what was dialled in for the last one is dropped
  useEffect(() => resetOrbit(), [focus, booted, zoomed, finder, tapeOpen]);

  useFrame((state, dt) => {
    glideOrbit(dt, orbitLimits());
    const pointer = state.pointer;
    const finger = touch();
    const camera = state.camera as THREE.PerspectiveCamera;
    // in the album, a photo that was clicked is looked at from close to
    const aspect = size.width / size.height;
    // the guitar is played from square in front of it, turned to lie across a wide screen
    const playing = booted && focus === "guitar" ? guitarView(aspect) : null;
    // through the Canonet's viewfinder: the room as it is seen from the chair
    const peeking = booted && focus === "canonet" && finder;
    const view = !booted ? ENTER_VIEW : peeking ? HOME_VIEW : playing ? playing : focus === "album" && zoomed !== null ? albumPhotoView(zoomed) : focus === "cds" && cdOut ? CD_OPEN_VIEW : focus === "tv" && typingFront() ? TYPING_VIEW : focus ? VIEWS[focus] : HOME_VIEW;
    tmpLook.set(...view.look);
    tmpPos.set(...view.pos);
    tmpUp.set(...(playing ? playing.up : LEVEL));
    // on narrow screens step back so the whole desk stays in frame, but keep the subject close
    // enough to see; a tall phone must not end up looking at the room from across the street
    const pull = playing ? 1 : clamp(1.75 / aspect, 1, finger ? 2.05 : 2.6);
    tmpPos.sub(tmpLook).multiplyScalar(pull);
    // the visitor's own turn and zoom, about the point being looked at
    const h = hand.current;
    const kh = 1 - Math.exp(-dt * 14);
    const held = turnsObject(focus); // there the drag turns the object, not the view
    h.yaw += ((held ? 0 : orbit.yaw) - h.yaw) * kh;
    h.pitch += ((held ? 0 : orbit.pitch) - h.pitch) * kh;
    h.zoom += (orbit.zoom - h.zoom) * kh;
    sph.setFromVector3(tmpPos);
    sph.theta += h.yaw;
    sph.phi = clamp(sph.phi - h.pitch, 0.3, 1.72);
    sph.radius *= h.zoom;
    tmpPos.setFromSpherical(sph).add(tmpLook);
    if (peeking) {
      // the eye walks and looks about by itself (see finderCam.ts), within the furnished part of the room
      stepFinderCam(dt);
      tmpPos.set(finderCam.x, finderCam.y, finderCam.z);
      tmpLook.set(
        finderCam.x + Math.sin(finderCam.yaw) * Math.cos(finderCam.tip),
        finderCam.y + Math.sin(finderCam.tip),
        finderCam.z - Math.cos(finderCam.yaw) * Math.cos(finderCam.tip),
      );
    }
    // stay inside the room
    tmpPos.set(clamp(tmpPos.x, -2.9, 2.9), clamp(tmpPos.y, 0.25, 2.6), Math.max(tmpPos.z, WALL_Z + 0.2));
    const manual = peeking || orbit.dragging || Math.abs(orbit.yaw) + Math.abs(orbit.pitch) + Math.abs(orbit.zoom - 1) > 0.002;
    const drift = finger || playing || peeking ? 0 : focus ? 0.025 : 0.1;
    tmpPos.x += pointer.x * drift;
    tmpPos.y += pointer.y * drift * 0.4;
    // seated at the desk, the mouse turns the head a little: enough to find the guitar and the wall
    if (booted && !focus && !finger) {
      tmpLook.x += pointer.x * 0.4;
      tmpLook.y += pointer.y * 0.12;
    }

    const fov = peeking ? FINDER_FOV : focus ? FOCUS_FOV : HOME_FOV;
    if (first.current) {
      first.current = false;
      camera.position.copy(tmpPos);
      camera.up.copy(tmpUp);
      look.current.copy(tmpLook);
      camera.fov = fov;
      camera.updateProjectionMatrix();
    } else {
      // the pull back from the TV on entering is slower than a hop between objects
      const k = 1 - Math.exp(-dt * (manual ? 9 : booted && !focus ? 2.2 : 3.2));
      camera.position.lerp(tmpPos, k);
      camera.up.lerp(tmpUp, k).normalize();
      look.current.lerp(tmpLook, k);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov += (fov - camera.fov) * k;
        camera.updateProjectionMatrix();
      }
    }
    camera.lookAt(look.current);
    focusPoint.copy(look.current);

    // with a cassette's inlay open on the right of a wide screen, the picture slides left so the cassette and
    // the inlay stand side by side, clear of each other (the cassette cannot go further left itself: the TV is there)
    const inlay = focus === "tapes" && tapeOpen && aspect > 1.05;
    // slide the picture left while a side panel is open (the TV takes the whole screen instead)
    // nor for the Discman, the planet lamp, the guitar or the card pack, which have no panel: their controls are in the room
    const goal = inlay ? 0.14 : focus && focus !== "tv" && focus !== "tapes" && focus !== "cd" && focus !== "cds" && focus !== "saturn" && focus !== "guitar" && focus !== "cards" && focus !== "dice" && focus !== "receipt" && focus !== "clock" && focus !== "album" && focus !== "canonet" && focus !== "portrait" && zoomed === null ? 0.19 : 0;
    shift.current += (goal - shift.current) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(shift.current) > 0.0005) camera.setViewOffset(size.width, size.height, shift.current * size.width, 0, size.width, size.height);
    else camera.clearViewOffset();
  });
  return null;
}

/**
 * The Canonet's shutter. When it is pressed, the frame that has just been drawn is kept: the
 * part of it inside the viewfinder's window, as a picture. This runs after everything else
 * in the frame, so what it copies is the finished picture, grade and grain and all.
 */
function Shutter() {
  const taken = useRef(0);
  useFrame(({ gl }) => {
    const s = useRoom.getState();
    if (s.shutter === taken.current) return;
    taken.current = s.shutter;
    if (!s.finder) return;
    const canvas = gl.domElement;
    const box = canvas.getBoundingClientRect();
    // the window, as ui.module.css lays it out: 3 by 2, in the middle of the screen
    const w = Math.min(window.innerWidth * 0.88, window.innerHeight * 1.24);
    const h = w / 1.5;
    const k = canvas.width / box.width;
    const print = document.createElement("canvas");
    print.width = 960;
    print.height = 640;
    const ctx = print.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(canvas, (window.innerWidth / 2 - w / 2 - box.left) * k, (window.innerHeight / 2 - h / 2 - box.top) * k, w * k, h * k, 0, 0, print.width, print.height);
    s.setShot(print.toDataURL("image/jpeg", 0.86));
  }, 1000);
  return null;
}

/**
 * Close up on something, what is behind it goes a little soft, as it would through a lens.
 * Not from the chair, where the whole room is the picture, nor through the viewfinder.
 */
function FocusBlur() {
  const ref = useRef<DepthOfFieldEffect>(null);
  useFrame((_, dt) => {
    const effect = ref.current;
    if (!effect) return;
    const s = useRoom.getState();
    // nor with a cassette's inlay open: it is held right in front of the lens, nearer than the focus point, and would go soft
    const close = s.booted && s.focus !== null && !s.finder && !s.selectedTape;
    effect.target = focusPoint;
    effect.bokehScale += ((close ? 2.4 : 0) - effect.bokehScale) * (1 - Math.exp(-dt * 3));
  });
  return <DepthOfField ref={ref} worldFocusRange={0.7} bokehScale={0} resolutionScale={0.5} />;
}

/** A spotlight that looks at a point, with its target in the scene so the aim is honoured. */
function Aimed({ at, children, ...rest }: { at: [number, number, number]; children?: React.ReactNode } & React.ComponentProps<"spotLight">) {
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <primitive object={target} position={at} />
      <spotLight target={target} {...rest}>
        {children}
      </spotLight>
    </>
  );
}

function Lights() {
  const lamp = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    // an old bulb never burns perfectly evenly
    if (lamp.current) lamp.current.intensity = 3.8 + Math.sin(clock.elapsedTime * 1.3) * 0.03;
  });
  return (
    <>
      {/* Night, and two sources that matter: the warm desk lamp and the cyan of the tube (its light
          is in objects/Props.tsx). Everything else only keeps the shadows from going to black, and
          leans teal so the lamplight has something to stand against. */}
      <hemisphereLight args={["#2c7488", "#2a1a10", 0.05]} />
      {/* desk lamp: the warm key light, low on the left */}
      <pointLight
        ref={lamp}
        position={[POS.lamp[0] + 0.34, POS.lamp[1] + 0.6, POS.lamp[2] + 0.14]}
        color="#ffb066"
        distance={7.5}
        decay={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.002}
        shadow-radius={6}
      />
      {/* the lamp's light coming back off the room behind the chair */}
      <pointLight position={[1.6, 1.8, 2.4]} color="#ff9a58" intensity={0.3} distance={8} decay={1.7} />
      {/* night through the glass, pulled towards the TV's cyan */}
      <pointLight position={[POS.window[0], POS.window[1] + 0.2, POS.window[2] + 0.45]} color="#3b8fd8" intensity={0.95} distance={4.5} decay={1.9} />
      {/* a blue edge from the far side, so shapes separate from the dark */}
      <pointLight position={[1.9, 1.5, 0.6]} color="#2f7fd6" intensity={0.22} distance={5} decay={1.7} />
      <pointLight position={[-2.4, 1.2, 1.0]} color="#2a6fc2" intensity={0.08} distance={5} decay={1.7} />
      {/* the right of the desk: a soft, warm pool from up and in front, falling off into the dark
          at its rim. The gradient is what gives the things on it a lit side and a shadowed one, and
          its shadows ground them on the wood. */}
      <Aimed
        at={[0.68, 0.78, -0.02]}
        position={[1.45, 1.75, 0.95]}
        color="#ffb07a"
        intensity={0.85}
        angle={0.32}
        penumbra={1}
        distance={5.5}
        decay={1.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.002}
        shadow-radius={8}
      />
      {/* cold backlight through the window: a thin cyan rim on the tops and far edges, so shapes
          come off the dark instead of sinking into it */}
      <Aimed at={[0.5, 0.85, 0.0]} position={[0.9, 2.1, -1.5]} color="#4b98e8" intensity={0.9} angle={0.5} penumbra={1} distance={7} decay={1.5} />
    </>
  );
}

// The grade: shadows drift to teal, highlights to amber, with a slightly harder curve.
const gradeFrag = /* glsl */ `
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c += vec3(-0.003, 0.016, 0.024) * smoothstep(0.0, 0.06, l) * (1.0 - smoothstep(0.08, 0.5, l));
    c *= mix(vec3(1.0), vec3(1.04, 1.0, 0.93), smoothstep(0.35, 0.95, l));
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.28);
    c *= 0.94;
    outputColor = vec4(max(c, 0.0), inputColor.a);
  }
`;

function Grade() {
  const effect = useMemo(() => new Effect("TealAmberGrade", gradeFrag), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} />;
}

export default function Room({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    document.body.style.cursor = "";
    // anything with a name or a hint under the pointer gets the hand. Only when one of those
    // changes: a control may have set a cursor of its own (a grab, say) in between.
    return useRoom.subscribe((s, was) => {
      if (s.hover !== was.hover || s.tip !== was.tip) document.body.style.cursor = s.hover || s.tip ? "pointer" : "";
    });
  }, []);

  return (
    <Canvas
      flat
      shadows={LOW_POWER ? false : "soft"}
      dpr={LOW_POWER ? [1, 1.5] : [1.5, 2]}
      camera={{ fov: HOME_FOV, near: 0.05, far: 40, position: HOME_VIEW.pos }}
      gl={{ antialias: !LOW_POWER, powerPreference: "high-performance" }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color("#080b0c");
      }}
    >
      <CameraRig />
      {/* a little smoke in the air: far corners soften and sink into brown */}
      <fogExp2 attach="fog" args={["#070b0d", 0.05]} />
      <Lights />
      <Environment resolution={64} frames={1}>
        <color attach="background" args={["#0a0806"]} />
        {/* what polished things mirror: lamp-amber on one side, tube-cyan on the other */}
        <Lightformer form="rect" intensity={0.85} color="#ffa550" position={[-3, 2, 1]} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={0.45} color="#3b8fd8" position={[2.5, 1.5, 3]} scale={[2, 2, 1]} />
        <Lightformer form="rect" intensity={0.2} color="#3b8fd8" position={[0, 2, -4]} scale={[2, 2, 1]} />
        <Lightformer form="rect" intensity={0.12} color="#ffd0a0" position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[4, 2, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Shell />
        <Props />
        <Shelf />
        <TapeRack />
        <Pamphlet />
        <CdStack />
        <CdPlayer />
        <Guitar />
        <Frames />
        <Notes />
        <ContactPack />
        <Receipt />
        <Mouse />
        <Dice />
        <Posters />
        <Furniture />
        <Keyboard />
        <Canonet />
        <Album />
        <Coffee />
        <SillDecor />
        <LampGlow />
        <Haze />
        <Ready onReady={onReady} />
      </Suspense>
      {/* The scene is drawn into the composer's buffer, not the canvas, so the canvas's own
          antialiasing never reaches it. Multisampling that buffer is the obvious fix, but on
          Intel/Mesa it renders the frame black, so edges are smoothed by SMAA after tone mapping. */}
      <EffectComposer multisampling={0}>
        {!LOW_POWER && <FocusBlur />}
        <Bloom intensity={LOW_POWER ? 0.45 : 0.6} luminanceThreshold={0.92} luminanceSmoothing={0.25} radius={0.7} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Grade />
        {!LOW_POWER && <SMAA preset={SMAAPreset.ULTRA} />}
        <Vignette offset={0.25} darkness={0.8} />
        {!LOW_POWER && <Noise opacity={0.025} />}
      </EffectComposer>
      <Shutter />
    </Canvas>
  );
}

/** Mounts only once every suspended asset above it has loaded. */
function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
}
