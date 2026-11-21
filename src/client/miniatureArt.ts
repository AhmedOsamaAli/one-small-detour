import * as THREE from 'three';

export type MiniatureSurface = 'stone' | 'timber' | 'plaster' | 'earth' | 'roof' | 'grass';

function grain(x: number, y: number, frequency: number, phase = 0): number {
  const u = x * Math.PI * 2, v = y * Math.PI * 2;
  return Math.sin(u * frequency + Math.cos(v * 2 + phase) * .8 + phase) *
    Math.cos(v * (frequency + 1) + Math.sin(u * 3 - phase) * .6);
}

export function miniatureSurfacePixels(surface: MiniatureSurface, size = 64): { color: Uint8Array; relief: Uint8Array } {
  if (!Number.isInteger(size) || size < 8 || size > 256) throw new Error('Miniature material textures need a bounded whole-number size.');
  const color = new Uint8Array(size * size * 4), relief = new Uint8Array(color.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const broad = grain(u, v, 3, 1.4), fine = grain(u, v, 17, .7), pores = grain(u, v, 27, 2.3);
    const woody = surface === 'timber' || surface === 'roof';
    const striation = Math.sin(v * Math.PI * 32 + Math.sin(u * Math.PI * 4) * .75);
    const knot = Math.sin((u * 4 + Math.sin(v * Math.PI * 4) * .2) * Math.PI * 2);
    const height = woody ? .52 + striation * .15 + knot * .07 + fine * .05 :
      surface === 'plaster' ? .53 + fine * .06 + pores * .11 :
        surface === 'earth' ? .50 + broad * .20 + fine * .12 :
          surface === 'grass' ? .53 + broad * .16 + fine * .07 : .58 + broad * .13 + fine * .11 - Math.max(0, pores - .55) * .5;
    const tint = woody ? 239 + striation * 7 + broad * 5 : surface === 'grass' ? 240 + broad * 11 + fine * 3 :
      surface === 'earth' ? 237 + broad * 9 + fine * 5 : 244 + broad * 5 + fine * 4;
    const at = (y * size + x) * 4;
    color[at] = Math.round(tint);
    color[at + 1] = Math.round(tint - (woody || surface === 'earth' ? 2 : 0));
    color[at + 2] = Math.round(tint - (woody || surface === 'earth' ? 4 : 0));
    color[at + 3] = 255;
    relief[at] = Math.round(Math.max(0, Math.min(1, height)) * 255);
    relief[at + 1] = Math.round((surface === 'roof' ? .82 : surface === 'timber' ? .9 : .96) * 255 - broad * 10);
    relief[at + 2] = 255;
    relief[at + 3] = 255;
  }
  return { color, relief };
}

export function miniatureSurfaceMaps(surface: MiniatureSurface) {
  const pixels = miniatureSurfacePixels(surface);
  const map = new THREE.DataTexture(pixels.color, 64, 64, THREE.RGBAFormat);
  const relief = new THREE.DataTexture(pixels.relief, 64, 64, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, relief]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.repeat.setScalar(surface === 'plaster' || surface === 'stone' ? 3 : 2);
    texture.needsUpdate = true;
  }
  return { map, relief };
}

export function miniatureContactMap(): THREE.DataTexture {
  const size = 32, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot((x + .5 - size / 2) / (size / 2), (y + .5 - size / 2) / (size / 2));
    const shade = Math.round(Math.pow(Math.max(0, 1 - radius), 1.8) * 255);
    pixels.set([shade, shade, shade, 255], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function miniatureFoliage(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(.19, 2);
  const positions = geometry.getAttribute('position'), colors: number[] = [];
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    const lobe = 1 + Math.sin(x * 37 + y * 19) * Math.cos(z * 31 - y * 11) * .045;
    positions.setXYZ(index, x * lobe, y * lobe, z * lobe);
    const shade = .86 + (y / .19 + 1) * .065 + Math.sin(x * 43 + z * 29) * .035;
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
