import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { volumeCone, makeTextTexture } from './util';

export interface Truck {
  group: THREE.Group;
  update(x: number, z: number, speed: number, dt: number, braking: boolean, idling: boolean, t: number): void;
}

/**
 * The hero truck, stylised: a chunky 1940s step-side pickup with exaggerated, toy-like proportions.
 * Big wheels, a pillowy rounded cab and bonnet, fat pontoon fenders with headlight pods, two-tone
 * teal and cream paint, chunky wood stake rails, a roof rack with a mattress strapped on, and the load
 * roped down in the bed. Materials are satin rather than glossy, and every main shape carries a thin
 * ink outline, which ties the full game back to the jam version's hand-drawn line.
 */

const WHEEL_R = 0.54;
const REAR_X = -0.85;
const FRONT_X = 3.15;
/** Half-width of the body; fenders and wheels sit outside it. */
const HALF = 0.82;
const INK = new THREE.Color('#15111f');

/** A side profile, extruded across the truck with soft, pillowy bevels, centred on z. */
function puff(shape: THREE.Shape, depth: number, bevel: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 32 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** The inverted-hull outline: the same shape, pushed out along its normals, drawn back faces only, in ink. */
const outlineMat = (thickness: number) =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { thickness: { value: thickness }, color: { value: INK } },
    vertexShader: `uniform float thickness; void main(){ vec3 p = position + normalize(normal) * thickness; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
  });
const OUTLINE = outlineMat(0.03);
const OUTLINE_THIN = outlineMat(0.016);

export function buildTruck(scene: THREE.Scene): Truck {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshPhysicalMaterial({ color: '#2fa597', roughness: 0.55, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.45, envMapIntensity: 0.6 });
  const paintDeep = new THREE.MeshPhysicalMaterial({ color: '#24877c', roughness: 0.6, metalness: 0.05, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.5 });
  const cream = new THREE.MeshPhysicalMaterial({ color: '#f2e5c8', roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.5 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#dfe4ea', metalness: 0.8, roughness: 0.32, envMapIntensity: 0.7 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#1c1a22', roughness: 0.92 });
  const under = new THREE.MeshStandardMaterial({ color: '#17151d', roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: '#22324a', roughness: 0.2, metalness: 0.1, envMapIntensity: 0.6, transparent: true, opacity: 0.55, depthWrite: false });
  const wood = new THREE.MeshStandardMaterial({ color: '#8d5c3a', roughness: 0.8 });
  const woodLight = new THREE.MeshStandardMaterial({ color: '#a8734b', roughness: 0.8 });

  /** Adds a mesh, casting and taking shadows, with an ink outline unless told otherwise. */
  const put = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], outline: THREE.Material | null = OUTLINE) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    if (outline) m.add(new THREE.Mesh(geo, outline));
    parent.add(m);
    return m;
  };

  // ---- Frame underneath.
  put(body, new RoundedBoxGeometry(5.2, 0.22, 1.3, 2, 0.06), under, [1.1, 0.5, 0], null);

  // ---- The cab: a rounded bubble, teal below and cream above the belt line.
  const cab = new THREE.Shape();
  cab.moveTo(1.05, 0.62);
  cab.lineTo(1.05, 1.62);
  cab.bezierCurveTo(1.05, 2.12, 1.25, 2.18, 1.75, 2.18);
  cab.bezierCurveTo(2.2, 2.18, 2.42, 2.05, 2.55, 1.66);
  cab.lineTo(2.7, 1.28);
  cab.lineTo(2.7, 0.62);
  cab.lineTo(1.05, 0.62);
  put(body, puff(cab, HALF * 2 - 0.3, 0.15), paint, [0, 0, 0]);
  const top = new THREE.Shape();
  top.moveTo(1.1, 1.97);
  top.bezierCurveTo(1.16, 2.18, 1.35, 2.2, 1.75, 2.2);
  top.bezierCurveTo(2.15, 2.2, 2.32, 2.12, 2.42, 1.97);
  top.lineTo(1.1, 1.97);
  put(body, puff(top, HALF * 2 - 0.26, 0.15), cream, [0, 0, 0], null);
  // A cream belt-line stripe round the cab.
  put(body, new RoundedBoxGeometry(1.72, 0.07, HALF * 2 + 0.04, 2, 0.03), cream, [1.88, 1.18, 0], null);
  // Side windows (both sides) and a rear window, framed in chrome, with the driver inside.
  const win = new THREE.Shape();
  win.moveTo(1.22, 1.3);
  win.lineTo(1.22, 1.7);
  win.bezierCurveTo(1.22, 1.88, 1.35, 1.9, 1.7, 1.9);
  win.bezierCurveTo(2.05, 1.9, 2.2, 1.82, 2.3, 1.6);
  win.lineTo(2.42, 1.3);
  win.lineTo(1.22, 1.3);
  for (const side of [1, -1]) {
    const pane = new THREE.Mesh(new THREE.ShapeGeometry(win, 24), glass);
    pane.position.z = side * (HALF + 0.035);
    if (side < 0) {
      pane.rotation.y = Math.PI;
      pane.position.x = 3.66;
    }
    body.add(pane);
    const frame = new THREE.Mesh(new THREE.ShapeGeometry(win, 24), chrome);
    frame.scale.set(1.04, 1.04, 1);
    frame.position.set(-0.07, -0.06, side * (HALF + 0.025));
    if (side < 0) {
      frame.rotation.y = Math.PI;
      frame.position.x = 3.66 + 0.07;
    }
    body.add(frame);
  }
  const head = put(body, new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshStandardMaterial({ color: '#f1d6b8', roughness: 0.6 }), [1.75, 1.6, 0.2], OUTLINE_THIN);
  put(head, new THREE.SphereGeometry(0.21, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e7a23a', roughness: 0.7 }), [0, 0.05, 0], OUTLINE_THIN);
  put(head, new RoundedBoxGeometry(0.22, 0.04, 0.3, 2, 0.02), new THREE.MeshStandardMaterial({ color: '#e7a23a', roughness: 0.7 }), [0.16, 0.06, 0], null);
  // The company name, hand-painted on the door.
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.16), new THREE.MeshStandardMaterial({ map: makeTextTexture('SHIFT HAPPENS', '#f2e5c8', 'transparent', 900), transparent: true, roughness: 0.6 }));
  decal.position.set(1.86, 0.95, HALF + 0.16);
  body.add(decal);
  put(body, new RoundedBoxGeometry(0.22, 0.05, 0.06, 2, 0.02), chrome, [2.2, 1.12, HALF + 0.15], null);
  // Side mirror on a stalk.
  put(body, new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6).rotateX(Math.PI / 2), chrome, [2.5, 1.5, HALF + 0.3], null);
  put(body, new RoundedBoxGeometry(0.08, 0.22, 0.14, 2, 0.04), chrome, [2.5, 1.5, HALF + 0.48], OUTLINE_THIN);

  // ---- The bonnet: a long rounded nose, narrower than the cab, with a chrome strip along its crown.
  const hood = new THREE.Shape();
  hood.moveTo(2.6, 0.62);
  hood.lineTo(2.6, 1.42);
  hood.bezierCurveTo(3.1, 1.46, 3.75, 1.42, 3.98, 1.16);
  hood.bezierCurveTo(4.08, 0.95, 4.08, 0.72, 4.02, 0.62);
  hood.lineTo(2.6, 0.62);
  put(body, puff(hood, 1.0, 0.16), paint, [0, 0, 0]);
  put(body, new RoundedBoxGeometry(1.25, 0.04, 0.08, 2, 0.02), chrome, [3.25, 1.6, 0], null).rotation.z = -0.07;
  // Grille: a cream surround with tall chrome teeth, the face of the truck.
  put(body, new RoundedBoxGeometry(0.14, 0.62, 0.9, 3, 0.06), cream, [4.12, 0.92, 0]);
  for (let i = 0; i < 7; i++) put(body, new RoundedBoxGeometry(0.06, 0.5, 0.06, 2, 0.02), chrome, [4.2, 0.92, -0.33 + i * 0.11], null);

  // ---- Pontoon fenders: big swooping arches outside the body, the truck's signature shape.
  const fender = (cx: number, frontSweep: number, backSweep: number) => {
    const s = new THREE.Shape();
    const R = WHEEL_R + 0.12;
    s.moveTo(cx - R - backSweep, 0.5);
    s.bezierCurveTo(cx - R - backSweep * 0.5, 0.6, cx - R, 0.88, cx - R * 0.55, 1.02);
    s.bezierCurveTo(cx - 0.1, 1.15, cx + R * 0.5, 1.1, cx + R * 0.85, 0.92);
    s.bezierCurveTo(cx + R + frontSweep * 0.4, 0.82, cx + R + frontSweep, 0.7, cx + R + frontSweep, 0.55);
    s.lineTo(cx + R + 0.02, 0.5);
    s.absarc(cx, WHEEL_R, R - 0.04, 0, Math.PI, false);
    s.lineTo(cx - R - backSweep, 0.5);
    return puff(s, 0.34, 0.12);
  };
  for (const side of [1, -1]) {
    put(body, fender(FRONT_X, 0.28, 0.1), paint, [0, 0, side * (HALF + 0.2)]);
    put(body, fender(REAR_X, 0.15, 0.2), paintDeep, [0, 0, side * (HALF + 0.12)]);
    // Running board between the fenders, step-side style.
    put(body, new RoundedBoxGeometry(2.0, 0.08, 0.38, 2, 0.03), under, [1.3, 0.56, side * (HALF + 0.2)], OUTLINE_THIN);
    // Headlight pods on the front fenders: a chrome bucket, a glass lens, a little visor.
    const pod = put(body, new THREE.SphereGeometry(0.2, 24, 16), chrome, [3.66, 1.08, side * (HALF + 0.2)]);
    pod.scale.set(1.25, 1, 1);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshStandardMaterial({ color: '#fff4d8', emissive: '#ffe8b8', emissiveIntensity: 2.2 }));
    lens.rotation.y = Math.PI / 2;
    lens.position.set(3.92, 1.08, side * (HALF + 0.2));
    body.add(lens);
    // Mud flap behind the rear wheel.
    put(body, new RoundedBoxGeometry(0.04, 0.32, 0.3, 2, 0.02), rubber, [REAR_X - WHEEL_R - 0.25, 0.4, side * (HALF + 0.12)], OUTLINE_THIN);
  }

  // ---- The bed: chunky sides with a cream cap, a tailgate, and tall wooden stake rails.
  const bedX = -0.42;
  put(body, new THREE.BoxGeometry(2.9, 0.1, HALF * 2 - 0.1), wood, [bedX, 0.66, 0], null);
  for (const side of [1, -1]) {
    put(body, new RoundedBoxGeometry(2.95, 0.6, 0.12, 3, 0.05), paint, [bedX, 0.95, side * (HALF - 0.04)]);
    put(body, new RoundedBoxGeometry(2.98, 0.06, 0.16, 2, 0.03), cream, [bedX, 1.27, side * (HALF - 0.04)], null);
    for (let i = 0; i < 5; i++) put(body, new RoundedBoxGeometry(0.1, 0.7, 0.1, 2, 0.03), wood, [-1.78 + i * 0.68, 1.62, side * (HALF - 0.04)], OUTLINE_THIN);
    for (const y of [1.55, 1.9]) put(body, new RoundedBoxGeometry(2.95, 0.09, 0.07, 2, 0.03), woodLight, [bedX, y, side * (HALF - 0.04)], OUTLINE_THIN);
  }
  put(body, new RoundedBoxGeometry(0.12, 0.6, HALF * 2 + 0.05, 3, 0.05), paint, [-1.9, 0.95, 0]);
  const tailMat = new THREE.MeshStandardMaterial({ color: '#6a1018', emissive: '#ff2b3a', emissiveIntensity: 1.2 });
  for (const side of [1, -1]) put(body, new RoundedBoxGeometry(0.06, 0.2, 0.14, 2, 0.03), tailMat, [-1.97, 1.08, side * 0.62], OUTLINE_THIN);
  // Bumpers with overriders.
  put(body, new RoundedBoxGeometry(0.22, 0.2, HALF * 2 + 0.6, 3, 0.09), chrome, [4.22, 0.5, 0]);
  for (const side of [1, -1]) put(body, new RoundedBoxGeometry(0.16, 0.34, 0.12, 2, 0.05), chrome, [4.3, 0.56, side * 0.4], OUTLINE_THIN);
  put(body, new RoundedBoxGeometry(0.2, 0.18, HALF * 2 + 0.4, 3, 0.08), chrome, [-2.0, 0.5, 0]);
  // Exhaust pipe peeking out at the back.
  put(body, new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10).rotateZ(Math.PI / 2), chrome, [-2.05, 0.42, 0.55], OUTLINE_THIN);

  // ---- The roof rack, with a rolled mattress and a suitcase strapped to it.
  for (const z of [-0.6, 0.6]) put(body, new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8).rotateZ(Math.PI / 2), chrome, [1.75, 2.36, z], null);
  for (const x of [1.25, 2.2]) put(body, new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8).rotateX(Math.PI / 2), chrome, [x, 2.36, 0], null);
  const mattress = put(body, new THREE.CapsuleGeometry(0.24, 1.0, 8, 20), new THREE.MeshStandardMaterial({ color: '#d7c3e6', roughness: 0.85 }), [1.65, 2.62, 0]);
  mattress.rotation.z = Math.PI / 2;
  put(body, new RoundedBoxGeometry(0.5, 0.32, 0.7, 3, 0.06), new THREE.MeshStandardMaterial({ color: '#b5462f', roughness: 0.6 }), [2.25, 2.55, 0.2]);
  const strap = new THREE.MeshStandardMaterial({ color: '#e2a940', roughness: 0.7 });
  for (const x of [1.35, 1.95]) put(body, new THREE.TorusGeometry(0.27, 0.025, 6, 24), strap, [x, 2.62, 0], null).rotation.y = Math.PI / 2;

  // ---- The load in the bed: boxes, an armchair, a lamp, a plant, roped down, and Biscuit on top.
  const cardboard = new THREE.MeshStandardMaterial({ color: '#c08a55', roughness: 0.9 });
  const tape = new THREE.MeshStandardMaterial({ color: '#e8d4a6', roughness: 0.6 });
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, rot = 0) => {
    const b = put(body, new RoundedBoxGeometry(w, h, d, 2, 0.04), cardboard, [x, y + h / 2, z], OUTLINE_THIN);
    b.rotation.y = rot;
    put(b, new THREE.BoxGeometry(w + 0.01, 0.01, 0.12), tape, [0, h / 2 + 0.002, 0], null);
    return y + h;
  };
  const stack = box(-1.35, 0.71, 0.3, 0.8, 0.66, 0.7, 0.05);
  box(-1.3, 0.71, -0.42, 0.72, 0.52, 0.62, -0.1);
  const stack2 = box(-1.32, stack, 0.28, 0.58, 0.44, 0.52, 0.18);
  // Armchair: seat, back and arms in mustard velvet.
  const velvet = new THREE.MeshStandardMaterial({ color: '#d79a2b', roughness: 0.95 });
  put(body, new RoundedBoxGeometry(0.75, 0.32, 0.8, 3, 0.1), velvet, [-0.35, 0.88, 0.05], OUTLINE_THIN);
  put(body, new RoundedBoxGeometry(0.2, 0.75, 0.8, 3, 0.09), velvet, [-0.62, 1.25, 0.05], OUTLINE_THIN);
  for (const z of [-0.36, 0.46]) put(body, new RoundedBoxGeometry(0.75, 0.3, 0.16, 3, 0.07), velvet, [-0.35, 1.12, z], OUTLINE_THIN);
  // Floor lamp and plant.
  put(body, new THREE.CylinderGeometry(0.025, 0.025, 1.4, 8), chrome, [0.55, 1.4, -0.45], null);
  put(body, new THREE.CylinderGeometry(0.17, 0.3, 0.34, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#ffd48a', roughness: 0.7, side: THREE.DoubleSide }), [0.55, 2.12, -0.45], OUTLINE_THIN);
  put(body, new THREE.CylinderGeometry(0.2, 0.15, 0.32, 18), new THREE.MeshStandardMaterial({ color: '#c0532f', roughness: 0.7 }), [0.5, 0.87, 0.48], OUTLINE_THIN);
  const leaf = new THREE.MeshStandardMaterial({ color: '#4a9a5c', roughness: 0.75 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = put(body, new THREE.SphereGeometry(0.15, 12, 8), leaf, [0.5 + Math.cos(a) * 0.13, 1.2 + (i % 3) * 0.1, 0.48 + Math.sin(a) * 0.13], null);
    l.scale.set(0.55, 1.35, 0.3);
    l.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6);
  }
  // Ropes over the load, tied to the stake rails.
  const rope = new THREE.MeshStandardMaterial({ color: '#e0cf9c', roughness: 0.8 });
  for (const x of [-1.3, -0.35]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 1.88, HALF), new THREE.Vector3(x, x < -1 ? stack2 + 0.06 : 1.5, 0.3), new THREE.Vector3(x, x < -1 ? stack2 + 0.06 : 1.5, -0.3), new THREE.Vector3(x, 1.88, -HALF)]);
    put(body, new THREE.TubeGeometry(curve, 20, 0.02, 6), rope, [0, 0, 0], null);
  }
  // Biscuit: a ginger loaf with ears and a tail, sitting on the top box, eyes catching the light.
  const fur = new THREE.MeshStandardMaterial({ color: '#ea9638', roughness: 0.9 });
  const cat = new THREE.Group();
  put(cat, new THREE.CapsuleGeometry(0.17, 0.24, 8, 16).rotateZ(Math.PI / 2), fur, [0, 0, 0], OUTLINE_THIN);
  const catHead = put(cat, new THREE.SphereGeometry(0.15, 18, 14), fur, [0.24, 0.13, 0], OUTLINE_THIN);
  for (const s of [1, -1]) {
    put(catHead, new THREE.ConeGeometry(0.055, 0.12, 4), fur, [0.01, 0.15, s * 0.075], OUTLINE_THIN);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#d9ff6a', emissiveIntensity: 2 }));
    eye.position.set(0.13, 0.02, s * 0.055);
    catHead.add(eye);
  }
  const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.3, -0.05, 0), new THREE.Vector3(-0.45, 0.1, 0.1), new THREE.Vector3(-0.38, 0.28, 0.15)]);
  put(cat, new THREE.TubeGeometry(tail, 12, 0.045, 8), fur, [0, 0, 0], OUTLINE_THIN);
  cat.position.set(-1.32, stack2 + 0.17, 0.28);
  body.add(cat);

  // ---- Wheels: big chunky tyres with tread lugs, cream hubcaps with a red centre.
  const wheels: THREE.Group[] = [];
  const tyreGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.36, 40).rotateX(Math.PI / 2);
  const lugGeo = new RoundedBoxGeometry(0.12, 0.05, 0.38, 2, 0.02);
  for (const wx of [REAR_X, FRONT_X]) {
    for (const side of [1, -1]) {
      const w = new THREE.Group();
      put(w, tyreGeo, rubber, [0, 0, 0]);
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * Math.PI * 2;
        const lug = put(w, lugGeo, rubber, [Math.cos(a) * (WHEEL_R + 0.01), Math.sin(a) * (WHEEL_R + 0.01), 0], null);
        lug.rotation.z = a + Math.PI / 2;
      }
      const face = side * 0.185;
      put(w, new THREE.CylinderGeometry(0.34, 0.34, 0.02, 32).rotateX(Math.PI / 2), cream, [0, 0, face], null);
      put(w, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c23a2f', roughness: 0.5 }), [0, 0, face + side * 0.01], null);
      put(w, new THREE.SphereGeometry(0.09, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX((side * Math.PI) / 2), chrome, [0, 0, face + side * 0.02], null);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        put(w, new THREE.SphereGeometry(0.018, 6, 4), chrome, [Math.cos(a) * 0.14, Math.sin(a) * 0.14, face + side * 0.025], null);
      }
      w.position.set(wx, WHEEL_R, side * (HALF + 0.18));
      group.add(w);
      wheels.push(w);
    }
  }

  // ---- Lights: headlight spots and soft beams, and the tail lights' glow.
  for (const side of [1, -1]) {
    const s = new THREE.SpotLight('#ffefc8', 55, 36, 0.38, 0.55, 1.6);
    s.position.set(3.95, 1.08, side * (HALF + 0.2));
    s.target.position.set(14, 0.1, side * (HALF + 0.2));
    s.castShadow = side > 0;
    s.shadow.mapSize.set(1024, 512);
    s.shadow.bias = -0.0005;
    body.add(s, s.target);
  }
  const beam = volumeCone(1.4, 8, '#ffefc8', 0.05);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(3.95 + 4, 1.1, HALF + 0.2);
  body.add(beam);
  const tailGlow = new THREE.PointLight('#ff2b3a', 2, 5, 2);
  tailGlow.position.set(-2.2, 1.05, 0.6);
  body.add(tailGlow);

  // Centre the truck on its own middle.
  body.position.x = -1.1;
  for (const w of wheels) w.position.x -= 1.1;
  scene.add(group);

  const exhaust: THREE.Mesh[] = [];
  const puffMat = new THREE.MeshStandardMaterial({ color: '#a8a0b8', transparent: true, opacity: 0.22, roughness: 1, depthWrite: false });
  let roll = 0;
  let puffT = 0;
  return {
    group,
    update(x, z, speed, dt, braking, idling, t) {
      group.position.set(x, 0, z);
      roll += (speed * dt) / WHEEL_R;
      for (const w of wheels) w.rotation.z = -roll;
      // Springs: an idle shudder, a nose-dip under braking, a gentle sway on the move.
      body.position.y = idling ? Math.sin(t * 36) * 0.007 : Math.sin(t * 8) * 0.006 * Math.min(1, speed / 6);
      body.rotation.z = braking ? -0.018 : Math.sin(t * 1.7) * 0.003 * Math.min(1, speed / 6);
      tailMat.emissiveIntensity = braking ? 5 : 1.2;
      tailGlow.intensity = braking ? 8 : 2;
      puffT += dt;
      if (puffT > (idling ? 0.35 : 0.15)) {
        puffT = 0;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), puffMat.clone());
        p.position.set(x - 3.2, 0.42, z + 0.55);
        scene.add(p);
        exhaust.push(p);
      }
      for (let i = exhaust.length - 1; i >= 0; i--) {
        const p = exhaust[i];
        const m = p.material as THREE.MeshStandardMaterial;
        p.position.y += dt * 0.4;
        p.position.x -= dt * (0.6 + speed * 0.3);
        p.scale.multiplyScalar(1 + dt * 1.2);
        m.opacity -= dt * 0.11;
        if (m.opacity <= 0) {
          scene.remove(p);
          p.geometry.dispose();
          m.dispose();
          exhaust.splice(i, 1);
        }
      }
    },
  };
}
