/**
 * Scenes of TechInsight's data corridor.
 *
 * Ported from the production site (jasc66 BlogTecno, components/flyover/scenes.ts,
 * live at https://blog-tecno.vercel.app/) with the TypeScript types removed: same
 * geometry, same rng calls in the same order, so with the same seed this builds the
 * world the real site builds. The one other change is in buildComunidad's tick.
 *
 * Each builder gets `(materials, textures, { rng, performance, palette })` and
 * returns a THREE.Group. `rng` is the only source of randomness allowed.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Named indices into the palette, so the builders carry no magic numbers.
const SLATE = 1;  // #111827 — structure
const STEEL = 2;  // #1f2937 — panels
const MINT = 3;   // #4ade80 — live detail
const ACCENT = 4; // #16a34a — brand green

// Rim fresnel, used on ONE prop only: the core of the peak scene.
function makeFresnelMaterial(accentHex, power = 2.4) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(accentHex) },
      uPower: { value: power },
    },
    vertexShader: `
      varying vec3 vNormal; varying vec3 vView;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uPower;
      varying vec3 vNormal; varying vec3 vView;
      void main(){
        float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), uPower);
        gl_FragColor = vec4(uColor * rim, rim);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

// Tunnel segment: in the corridor archetype the tunnel does the visual work, so each
// scene brings its own and the props can stay few.
function buildTunnelRing(materials, rng, ribs) {
  const g = new THREE.Group();

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(11, 11, 30, 12, 1, true),
    new THREE.MeshStandardMaterial({
      color: materials[SLATE].color,
      side: THREE.BackSide,
      roughness: 0.45,
      metalness: 0.35,
      envMapIntensity: 0.7,
    }),
  );
  shell.rotation.z = Math.PI / 2; // tunnel axis along X, the direction of flight
  shell.receiveShadow = true;
  g.add(shell);

  // Ribs mark the speed as they pass.
  const ribGeo = new THREE.TorusGeometry(10.4, 0.16, 6, 24);
  for (let i = 0; i < ribs; i++) {
    const rib = new THREE.Mesh(ribGeo, materials[STEEL]);
    rib.position.x = -14 + (i / (ribs - 1)) * 28;
    rib.rotation.y = Math.PI / 2;
    rib.rotation.z = rng() * 0.4;
    g.add(rib);
  }
  return g;
}

// Data tower: a stack of bevelled slabs narrowing as it rises.
function buildDataTower(floors, size, material, rng) {
  const g = new THREE.Group();
  for (let i = 0; i < floors; i++) {
    const s = size * (1 - i * 0.06);
    const slab = new THREE.Mesh(new RoundedBoxGeometry(s, size * 0.34, s, 3, size * 0.03), material);
    slab.position.y = i * size * 0.42;
    slab.rotation.y = rng() * 0.5;
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);
  }
  return g;
}

// Floating panel: one of the blog's articles as a physical object in the tunnel.
function buildPanel(w, h, material) {
  const panel = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.12, 3, 0.05), material);
  panel.castShadow = true;
  return panel;
}

// The signature motif: an extruded, bevelled hexagon — not a Three.js primitive.
function buildNode(radius, depth, material) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: radius * 0.08,
    bevelSize: radius * 0.08,
    bevelSegments: 3,
  });
  geo.center();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// A swarm of small nodes through one InstancedMesh.
function buildNodeSwarm(count, spread, material, rng) {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), material, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const r = 3 + rng() * spread;
    dummy.position.set((rng() - 0.5) * 22, Math.sin(angle) * r, Math.cos(angle) * r);
    dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, 0);
    dummy.scale.setScalar(0.6 + rng() * 0.9);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Scene 1 — The signal: the corridor's entrance, almost empty on purpose.
export function buildSignal(materials, _textures, { rng, performance }) {
  const g = new THREE.Group();
  g.add(buildTunnelRing(materials, rng, 7));

  const node = buildNode(1.6, 0.5, materials[STEEL]);
  node.rotation.y = Math.PI / 2;
  g.add(node);

  if (performance === 'rich') g.add(buildNodeSwarm(28, 4, materials[MINT], rng));

  g.userData.tick = (elapsed) => {
    node.rotation.z = elapsed * 0.25;
  };
  return g;
}

// Scene 2 — News: panels drifting past like headlines.
export function buildNoticias(materials, _textures, { rng }) {
  const g = new THREE.Group();
  g.add(buildTunnelRing(materials, rng, 9));

  const panels = [];
  for (let i = 0; i < 7; i++) {
    const panel = buildPanel(3.4, 2.1, i % 3 === 0 ? materials[ACCENT] : materials[STEEL]);
    const angle = (i / 7) * Math.PI * 2 + rng() * 0.3;
    const r = 5.5 + rng() * 2;
    panel.position.set(-11 + i * 3.4, Math.sin(angle) * r, Math.cos(angle) * r);
    panel.lookAt(panel.position.x, 0, 0); // every panel faces the tunnel axis
    g.add(panel);
    panels.push(panel);
  }

  g.userData.tick = (elapsed) => {
    panels.forEach((panel, i) => {
      panel.rotation.z = Math.sin(elapsed * 0.4 + i) * 0.08;
    });
  };
  return g;
}

// Scene 3 — Investigations: the data city, densest scene of the flight.
export function buildInvestigacion(materials, _textures, { rng, performance }) {
  const g = new THREE.Group();
  g.add(buildTunnelRing(materials, rng, 11));

  // Towers hanging from floor and ceiling: a mirrored skyline.
  const towerCount = performance === 'rich' ? 9 : 6;
  for (let i = 0; i < towerCount; i++) {
    const floors = 3 + Math.floor(rng() * 4);
    const tower = buildDataTower(floors, 1.5, materials[STEEL], rng);
    const flipped = i % 2 === 1;
    tower.position.set(-11 + (i / (towerCount - 1)) * 22, flipped ? 7.5 : -7.5, (rng() - 0.5) * 6);
    if (flipped) tower.rotation.z = Math.PI;
    g.add(tower);
  }

  if (performance === 'rich') g.add(buildNodeSwarm(40, 5, materials[MINT], rng));
  return g;
}

// Scene 4 — The core, the PEAK scene: the build's only emissive prop and only fresnel.
export function buildNucleo(materials, _textures, { rng, palette }) {
  const g = new THREE.Group();
  g.add(buildTunnelRing(materials, rng, 9));

  const coreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.accent),
    emissive: new THREE.Color(palette.accent),
    emissiveIntensity: 1.3,
    roughness: 0.25,
    metalness: 0.4,
  });
  const core = buildNode(2.6, 1.2, coreMat);
  core.rotation.y = Math.PI / 2;
  g.add(core);

  const shell = new THREE.Mesh(core.geometry, makeFresnelMaterial(palette.accent));
  shell.scale.multiplyScalar(1.07);
  core.add(shell);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4 + i * 1.3, 0.07, 6, 40), materials[MINT]);
    ring.rotation.set(rng() * Math.PI, rng() * Math.PI, 0);
    g.add(ring);
    rings.push(ring);
  }

  g.userData.tick = (elapsed) => {
    core.rotation.z = elapsed * 0.3;
    rings.forEach((ring, i) => {
      ring.rotation.z = elapsed * (0.12 + i * 0.06) * (i % 2 ? -1 : 1);
    });
  };
  return g;
}

// Scene 5 — The community / exit: nodes converging, CTA to the forum.
export function buildComunidad(materials, _textures, { rng, performance }) {
  const g = new THREE.Group();
  g.add(buildTunnelRing(materials, rng, 8));

  const nodes = [];
  const count = performance === 'rich' ? 10 : 7;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const node = buildNode(0.9, 0.3, i % 2 ? materials[ACCENT] : materials[STEEL]);
    const r = 6;
    node.position.set((rng() - 0.5) * 10, Math.sin(angle) * r, Math.cos(angle) * r);
    node.lookAt(node.position.x, 0, 0);
    g.add(node);
    nodes.push(node);
  }

  const exit = buildNode(1.8, 0.6, materials[MINT]);
  exit.rotation.y = Math.PI / 2;
  exit.position.x = 8;
  g.add(exit);

  // The one change from the production file: there the drift is `x += sin(...) * 0.004`
  // per frame, which depends on how many frames were drawn before, so
  // `renderAt(p, { time })` could not give the same frame twice. This is the same
  // motion at 60fps (0.004 * 60 / 0.5 = 0.48), written as a function of `elapsed`.
  const baseX = nodes.map((node) => node.position.x);
  g.userData.tick = (elapsed) => {
    nodes.forEach((node, i) => {
      node.position.x = baseX[i] + 0.48 * (Math.cos(i) - Math.cos(elapsed * 0.5 + i));
    });
    exit.rotation.z = elapsed * 0.4;
  };
  return g;
}
