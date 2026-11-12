import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import '@fontsource/fraunces/900.css';
import '@fontsource/karla/700.css';
import { buildTruck, type Truck } from './truck';
import { volumeCone, makeTextTexture, seeded } from './util';

/**
 * Look-development sample for the full ("AAA") version of Shifting Day.
 *
 * A real 3D scene, seen side-on like a 2D game (the play happens on the plane z ≈ 1), rendered with
 * physically based materials and lights: a physical sky at dusk, image-based reflections from that sky,
 * area lights under the fuel-stop canopy, spot lights in the street lamps and headlights with real
 * shadows, clear-coat paint on the truck, a wet road that mirrors every light, distance fog, valley mist,
 * light shafts, rain, bloom, filmic tone mapping, and a final grade with vignette and grain.
 */

// Signs are painted with the game's fonts, so wait for them before building anything.
await Promise.all([document.fonts.load('900 40px Fraunces'), document.fonts.load('700 20px Karla')]);
RectAreaLightUniformsLib.init();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const HAZE = new THREE.Color('#5d4672');
scene.fog = new THREE.FogExp2(HAZE, 0.0085);

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 6000);
camera.position.set(0, 2.6, 23);

// ------------------------------------------------------------------ Sky and sun

/** Where the sun sits: just under 2° above the horizon, off to the right and behind the scene. */
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(88.4), THREE.MathUtils.degToRad(150));
const sky = new Sky();
sky.scale.setScalar(5000);
const su = sky.material.uniforms;
su.turbidity.value = 7;
su.rayleigh.value = 2.6;
su.mieCoefficient.value = 0.006;
su.mieDirectionalG.value = 0.86;
su.sunPosition.value.copy(sunDir);
scene.add(sky);

// The sky also lights and reflects in everything: render it once into an environment map.
const pmrem = new THREE.PMREMGenerator(renderer);
const skyScene = new THREE.Scene();
const skyCopy = new Sky();
skyCopy.scale.setScalar(5000);
Object.assign(skyCopy.material.uniforms.turbidity, { value: 7 });
skyCopy.material.uniforms.rayleigh.value = 2.6;
skyCopy.material.uniforms.mieCoefficient.value = 0.006;
skyCopy.material.uniforms.mieDirectionalG.value = 0.86;
skyCopy.material.uniforms.sunPosition.value.copy(sunDir);
skyScene.add(skyCopy);
const env = pmrem.fromScene(skyScene, 0.02).texture;
scene.environment = env;
scene.environmentIntensity = 0.4;

// Stars, coming out in the darker half of the sky.
{
  const r = seeded(5);
  const pts: number[] = [];
  for (let i = 0; i < 1400; i++) {
    const az = r() * Math.PI * 2;
    const el = 0.12 + r() * 1.3;
    const v = new THREE.Vector3().setFromSphericalCoords(3000, Math.PI / 2 - el, az);
    // Fewer stars on the bright side, where the sun went down.
    if (v.clone().normalize().dot(sunDir) > 0.55 && r() < 0.85) continue;
    pts.push(v.x, v.y, v.z);
  }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff4e8', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
}

const sun = new THREE.DirectionalLight('#ff9a62', 1.6);
sun.position.copy(sunDir).multiplyScalar(400);
scene.add(sun);
scene.add(new THREE.HemisphereLight('#7666b8', '#1b1424', 0.55));
const moon = new THREE.DirectionalLight('#b9c3ff', 0.75);
moon.position.set(-30, 40, 60);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -40;
moon.shadow.camera.right = 40;
moon.shadow.camera.top = 20;
moon.shadow.camera.bottom = -10;
moon.shadow.bias = -0.0005;
scene.add(moon, moon.target);

// ------------------------------------------------------------------ Mountains

const perlin = new ImprovedNoise();
/** Ridged fractal noise: sharp crests, the shape of real mountain ranges. */
const ridged = (x: number, z: number, oct = 5) => {
  let v = 0;
  let amp = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    const n = 1 - Math.abs(perlin.noise(x * f, z * f, o * 7.1));
    v += n * n * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return v / norm;
};

/**
 * A mountain range as a height-mapped plane. It does not take the scene fog; instead its colours are
 * mixed toward the haze by hand, so the peaks stay crisp while still sitting far away.
 */
function range(opts: { z0: number; depth: number; width: number; peak: number; scale: number; haze: number; snow: number; rock: string; seg: number; seed: number }) {
  const geo = new THREE.PlaneGeometry(opts.width, opts.depth, opts.seg, Math.round((opts.seg * opts.depth) / opts.width)).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const rock = new THREE.Color(opts.rock);
  const snow = new THREE.Color('#e9e5f4');
  const haze = new THREE.Color('#8a6f9c');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const back = (opts.depth / 2 - z) / opts.depth; // 0 at the front edge, 1 at the back.
    const lift = THREE.MathUtils.smoothstep(back, 0.0, 0.45);
    const h = (ridged(x * opts.scale + opts.seed, z * opts.scale) * opts.peak + perlin.noise(x * 0.01, z * 0.01, opts.seed) * opts.peak * 0.15) * lift;
    pos.setY(i, h);
    const c = rock.clone();
    const snowy = h > opts.snow + perlin.noise(x * 0.05, z * 0.05, 3) * opts.snow * 0.25;
    if (snowy) c.copy(snow);
    c.lerp(haze, opts.haze * (0.6 + back * 0.4));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, fog: false, envMapIntensity: 0.6 }));
  mesh.position.z = opts.z0 - opts.depth / 2;
  scene.add(mesh);
  return mesh;
}
range({ z0: -520, depth: 900, width: 4200, peak: 330, scale: 0.0042, haze: 0.42, snow: 175, rock: '#4a4166', seg: 760, seed: 11 });
range({ z0: -210, depth: 260, width: 2600, peak: 95, scale: 0.008, haze: 0.5, snow: 999, rock: '#241f3a', seg: 300, seed: 37 });

// ------------------------------------------------------------------ Ground, forest and mist

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 260), new THREE.MeshStandardMaterial({ color: '#141a18', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -0.02, -100);
ground.receiveShadow = true;
scene.add(ground);

/**
 * One pine: a trunk and eight tiers of branches. Each tier is a cone whose rim is torn into ragged,
 * drooping tips, so the outline against the sky looks like needles and boughs rather than geometry.
 */
function pineGeometry(seed: number) {
  const r = seeded(seed);
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.CylinderGeometry(0.1, 0.22, 3, 6).translate(0, 1.5, 0));
  const tiers = 8;
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const rad = 2.1 * (1 - k * 0.82) + 0.15;
    const h = 2.2 - k * 0.9;
    const cone = new THREE.ConeGeometry(rad, h, 18, 2, true);
    const p = cone.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -h / 2 + 0.01) {
        // The rim: alternate long and short tips, and let them hang down.
        const tip = (i % 2 ? 1.25 : 0.7) * (0.85 + r() * 0.35);
        p.setX(i, p.getX(i) * tip);
        p.setZ(i, p.getZ(i) * tip);
        p.setY(i, y - (tip - 0.7) * 0.5 - r() * 0.15);
      }
    }
    cone.computeVertexNormals();
    parts.push(cone.translate(0, 2.6 + t * 1.25 + h / 2, 0));
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}
{
  const mat = new THREE.MeshStandardMaterial({ color: '#1d3328', roughness: 0.95, side: THREE.DoubleSide });
  const count = 1800;
  // Three tree shapes, shared by all the instances, so no two neighbours look the same.
  const forests = [1, 2, 3].map((k) => new THREE.InstancedMesh(pineGeometry(k * 13), mat, count / 3));
  const counts = [0, 0, 0];
  const r = seeded(9);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const tint = new THREE.Color();
  let n = 0;
  while (n < count) {
    const x = -260 + r() * 620;
    const z = -30 - Math.pow(r(), 1.3) * 170;
    // A clearing where the fuel stop stands.
    if (z > -48 && x > 8 && x < 70) continue;
    const s = 0.7 + r() * 0.9 + (r() < 0.06 ? 0.8 : 0);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s * (0.85 + r() * 0.3), s * (0.9 + r() * 0.5), s));
    const which = n % 3;
    forests[which].setMatrixAt(counts[which], m);
    forests[which].setColorAt(counts[which], tint.setHSL(0.36 + r() * 0.08, 0.22 + r() * 0.18, 0.09 + r() * 0.07));
    counts[which]++;
    n++;
  }
  for (const f of forests) {
    f.castShadow = true;
    f.receiveShadow = true;
    scene.add(f);
  }
}

/** A band of valley mist: a huge soft-edged sheet hanging between layers of the scenery. */
function mist(z: number, y: number, h: number, opacity: number, color: string) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: opacity }, time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 color; uniform float opacity; uniform float time; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float band = smoothstep(0.0, 0.45, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
        float n = noise(vec2(vUv.x * 18.0 + time * 0.02, vUv.y * 3.0)) * 0.6 + noise(vec2(vUv.x * 55.0 - time * 0.05, vUv.y * 7.0)) * 0.4;
        gl_FragColor = vec4(color, band * (0.55 + n * 0.6) * opacity);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1600, h), mat);
  mesh.position.set(0, y, z);
  scene.add(mesh);
  return mat;
}
const mists = [mist(-190, 18, 70, 0.55, '#9a7aa6'), mist(-110, 6, 30, 0.4, '#8a6b96'), mist(-45, 2, 12, 0.32, '#7a6390')];

// ------------------------------------------------------------------ The road

/** A roughness map for wet asphalt: mostly glossy, with drier rough patches and a few mirror-smooth puddles. */
function wetRoughness() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(1024, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 1024; x++) {
      const n = perlin.noise(x * 0.012, y * 0.05, 1.3) * 0.5 + perlin.noise(x * 0.05, y * 0.2, 4.1) * 0.25 + 0.5;
      const grain = Math.random() * 0.12;
      let rough = 0.22 + (n > 0.55 ? (n - 0.55) * 1.6 : 0) + grain;
      if (n < 0.33) rough = 0.03 + grain * 0.2; // a puddle
      const v = Math.max(0, Math.min(255, rough * 255));
      const i = (y * 1024 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 1);
  return t;
}
/** Where the road is wet enough to mirror the world: puddles show it fully, the rest faintly. */
function wetAlpha() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(1024, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 1024; x++) {
      const n = perlin.noise(x * 0.012, y * 0.05, 1.3) * 0.5 + perlin.noise(x * 0.05, y * 0.2, 4.1) * 0.25 + 0.5;
      // Opaque dry asphalt, a translucent wet sheen, and clear puddles.
      const a = n < 0.33 ? 0.3 : n < 0.42 ? 0.7 : 0.93;
      const i = (y * 1024 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = a * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 1);
  return t;
}
const mirror = new Reflector(new THREE.PlaneGeometry(900, 7.4), {
  textureWidth: Math.round(window.innerWidth * 0.6),
  textureHeight: Math.round(window.innerHeight * 0.6),
  color: 0x3a3a42,
  clipBias: 0.003,
});
mirror.rotation.x = -Math.PI / 2;
mirror.position.set(150, 0.0, 0.6);
scene.add(mirror);
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 7.4),
  new THREE.MeshPhysicalMaterial({ color: '#0d0c11', roughness: 1, roughnessMap: wetRoughness(), metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.3, envMapIntensity: 0.25, transparent: true, alphaMap: wetAlpha() }),
);
road.rotation.x = -Math.PI / 2;
road.position.set(150, 0.01, 0.6);
road.receiveShadow = true;
scene.add(road);
// Lane dashes and a kerb on the far side.
{
  const dash = new THREE.MeshStandardMaterial({ color: '#b8ae9c', roughness: 0.5 });
  for (let x = -300; x < 600; x += 7) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.14), dash);
    d.rotation.x = -Math.PI / 2;
    d.position.set(x, 0.02, 0.4);
    d.receiveShadow = true;
    scene.add(d);
  }
  const kerb = new THREE.Mesh(new THREE.BoxGeometry(900, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: '#5a5664', roughness: 0.7 }));
  kerb.position.set(150, 0.09, -3.25);
  kerb.receiveShadow = true;
  scene.add(kerb);
  const verge = new THREE.Mesh(new THREE.PlaneGeometry(900, 8), new THREE.MeshStandardMaterial({ color: '#10140f', roughness: 1 }));
  verge.rotation.x = -Math.PI / 2;
  verge.position.set(150, 0.005, 8.2);
  scene.add(verge);
}

// ------------------------------------------------------------------ The near verge: grass, rocks, flowers

{
  const r = seeded(21);
  // Grass blades: thin bent triangles, instanced by the thousand, kept below the line of sight to the truck.
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.025, 0, 0, 0.025, 0, 0, 0.02, 0.18, 0.01, -0.012, 0.18, 0.01, 0.0, 0.42, 0.06], 3));
  blade.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
  blade.computeVertexNormals();
  const grassMat = new THREE.MeshStandardMaterial({ color: '#2c3a26', roughness: 0.6, side: THREE.DoubleSide });
  const COUNT = 26000;
  const grass = new THREE.InstancedMesh(blade, grassMat, COUNT);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const x = -90 + r() * 330;
    const z = 4.6 + Math.pow(r(), 0.8) * 9;
    const s = 0.45 + r() * 0.7 + (z - 4.6) * 0.04;
    q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, r() * Math.PI * 2, (r() - 0.5) * 0.4));
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s));
    grass.setMatrixAt(i, m);
    grass.setColorAt(i, c.setHSL(0.22 + r() * 0.1, 0.25 + r() * 0.2, 0.12 + r() * 0.12));
  }
  grass.receiveShadow = true;
  scene.add(grass);
  // Wet rocks along the verge, with a glossy sheen.
  const rockMat = new THREE.MeshStandardMaterial({ color: '#3d3a44', roughness: 0.35, metalness: 0 });
  for (let i = 0; i < 90; i++) {
    const g = new THREE.IcosahedronGeometry(0.15 + r() * 0.35, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (0.8 + r() * 0.4), p.getY(k) * (0.5 + r() * 0.3), p.getZ(k) * (0.8 + r() * 0.4));
    g.computeVertexNormals();
    const rock = new THREE.Mesh(g, rockMat);
    rock.position.set(-90 + r() * 330, 0.05, 4.8 + r() * 8);
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
  }
  // A scatter of wildflowers catching the light.
  const flowerMat = new THREE.MeshStandardMaterial({ color: '#f2d6ff', emissive: '#c99bff', emissiveIntensity: 0.15, roughness: 0.5 });
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), flowerMat, 700);
  for (let i = 0; i < 700; i++) {
    m.makeTranslation(-90 + r() * 330, 0.25 + r() * 0.3, 4.8 + r() * 8);
    flowers.setMatrixAt(i, m);
    flowers.setColorAt(i, c.set(['#f4e6ff', '#ffd27a', '#ff9ab0', '#bfe8ff'][i % 4]));
  }
  scene.add(flowers);
}

// ------------------------------------------------------------------ Street lamps

const shafts: { mat: THREE.ShaderMaterial; base: number }[] = [];
function lamp(x: number, shadows: boolean) {
  const steel = new THREE.MeshStandardMaterial({ color: '#2a2833', roughness: 0.45, metalness: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7.6, 10), steel);
  pole.position.set(x, 3.8, -4.4);
  pole.castShadow = true;
  scene.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), steel);
  arm.position.set(x, 7.5, -3.4);
  scene.add(arm);
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.18, 0.8, 2, 0.06), steel);
  head.position.set(x, 7.45, -2.4);
  scene.add(head);
  const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.6), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb066', emissiveIntensity: 3 }));
  bulb.rotation.x = Math.PI / 2;
  bulb.position.set(x, 7.35, -2.4);
  scene.add(bulb);
  const spot = new THREE.SpotLight('#ffa552', 140, 24, 0.8, 0.55, 2);
  spot.position.set(x, 7.3, -2.4);
  spot.target.position.set(x, 0, -1.6);
  spot.castShadow = shadows;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0004;
  scene.add(spot, spot.target);
  const shaft = volumeCone(2.9, 7.3, '#ffa552', 0.045);
  shaft.position.set(x, 3.65, -2.3);
  scene.add(shaft);
  shafts.push({ mat: shaft.material as THREE.ShaderMaterial, base: 0.045 });
}
for (const x of [-46, -14, 18, 68, 100, 132]) lamp(x, Math.abs(x - 30) < 60);

// ------------------------------------------------------------------ Pinecrest Fuel & Pie

const flicker: { mat: THREE.MeshStandardMaterial; light?: THREE.PointLight; base: number; lightBase: number }[] = [];
{
  const white = new THREE.MeshStandardMaterial({ color: '#b9b4ab', roughness: 0.55 });
  const red = new THREE.MeshStandardMaterial({ color: '#c8302c', roughness: 0.45, emissive: '#c8302c', emissiveIntensity: 0.25 });
  const steel = new THREE.MeshStandardMaterial({ color: '#3a3844', roughness: 0.35, metalness: 0.8 });
  const concrete = new THREE.MeshStandardMaterial({ color: '#45434c', roughness: 0.75 });
  const add = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // Forecourt slab behind the kerb.
  const slab = add(new THREE.Mesh(new THREE.BoxGeometry(46, 0.2, 13), concrete));
  slab.position.set(37, 0.08, -10);

  // The canopy: a deck on four columns, a white fascia with a red band and the name, and glowing strip lights.
  const deck = add(new THREE.Mesh(new THREE.BoxGeometry(19, 0.9, 9.5), white));
  deck.position.set(30, 5.6, -8.2);
  const band = add(new THREE.Mesh(new THREE.BoxGeometry(19.1, 0.32, 9.6), red));
  band.position.set(30, 5.55, -8.2);
  const name = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 0.62),
    new THREE.MeshStandardMaterial({ map: makeTextTexture('PINECREST  FUEL & PIE', '#c8302c', 'transparent', 900), transparent: true, emissive: '#ffffff', emissiveMap: makeTextTexture('PINECREST  FUEL & PIE', '#ffffff', 'transparent', 900), emissiveIntensity: 0.4 }),
  );
  name.position.set(30, 5.95, -3.44);
  scene.add(name);
  for (const [cx, cz] of [
    [22.5, -5],
    [37.5, -5],
    [22.5, -11.4],
    [37.5, -11.4],
  ]) {
    const col = add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 5.2, 0.42), steel));
    col.position.set(cx, 2.6, cz);
  }
  // Fluorescent strips underneath, and the area lights that make them light the forecourt.
  const stripMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#e9fff1', emissiveIntensity: 1.8 });
  for (const sx of [24, 30, 36]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 7.6), stripMat);
    strip.rotation.x = Math.PI / 2;
    strip.position.set(sx, 5.13, -8.2);
    scene.add(strip);
  }
  const area = new THREE.RectAreaLight('#e4fff0', 1.6, 17, 8);
  area.position.set(30, 5.1, -8.2);
  area.lookAt(30, 0, -8.2);
  scene.add(area);
  // A soft spot from the canopy edge, so the light also reaches the road and the truck's roof.
  const edge = new THREE.SpotLight('#e4fff0', 40, 22, 1.1, 0.9, 2);
  edge.position.set(30, 5.05, -3.8);
  edge.target.position.set(30, 0, 1.5);
  edge.castShadow = true;
  edge.shadow.mapSize.set(2048, 1024);
  edge.shadow.bias = -0.0004;
  scene.add(edge, edge.target);

  // Two pumps on an island.
  const island = add(new THREE.Mesh(new RoundedBoxGeometry(14, 0.25, 1.6, 2, 0.08), concrete));
  island.position.set(30, 0.2, -8.2);
  for (const px of [26, 34]) {
    const body = add(new THREE.Mesh(new RoundedBoxGeometry(1.0, 2.0, 0.7, 3, 0.08), white));
    body.position.set(px, 1.32, -8.2);
    const top = add(new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.35, 0.76, 3, 0.06), red));
    top.position.set(px, 2.4, -8.2);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#55e8ff', emissiveIntensity: 0.7 }));
    screen.position.set(px, 1.75, -7.84);
    scene.add(screen);
    const hose = add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 20, Math.PI), steel));
    hose.position.set(px + 0.55, 1.2, -7.9);
    hose.rotation.z = -Math.PI / 2;
  }

  // The diner: siding, a red trim, warm windows with blinds, a door, and a neon PIE sign that buzzes.
  const wall = new THREE.MeshStandardMaterial({ color: '#5a4a5e', roughness: 0.85 });
  const diner = add(new THREE.Mesh(new THREE.BoxGeometry(15, 4.6, 8), wall));
  diner.position.set(52, 2.3, -14);
  const roof = add(new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.45, 8.6), red));
  roof.position.set(52, 4.75, -14);
  const glass = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb45e', emissiveIntensity: 1.1, emissiveMap: blinds() });
  for (const wx of [46.5, 50.8, 55.1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), glass);
    win.position.set(wx, 2.4, -9.98);
    scene.add(win);
    const frame = add(new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.2), white));
    frame.position.set(wx, 1.45, -9.95);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffc77a', emissiveIntensity: 1.2 }));
  door.position.set(58.4, 1.2, -9.98);
  scene.add(door);
  const inside = new THREE.PointLight('#ffae5c', 30, 14, 2);
  inside.position.set(51, 2.4, -8.6);
  scene.add(inside);
  const neonMat = new THREE.MeshStandardMaterial({ map: makeTextTexture('PIE', '#ff4f8b', 'transparent', 900), transparent: true, emissive: '#ffffff', emissiveMap: makeTextTexture('PIE', '#ff4f8b', 'transparent', 900), emissiveIntensity: 3 });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), neonMat);
  neon.position.set(50.8, 3.85, -9.94);
  scene.add(neon);
  const neonLight = new THREE.PointLight('#ff4f8b', 18, 9, 2);
  neonLight.position.set(50.8, 3.8, -9.2);
  scene.add(neonLight);
  flicker.push({ mat: neonMat, light: neonLight, base: 3, lightBase: 10 });
  const openMat = new THREE.MeshStandardMaterial({ map: makeTextTexture('OPEN', '#56f0ff', 'transparent', 700), transparent: true, emissive: '#ffffff', emissiveMap: makeTextTexture('OPEN', '#56f0ff', 'transparent', 700), emissiveIntensity: 2 });
  const open = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.4), openMat);
  open.position.set(55.1, 2.9, -9.93);
  scene.add(open);
  flicker.push({ mat: openMat, base: 2, lightBase: 0 });

  // The tall price sign, lit from within.
  const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 10, 10), steel));
  pole.position.set(64, 5, -7);
  const signMat = new THREE.MeshStandardMaterial({ map: priceSign(), emissive: '#ffffff', emissiveMap: priceSign(), emissiveIntensity: 0.8 });
  const sign = add(new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.2, 0.4), [steel, steel, steel, steel, signMat, steel]));
  sign.position.set(64, 10.6, -7);
  const signLight = new THREE.PointLight('#fff2d8', 14, 10, 2);
  signLight.position.set(64, 10.6, -5.8);
  scene.add(signLight);

  // Clutter: crates, a bin, a vending machine glowing by the door.
  const crate = new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.9 });
  for (const [cx, cy, s] of [
    [44, 0.5, 1],
    [44.9, 0.4, 0.8],
    [44.3, 1.4, 0.8],
  ]) {
    const b = add(new THREE.Mesh(new RoundedBoxGeometry(s, s, s, 2, 0.05), crate));
    b.position.set(cx, cy, -9.2);
  }
  const vend = add(new THREE.Mesh(new RoundedBoxGeometry(1.1, 2.1, 0.9, 2, 0.05), new THREE.MeshStandardMaterial({ color: '#1d5f9a', emissive: '#4fa7ff', emissiveIntensity: 0.7, roughness: 0.4 })));
  vend.position.set(60.4, 1.05, -9.6);
}

/** Lit window glass with the shadows of blinds and a couple of diners. */
function blinds() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(80,40,30,0.55)';
  for (let y = 4; y < 26; y += 4) g.fillRect(0, y, 128, 1.5);
  g.fillStyle = 'rgba(40,20,20,0.75)';
  g.beginPath();
  g.arc(40, 34, 7, 0, Math.PI * 2);
  g.fill();
  g.fillRect(30, 40, 20, 24);
  g.beginPath();
  g.arc(92, 38, 6, 0, Math.PI * 2);
  g.fill();
  g.fillRect(84, 44, 16, 20);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The price board: FUEL in red, prices in amber digits, and PIE, obviously. */
function priceSign() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 228;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4efe6';
  g.fillRect(0, 0, 256, 228);
  g.fillStyle = '#c8302c';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#fff';
  g.font = '900 46px Fraunces';
  g.textAlign = 'center';
  g.fillText('FUEL', 128, 48);
  g.fillStyle = '#16131c';
  g.fillRect(16, 80, 224, 58);
  g.fillRect(16, 152, 224, 58);
  g.fillStyle = '#ffb04a';
  g.font = '700 40px Karla';
  g.fillText('3.49', 128, 124);
  g.fillStyle = '#ff5c8e';
  g.fillText('PIE  2.00', 128, 196);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ The truck

const LANE_Z = 1.6;
const STOP_X = 30.5;
let truck: Truck;

// ------------------------------------------------------------------ Rain and moths

const RAIN = 5000;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN * 6);
const rainSpeed = new Float32Array(RAIN);
{
  const r = seeded(3);
  for (let i = 0; i < RAIN; i++) {
    const x = (r() - 0.5) * 60;
    const y = r() * 18;
    const z = -10 + r() * 30;
    rainPos.set([x, y, z, x + 0.04, y - 0.3, z], i * 6);
    rainSpeed[i] = 14 + r() * 8;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
}
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#c9cfff', transparent: true, opacity: 0.11, fog: true }));
scene.add(rain);

const mothGeo = new THREE.BufferGeometry();
const MOTHS = 60;
const mothPos = new Float32Array(MOTHS * 3);
mothGeo.setAttribute('position', new THREE.BufferAttribute(mothPos, 3));
const moths = new THREE.Points(mothGeo, new THREE.PointsMaterial({ color: '#ffe2b0', size: 0.07, transparent: true, opacity: 0.9 }));
scene.add(moths);
const mothSeed = Array.from({ length: MOTHS }, (_, i) => ({ lamp: [-14, 18, 68, 100][i % 4], t: i * 1.7, r: 0.4 + (i % 5) * 0.18 }));

// ------------------------------------------------------------------ Post: bloom, grade, vignette, grain

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Guard the bloom: any invalid pixel (NaN or infinity, from a degenerate normal somewhere) would be
// smeared across the whole frame by the blur, so replace them, and clamp extreme highlights.
composer.addPass(
  new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
        gl_FragColor = vec4(min(c.rgb, vec3(40.0)), 1.0);
      }`,
  }),
);
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.28, 0.35, 1.35);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, aspect: { value: window.innerWidth / window.innerHeight } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float aspect; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // Split-tone: cool shadows, warm highlights.
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c * vec3(0.92, 0.95, 1.08), c * vec3(1.06, 1.0, 0.92), smoothstep(0.2, 0.8, l));
      c = mix(vec3(l), c, 1.08);
      vec2 d = (vUv - 0.5) * vec2(aspect, 1.0);
      c *= 1.0 - smoothstep(0.45, 1.15, length(d)) * 0.55;
      c += (hash(vUv * 900.0) - 0.5) * 0.035;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);
// A handle for inspecting the look from the browser console.
(window as unknown as { look: unknown }).look = { scene, camera, renderer, composer, bloom, grade };

// ------------------------------------------------------------------ The show

type Stage = 'arrive' | 'parked' | 'leave';
let stage: Stage = 'arrive';
let stageT = 0;
let truckX = -40;
// ?parked holds the truck at the pump, for judging the look; ?close moves the camera in on it.
const params = new URLSearchParams(location.search);
if (params.has('parked')) {
  truckX = STOP_X;
  stage = 'parked';
  stageT = -1e9;
}
const close = params.has('close');
const card = document.getElementById('card')!;
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  stageT += dt;

  // The truck rolls in, brakes, parks under the canopy, waits, and pulls away.
  let speed = 0;
  if (stage === 'arrive') {
    const left = STOP_X - truckX;
    speed = Math.max(0.15, Math.min(13, left * 0.7));
    truckX += speed * dt;
    if (left < 0.03) {
      truckX = STOP_X;
      stage = 'parked';
      stageT = 0;
      card.classList.add('show');
    }
  } else if (stage === 'parked') {
    if (stageT > 7) {
      stage = 'leave';
      stageT = 0;
      card.classList.remove('show');
    }
  } else {
    speed = Math.min(16, stageT * 4);
    truckX += speed * dt;
    if (truckX > 160) {
      truckX = -40;
      stage = 'arrive';
      stageT = 0;
    }
  }
  const braking = stage === 'arrive' && STOP_X - truckX < 9;
  truck.update(truckX, LANE_Z, speed, dt, braking, stage === 'parked', t);

  // The camera trails the truck with a little lag and a slow, handheld drift; it settles on the stop.
  const want = stage === 'parked' ? STOP_X + 4 : truckX + 5;
  camTarget.x += (want - camTarget.x) * Math.min(1, dt * 1.6);
  const camZ = close ? 11 : 23;
  camera.position.set(camTarget.x + Math.sin(t * 0.21) * 0.25 - (close ? 3.5 : 0), (close ? 2.0 : 2.7) + Math.sin(t * 0.33) * 0.08, camZ);
  camera.lookAt(camTarget.x - (close ? 4 : 0), close ? 1.6 : 3.2, 0);

  // Rain falls and loops around the camera.
  const px = camera.position.x;
  for (let i = 0; i < RAIN; i++) {
    const o = i * 6;
    let y = rainPos[o + 1] - rainSpeed[i] * dt;
    let x = rainPos[o];
    if (y < 0) {
      y += 18;
      x = px + (Math.random() - 0.5) * 60;
    }
    if (x < px - 30) x += 60;
    if (x > px + 30) x -= 60;
    rainPos[o] = x;
    rainPos[o + 1] = y;
    rainPos[o + 3] = x + 0.04;
    rainPos[o + 4] = y - 0.3;
  }
  rainGeo.attributes.position.needsUpdate = true;
  mothSeed.forEach((m, i) => {
    m.t += dt * 2.2;
    mothPos.set([m.lamp + Math.cos(m.t * 1.3) * m.r, 7.0 + Math.sin(m.t * 1.9) * m.r * 0.5, -2.4 + Math.sin(m.t) * m.r * 0.6], i * 3);
  });
  mothGeo.attributes.position.needsUpdate = true;

  // Neon buzz and breathing light shafts.
  for (const f of flicker) {
    const off = Math.random() < 0.025;
    f.mat.emissiveIntensity = off ? f.base * 0.15 : f.base * (0.92 + Math.random() * 0.08);
    if (f.light) f.light.intensity = off ? f.lightBase * 0.1 : f.lightBase;
  }
  shafts.forEach((s, i) => (s.mat.uniforms.strength.value = s.base * (0.9 + Math.sin(t * 1.3 + i) * 0.1)));
  for (const m of mists) m.uniforms.time.value = t;
  grade.uniforms.time.value = t;

  composer.render();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  grade.uniforms.aspect.value = camera.aspect;
});

document.fonts.load('900 40px Fraunces').then(() =>
  document.fonts.load('700 20px Karla').then(() => {
    truck = buildTruck(scene);
    camTarget.set(truckX + 5, 0, 0);
    frame();
  }),
);
