"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { Effect, SMAAPreset, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { CD_OPEN_VIEW, ENTER_VIEW, FOCUS_FOV, HOME_FOV, HOME_VIEW, POS, VIEWS, WALL_Z } from "./layout";
import { orbit, resetOrbit } from "./orbit";
import { useRoom, type FocusId } from "./store";
import { Shell } from "./objects/Shell";
import { Props } from "./objects/Props";
import { TapeRack } from "./objects/Tapes";
import { CdPlayer, CdStack } from "./objects/Cds";
import { Guitar } from "./objects/Guitar";
import { Cards, Frames, Notes } from "./objects/Paper";
import { Posters } from "./objects/Posters";
import { Coffee, Haze, LampGlow } from "./objects/Cozy";
import { Canonet } from "./objects/Canonet";
import { Shelf } from "./objects/Shelf";
import { Keyboard } from "./objects/Keyboard";
import { Furniture } from "./objects/Furniture";
import { Album, albumPhotoView } from "./objects/Album";

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const sph = new THREE.Spherical();
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How far the view may be turned and zoomed by hand, depending on what is being looked at. */
function reach(focus: FocusId | null) {
  // the tube fills the frame and takes the pointer itself
  if (focus === "tv") return null;
  // the Canonet is turned in the hand, all the way round
  if (focus === "canonet") return { yaw: Infinity, pitch: [-1.1, 1.1], zoom: [0.55, 1.5] };
  if (focus) return { yaw: 0.8, pitch: [-0.2, 0.5], zoom: [0.6, 1.5] };
  return { yaw: 0.8, pitch: [-0.12, 0.45], zoom: [0.45, 1.5] };
}

/** Drag to turn the view, wheel to zoom. A drag must not also count as a click on whatever is under it. */
function useOrbitInput() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    let from: { x: number; y: number } | null = null;
    let moved = false;
    let swallow = false;
    const limits = () => {
      const s = useRoom.getState();
      return s.booted ? reach(s.focus) : null;
    };
    const down = (e: PointerEvent) => {
      swallow = false;
      if (e.button !== 0 || !limits()) return;
      from = { x: e.clientX, y: e.clientY };
      moved = false;
    };
    const move = (e: PointerEvent) => {
      const l = limits();
      if (!from || !l || orbit.locked) return;
      if (!moved && Math.hypot(e.clientX - from.x, e.clientY - from.y) < 5) return;
      moved = true;
      orbit.dragging = true;
      const turn = useRoom.getState().focus === "canonet" ? 0.009 : 0.005;
      orbit.yaw = clamp(orbit.yaw - (e.clientX - from.x) * turn, -l.yaw, l.yaw);
      orbit.pitch = clamp(orbit.pitch + (e.clientY - from.y) * turn * 0.8, l.pitch[0], l.pitch[1]);
      from = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      if (from && moved) swallow = true;
      from = null;
      orbit.dragging = false;
    };
    const click = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.stopPropagation();
    };
    const wheel = (e: WheelEvent) => {
      const l = limits();
      if (!l) return;
      e.preventDefault();
      orbit.zoom = clamp(orbit.zoom * Math.exp(e.deltaY * 0.0012), l.zoom[0], l.zoom[1]);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("click", click, true);
    return () => {
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
  const cdOut = useRoom((s) => s.selectedCd !== null);
  const look = useRef(new THREE.Vector3(...HOME_VIEW.look));
  const first = useRef(true);
  const shift = useRef(0);
  const size = useThree((s) => s.size);
  const hand = useRef({ yaw: 0, pitch: 0, zoom: 1 });
  useOrbitInput();
  // every view starts square on; what was dialled in for the last one is dropped
  useEffect(() => resetOrbit(), [focus, booted, zoomed]);

  useFrame((state, dt) => {
    const pointer = state.pointer;
    const camera = state.camera as THREE.PerspectiveCamera;
    // in the album, a photo that was clicked is looked at from close to
    const view = !booted ? ENTER_VIEW : focus === "album" && zoomed !== null ? albumPhotoView(zoomed) : focus === "cds" && cdOut ? CD_OPEN_VIEW : focus ? VIEWS[focus] : HOME_VIEW;
    tmpLook.set(...view.look);
    tmpPos.set(...view.pos);
    // on narrow windows step back so the whole desk stays in frame
    const aspect = size.width / size.height;
    const pull = Math.max(1, 1.75 / aspect);
    tmpPos.sub(tmpLook).multiplyScalar(pull);
    // the visitor's own turn and zoom, about the point being looked at
    const h = hand.current;
    const kh = 1 - Math.exp(-dt * 14);
    const held = focus === "canonet"; // there the drag turns the object, not the view
    h.yaw += ((held ? 0 : orbit.yaw) - h.yaw) * kh;
    h.pitch += ((held ? 0 : orbit.pitch) - h.pitch) * kh;
    h.zoom += (orbit.zoom - h.zoom) * kh;
    sph.setFromVector3(tmpPos);
    sph.theta += h.yaw;
    sph.phi = clamp(sph.phi - h.pitch, 0.3, 1.72);
    sph.radius *= h.zoom;
    tmpPos.setFromSpherical(sph).add(tmpLook);
    // stay inside the room
    tmpPos.set(clamp(tmpPos.x, -2.9, 2.9), clamp(tmpPos.y, 0.25, 2.6), Math.max(tmpPos.z, WALL_Z + 0.2));
    const manual = orbit.dragging || Math.abs(orbit.yaw) + Math.abs(orbit.pitch) + Math.abs(orbit.zoom - 1) > 0.002;
    const drift = focus ? 0.025 : 0.1;
    tmpPos.x += pointer.x * drift;
    tmpPos.y += pointer.y * drift * 0.4;
    // seated at the desk, the mouse turns the head a little: enough to find the guitar and the wall
    if (booted && !focus) {
      tmpLook.x += pointer.x * 0.4;
      tmpLook.y += pointer.y * 0.12;
    }

    const fov = focus ? FOCUS_FOV : HOME_FOV;
    if (first.current) {
      first.current = false;
      camera.position.copy(tmpPos);
      look.current.copy(tmpLook);
      camera.fov = fov;
      camera.updateProjectionMatrix();
    } else {
      // the pull back from the TV on entering is slower than a hop between objects
      const k = 1 - Math.exp(-dt * (manual ? 9 : booted && !focus ? 2.2 : 3.2));
      camera.position.lerp(tmpPos, k);
      look.current.lerp(tmpLook, k);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov += (fov - camera.fov) * k;
        camera.updateProjectionMatrix();
      }
    }
    camera.lookAt(look.current);

    // slide the picture left while a side panel is open (the TV takes the whole screen instead)
    // nor for the Discman, which has no panel: its own keys are the controls
    const goal = focus && focus !== "tv" && focus !== "cd" && focus !== "cds" && zoomed === null ? 0.19 : 0;
    shift.current += (goal - shift.current) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(shift.current) > 0.0005) camera.setViewOffset(size.width, size.height, shift.current * size.width, 0, size.width, size.height);
    else camera.clearViewOffset();
  });
  return null;
}

function Lights() {
  const lamp = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    // an old bulb never burns perfectly evenly
    if (lamp.current) lamp.current.intensity = 7.6 + Math.sin(clock.elapsedTime * 1.3) * 0.05;
  });
  return (
    <>
      {/* Night, and two sources that matter: the warm desk lamp and the cyan of the tube (its light
          is in objects/Props.tsx). Everything else only keeps the shadows from going to black, and
          leans teal so the lamplight has something to stand against. */}
      <hemisphereLight args={["#2c7488", "#2a1a10", 0.14]} />
      {/* desk lamp: the warm key light, low on the left */}
      <pointLight
        ref={lamp}
        position={[POS.lamp[0] + 0.34, POS.lamp[1] + 0.6, POS.lamp[2] + 0.14]}
        color="#ffb066"
        distance={8}
        decay={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.002}
        shadow-radius={6}
      />
      {/* the lamp's light coming back off the room behind the chair */}
      <pointLight position={[1.6, 1.8, 2.4]} color="#ff9a58" intensity={2.1} distance={9} decay={1.5} />
      {/* night through the glass, pulled towards the TV's cyan */}
      <pointLight position={[POS.window[0], POS.window[1] + 0.2, POS.window[2] + 0.45]} color="#4fb6dc" intensity={2.2} distance={4.5} decay={1.8} />
      {/* a cyan edge from the far side, so shapes separate from the dark */}
      <pointLight position={[1.9, 1.5, 0.6]} color="#35c4e4" intensity={1.2} distance={5} decay={1.6} />
      <pointLight position={[-2.4, 1.2, 1.0]} color="#2aa6c8" intensity={0.45} distance={5} decay={1.6} />
    </>
  );
}

// The grade: shadows drift to teal, highlights to amber, with a slightly harder curve.
const gradeFrag = /* glsl */ `
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c += vec3(-0.004, 0.022, 0.034) * smoothstep(0.0, 0.06, l) * (1.0 - smoothstep(0.08, 0.5, l));
    c *= mix(vec3(1.0), vec3(1.06, 1.0, 0.9), smoothstep(0.35, 0.95, l));
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
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
    return useRoom.subscribe((s) => {
      document.body.style.cursor = s.hover ? "pointer" : "";
    });
  }, []);

  return (
    <Canvas
      flat
      shadows="soft"
      dpr={[1, 1.75]}
      camera={{ fov: HOME_FOV, near: 0.05, far: 40, position: HOME_VIEW.pos }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
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
        <Lightformer form="rect" intensity={1.3} color="#ffa550" position={[-3, 2, 1]} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#3fd2f0" position={[2.5, 1.5, 3]} scale={[2, 2, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#4fb6dc" position={[0, 2, -4]} scale={[2, 2, 1]} />
        <Lightformer form="rect" intensity={0.2} color="#ffd0a0" position={[0, 4, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[4, 2, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Shell />
        <Props />
        <Shelf />
        <TapeRack />
        <CdStack />
        <CdPlayer />
        <Guitar />
        <Frames />
        <Notes />
        <Cards />
        <Posters />
        <Furniture />
        <Keyboard />
        <Canonet />
        <Album />
        <Coffee />
        <LampGlow />
        <Haze />
        <Ready onReady={onReady} />
      </Suspense>
      {/* The scene is drawn into the composer's buffer, not the canvas, so the canvas's own
          antialiasing never reaches it. Multisampling that buffer is the obvious fix, but on
          Intel/Mesa it renders the frame black, so edges are smoothed by SMAA after tone mapping. */}
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.2} luminanceThreshold={0.86} luminanceSmoothing={0.2} radius={0.8} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Grade />
        <SMAA preset={SMAAPreset.ULTRA} />
        <Vignette offset={0.24} darkness={0.88} />
        <Noise opacity={0.035} />
      </EffectComposer>
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
