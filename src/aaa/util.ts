import * as THREE from 'three';

/** A seeded random number generator, so the world is the same every run. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A shaft of light through damp air: an open cone, brightest at its apex and along the line of sight
 * through its middle, fading at the edges and toward its base. Added on top of the scene, so it glows.
 */
export function volumeCone(radius: number, height: number, color: string, strength: number) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: strength }, height: { value: height } },
    vertexShader: `
      varying float vH; varying vec3 vN; varying vec3 vV;
      uniform float height;
      void main(){
        vH = clamp((height * 0.5 - position.y) / height, 0.0, 1.0);
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 color; uniform float strength; varying float vH; varying vec3 vN; varying vec3 vV;
      void main(){
        float facing = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        float fall = pow(1.0 - vH, 1.6) * smoothstep(0.0, 0.08, vH);
        gl_FragColor = vec4(color * strength * facing * fall, 1.0);
      }`,
  });
  return new THREE.Mesh(new THREE.ConeGeometry(radius, height, 40, 1, true), mat);
}

/** Words painted on a transparent canvas, as a texture for signs and neon. */
export function makeTextTexture(text: string, color: string, bg: string, weight: number) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const g = c.getContext('2d')!;
  if (bg !== 'transparent') {
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.fillStyle = color;
  g.font = `${weight} 92px Fraunces`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Fit the words to the width.
  const w = g.measureText(text).width;
  if (w > 980) g.font = `${weight} ${Math.floor((92 * 980) / w)}px Fraunces`;
  g.fillText(text, 512, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
