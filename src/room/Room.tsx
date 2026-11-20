"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { ENTER_VIEW, FOCUS_FOV, HOME_FOV, HOME_VIEW, POS, VIEWS } from "./layout";
import { useRoom } from "./store";
import { Shell } from "./objects/Shell";
import { Props } from "./objects/Props";
import { CassettePlayer, TapeRack } from "./objects/Tapes";
import { CdPlayer, CdStack } from "./objects/Cds";
import { Guitar } from "./objects/Guitar";
import { Cards, Frames, Notes } from "./objects/Paper";
import { Posters } from "./objects/Posters";
import { Coffee, FairyLights, Haze, LampGlow } from "./objects/Cozy";

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

/** Eases the camera between the wide view and each object's close-up, with a little mouse drift. */
function CameraRig() {
  const focus = useRoom((s) => s.focus);
  const booted = useRoom((s) => s.booted);
  const look = useRef(new THREE.Vector3(...HOME_VIEW.look));
  const first = useRef(true);
  const shift = useRef(0);
  const size = useThree((s) => s.size);

  useFrame((state, dt) => {
    const pointer = state.pointer;
    const camera = state.camera as THREE.PerspectiveCamera;
    const view = !booted ? ENTER_VIEW : focus ? VIEWS[focus] : HOME_VIEW;
    tmpLook.set(...view.look);
    tmpPos.set(...view.pos);
    // on narrow windows step back so the whole desk stays in frame
    const aspect = size.width / size.height;
    const pull = Math.max(1, 1.75 / aspect);
    tmpPos.sub(tmpLook).multiplyScalar(pull).add(tmpLook);
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
      const k = 1 - Math.exp(-dt * (booted && !focus ? 2.2 : 3.2));
      camera.position.lerp(tmpPos, k);
      look.current.lerp(tmpLook, k);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov += (fov - camera.fov) * k;
        camera.updateProjectionMatrix();
      }
    }
    camera.lookAt(look.current);

    // slide the picture left while a side panel is open (the TV takes the whole screen instead)
    const goal = focus && focus !== "tv" ? 0.19 : 0;
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
    if (lamp.current) lamp.current.intensity = 5.2 + Math.sin(clock.elapsedTime * 1.3) * 0.04;
  });
  return (
    <>
      {/* Night: the room is lit by what is in it. A little ambient keeps the shadows from going to black. */}
      <hemisphereLight args={["#8f96b8", "#3a2414", 0.32]} />
      {/* desk lamp: the warm key light, low on the left */}
      <pointLight
        ref={lamp}
        position={[POS.lamp[0] + 0.34, POS.lamp[1] + 0.6, POS.lamp[2] + 0.14]}
        color="#ffc88a"
        distance={8}
        decay={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.002}
        shadow-radius={6}
      />
      {/* tungsten fill from the unseen room behind the camera */}
      <pointLight position={[-1.4, 2.0, 2.6]} color="#ffb47a" intensity={2.2} distance={9} decay={1.5} />
      {/* cold night light coming through the glass */}
      <pointLight position={[POS.window[0], POS.window[1] + 0.2, POS.window[2] + 0.45]} color="#6f8fe8" intensity={2.6} distance={4.5} decay={1.8} />
      {/* and a cold edge on everything from the far side, so shapes separate from the dark */}
      <pointLight position={[1.9, 1.5, 0.6]} color="#5a74c8" intensity={1.1} distance={5} decay={1.6} />
    </>
  );
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
        scene.background = new THREE.Color("#120d09");
      }}
    >
      <CameraRig />
      {/* a little smoke in the air: far corners soften and sink into brown */}
      <fogExp2 attach="fog" args={["#0d0907", 0.05]} />
      <Lights />
      <Environment resolution={64} frames={1}>
        <color attach="background" args={["#0a0806"]} />
        <Lightformer form="rect" intensity={1.2} color="#ffb060" position={[3, 2, 1]} scale={[3, 2, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#6f90e0" position={[2, 2, -4]} scale={[2, 2, 1]} />
        <Lightformer form="rect" intensity={0.25} color="#ffd9a8" position={[-3, 3, 3]} scale={[4, 1, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <Shell />
        <Props />
        <TapeRack />
        <CassettePlayer />
        <CdStack />
        <CdPlayer />
        <Guitar />
        <Frames />
        <Notes />
        <Cards />
        <Posters />
        <Coffee />
        <FairyLights />
        <LampGlow />
        <Haze />
        <Ready onReady={onReady} />
      </Suspense>
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.2} luminanceThreshold={0.86} luminanceSmoothing={0.2} radius={0.8} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.26} darkness={0.82} />
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
