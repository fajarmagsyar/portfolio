import fs from "fs";
import path from "path";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const file = path.resolve("public/models/standing_lamp/scene.gltf");
const data = fs.readFileSync(file);
const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
const loader = new GLTFLoader();
loader.parse(arrayBuffer, path.dirname(file) + "/", (gltf) => {
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  console.log("size", size.x, size.y, size.z);
  console.log("center", center.x, center.y, center.z);
  console.log("min", box.min.x, box.min.y, box.min.z);
  console.log("max", box.max.x, box.max.y, box.max.z);
}, (err) => { console.error(err); process.exit(1); });
