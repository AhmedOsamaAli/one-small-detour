import * as THREE from 'three';
import { canTraverse, connects, isAnchor, locate, tileAt, walkable } from '../shared/rules.ts';
import type { Anchor, Board, Celebration, Cell, FrameAxes, GuideBounds, Shape, Swap, Theme } from '../shared/types.ts';
import type { PlaybackFrame } from '../shared/playback.ts';
import { COMPLETION_CELEBRATION_MS } from '../shared/playback.ts';

interface Callbacks {
  onCell: (cell: Cell) => void;
  onHover: (cell: Cell | null) => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  onProjection: (axes: FrameAxes) => void;
}

interface TileObject {
  group: THREE.Group;
  water: THREE.ShaderMaterial | null;
  links: { mesh: THREE.Mesh; row: number; col: number }[];
}

interface Movement {
  move: Swap;
  next: Board;
  began: number;
  objects: { group: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; side: number }[];
}

const GRASS = ['#94ae68', '#a2b975', '#87a55c', '#afbf7e', '#97b16a'];
const hasWater = (tile: string | undefined): boolean => tile === '~' || tile === 'h' || tile === 'v';
const THEMES: Record<Theme, { grass: string[]; sea: string; soil: string }> = {
  meadow: { grass: GRASS, sea: '#b5d8ce', soil: '#c4aa7f' },
  coast: { grass: ['#9daf78', '#afbd86', '#98ab6c', '#b8c88f'], sea: '#aed4d0', soil: '#c1ab84' },
  orchard: { grass: ['#b2b57b', '#a5b076', '#c4bf85', '#aab879'], sea: '#c4dacb', soil: '#c6aa81' },
};

function randomSeed(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

function roundedPrism(width: number, depth: number, height: number, radius: number): THREE.ExtrudeGeometry {
  const x = -width / 2;
  const y = -depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012,
    bevelSegments: 2, steps: 1, curveSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function cottageRoof(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.29, 0);
  shape.lineTo(0, 0.24);
  shape.lineTo(0.29, 0);
  shape.closePath();
  const roof = new THREE.ExtrudeGeometry(shape, {
    depth: 0.52, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008,
    bevelSegments: 1, steps: 1,
  });
  roof.translate(0, 0, -0.26);
  return roof;
}

export class LivingIsland {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private hemisphere = new THREE.HemisphereLight('#fff8e9', '#71917d', 1.9);
  private sun = new THREE.DirectionalLight('#fff0d4', 2.3);
  private camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 80);
  private boardGroup = new THREE.Group();
  private frames = new THREE.Group();
  private trails = new THREE.Group();
  private traveler = new THREE.Group();
  private observer: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pickPlane: THREE.Mesh;
  private tiles: TileObject[] = [];
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private geometries: THREE.BufferGeometry[] = [];
  private extraMaterials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private frameBadgeMaterials = new Map<string, THREE.SpriteMaterial>();
  private boardGeometries: THREE.BufferGeometry[] = [];
  private boardMaterials: THREE.Material[] = [];
  private boardTextures: THREE.Texture[] = [];
  private time = { value: 0 };
  private board: Board = [];
  private size = 6;
  private labelScale = 0.52;
  private landmarkSprites: THREE.Sprite[] = [];
  private houseWindows = new Map<Anchor, THREE.MeshStandardMaterial>();
  private festivities = new THREE.Group();
  private celebrationStarted = 0;
  private celebrationComplete = false;
  private movement: Movement | null = null;
  private projectionKey = '';
  private reduced = false;
  private darkMode = false;
  private baseSeaColor = '#b5d8ce';
  private seaColor = new THREE.Color('#b5d8ce');
  private paused = false;
  private visualTime = 0;
  private previousTick = performance.now();
  private frame = 0;
  private disposed = false;
  private currentHover: string | null = null;
  private dirty = true;
  private soilGeometry = this.track(roundedPrism(0.985, 0.985, 0.23, 0.07));
  private topGeometry = this.track(roundedPrism(0.97, 0.97, 0.055, 0.055));
  private stoneGeometry = this.track(roundedPrism(0.72, 0.72, 0.075, 0.12));
  private roadLinkGeometry = this.track(roundedPrism(0.42, 0.40, 0.06, 0.025));
  private bridgeDeck = this.track(roundedPrism(0.94, 0.44, 0.07, 0.025));
  private bridgeSeam = this.track(new THREE.BoxGeometry(0.018, 0.012, 0.44));
  private bridgeRail = this.track(new THREE.BoxGeometry(0.94, 0.03, 0.025));
  private bridgeArrow = this.track(new THREE.ConeGeometry(0.045, 0.09, 3));
  private bridgeArrowShaft = this.track(new THREE.BoxGeometry(0.40, 0.008, 0.027));
  private roofGeometry = this.track(cottageRoof());
  private flowerStem = this.track(new THREE.CylinderGeometry(0.008, 0.009, 0.12, 4));
  private flowerPetal = this.track(new THREE.SphereGeometry(0.027, 5, 4));
  private flowerCenter = this.track(new THREE.SphereGeometry(0.018, 5, 4));
  private rockGeometry = this.track(new THREE.IcosahedronGeometry(0.12, 1));
  private smallStone = this.track(roundedPrism(0.27, 0.12, 0.012, 0.04));
  private waterGeometry = this.track(new THREE.PlaneGeometry(1, 1, 8, 8));
  private grassGeometry = this.makeBlade();
  private grassMaterial: THREE.MeshStandardMaterial;
  private waterSurround: THREE.Mesh;
  private footLeft = new THREE.Group();
  private footRight = new THREE.Group();
  private courierBody = new THREE.Group();
  private armLeft = new THREE.Group();
  private armRight = new THREE.Group();
  private travelerWalking = false;
  private greetingUntil = 0;
  private readonly container: HTMLElement;
  private readonly callbacks: Callbacks;

  constructor(container: HTMLElement, callbacks: Callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'island-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      console.error('The terrain shader could not compile:', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment));
      this.callbacks.onError('The living terrain could not render here. Switching to the fully playable flat map.');
    };
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
    container.appendChild(this.canvas);
    this.scene.add(this.hemisphere);
    const sun = this.sun;
    sun.position.set(-4, 10, 6);
    sun.castShadow = true;
    const shadowSize = container.clientWidth < 680 ? 1024 : 2048;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    const seaMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: this.time, uColor: { value: this.seaColor } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        void main(){float d=length(vUv-.5)*2.; float a=smoothstep(1.,.52,d)*.38;
          float rings=sin(d*68.-uTime*.65)*.012; gl_FragColor=vec4(uColor+rings,a);}`,
    });
    this.extraMaterials.push(seaMaterial);
    const seaGeometry = this.track(new THREE.CircleGeometry(6.6, 80));
    this.waterSurround = new THREE.Mesh(seaGeometry, seaMaterial);
    this.waterSurround.rotation.x = -Math.PI / 2;
    this.waterSurround.position.y = -0.22;
    this.scene.add(this.waterSurround);
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.12 });
    this.extraMaterials.push(shadowMaterial);
    const shadow = new THREE.Mesh(this.track(new THREE.PlaneGeometry(14, 14)), shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.18;
    shadow.receiveShadow = true;
    this.scene.add(shadow);
    this.grassMaterial = this.material('#819b4c');
    this.grassMaterial.side = THREE.DoubleSide;
    this.grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms['uTime'] = this.time;
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
         float sway=sin(uTime*1.35+instanceMatrix[3].x*2.7+instanceMatrix[3].z*2.1);
         transformed.x+=sway*.032*pow(max(position.y,0.)/.23,2.);
         #endif`,
      );
    };
    const pickerMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.extraMaterials.push(pickerMaterial);
    this.pickPlane = new THREE.Mesh(this.track(new THREE.PlaneGeometry(6, 6)), pickerMaterial);
    this.pickPlane.rotation.x = -Math.PI / 2;
    this.pickPlane.position.y = 0.30;
    this.scene.add(this.pickPlane, this.boardGroup, this.frames, this.trails, this.festivities);
    this.makeTraveler();
    this.scene.add(this.traveler);
    this.canvas.addEventListener('pointermove', this.pointerMove);
    this.canvas.addEventListener('pointerleave', this.pointerLeave);
    this.canvas.addEventListener('click', this.pointerClick);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    document.addEventListener('visibilitychange', this.resetTickTime);
    this.frame = requestAnimationFrame(this.tick);
  }

  private track<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private boardTrack<T extends THREE.BufferGeometry>(geometry: T): T {
    this.boardGeometries.push(geometry);
    return geometry;
  }

  private material(color: string, roughness = 0.8): THREE.MeshStandardMaterial {
    const key = `${color}:${roughness}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    this.materials.set(key, material);
    return material;
  }

  private mesh(geometry: THREE.BufferGeometry, color: string | THREE.MeshStandardMaterial, position: THREE.Vector3, parent: THREE.Group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, typeof color === 'string' ? this.material(color) : color);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private makeBlade(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.020, 0, 0, 0.020, 0, 0, 0.012, 0.13, 0, -0.012, 0.13, 0, 0.023, 0.23, 0,
    ], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
    geometry.computeVertexNormals();
    return this.track(geometry);
  }

  private addGrass(group: THREE.Group, random: () => number, count: number): void {
    const grass = new THREE.InstancedMesh(this.grassGeometry, this.grassMaterial, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set((random() - 0.5) * 0.9, 0.255, (random() - 0.5) * 0.9);
      dummy.rotation.y = random() * Math.PI * 2;
      const scale = 0.55 + random() * 0.7;
      dummy.scale.set(scale, scale * (0.7 + random() * 0.7), scale);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      grass.setColorAt(i, new THREE.Color().setHSL(0.20 + random() * 0.045, 0.32, 0.35 + random() * 0.14));
    }
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    group.add(grass);
  }

  private addFlower(group: THREE.Group, random: () => number, theme: Theme): void {
    const flower = new THREE.Group();
    flower.position.set((random() - 0.5) * 0.65, 0.25, (random() - 0.5) * 0.65);
    this.mesh(this.flowerStem, '#6e8746', new THREE.Vector3(0, 0.06, 0), flower);
    const color = theme === 'orchard' ? '#efc3b4' : theme === 'coast' ? '#f5f0d9' : random() > 0.5 ? '#f5eac0' : '#e5b791';
    const petals = new THREE.InstancedMesh(this.flowerPetal, this.material(color), 5);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 5; i++) {
      matrix.makeTranslation(Math.cos(i * 1.256) * 0.027, 0.125, Math.sin(i * 1.256) * 0.027);
      petals.setMatrixAt(i, matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
    flower.add(petals);
    this.mesh(this.flowerCenter, '#d5a448', new THREE.Vector3(0, 0.14, 0), flower);
    group.add(flower);
  }

  private addTree(group: THREE.Group, random: () => number, theme: Theme): void {
    const tree = new THREE.Group();
    tree.position.set((random() - 0.5) * 0.35, 0.25, (random() - 0.5) * 0.35);
    this.mesh(this.boardTrack(new THREE.CylinderGeometry(0.028, 0.045, 0.25, 6)), '#92714f', new THREE.Vector3(0, 0.12, 0), tree);
    if (theme === 'coast') {
      this.mesh(this.boardTrack(new THREE.ConeGeometry(0.22, 0.32, 7)), '#789787', new THREE.Vector3(0, 0.36, 0), tree);
      this.mesh(this.boardTrack(new THREE.ConeGeometry(0.16, 0.26, 7)), '#8fab94', new THREE.Vector3(0, 0.54, -0.025), tree);
      group.add(tree);
      return;
    }
    const foliage = this.boardTrack(new THREE.IcosahedronGeometry(0.19, 1));
    this.mesh(foliage, '#6d9156', new THREE.Vector3(-0.09, 0.37, 0.03), tree);
    this.mesh(foliage, '#86a261', new THREE.Vector3(0.09, 0.4, -0.025), tree);
    this.mesh(foliage, '#9cb574', new THREE.Vector3(0, 0.54, 0), tree);
    if (theme === 'orchard') {
      const fruit = this.boardTrack(new THREE.SphereGeometry(0.033, 6, 5));
      for (const [x, y, z] of [[-0.14, 0.37, 0.13], [0.12, 0.43, 0.13], [-0.01, 0.56, 0.14]] as const) {
        this.mesh(fruit, '#c98256', new THREE.Vector3(x, y, z), tree);
      }
    }
    group.add(tree);
  }

  private label(text: string, color: string, persistent = false): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Map labels could not be drawn.');
    context.fillStyle = '#fffdf1';
    context.beginPath();
    context.arc(64, 64, 48, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = new THREE.Color(color).multiplyScalar(0.65).getStyle();
    context.font = 'bold 64px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 67);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (persistent) this.textures.push(texture);
    else this.boardTextures.push(texture);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
    if (persistent) this.extraMaterials.push(material);
    else this.boardMaterials.push(material);
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(this.labelScale, this.labelScale, 1);
    sprite.position.y = 1.03;
    sprite.renderOrder = 20;
    if (!persistent) this.landmarkSprites.push(sprite);
    return sprite;
  }

  private addHouse(group: THREE.Group, anchor: Anchor): void {
    const colors: Record<Anchor, string> = { A: '#688671', B: '#c78062', C: '#869cb0', D: '#a18c64', E: '#9b7c9b', F: '#b28a44' };
    const roofColor = colors[anchor];
    const house = new THREE.Group();
    house.position.set(-0.04, 0, -0.17);
    group.add(house);
    const wall = this.boardTrack(roundedPrism(0.47, 0.42, 0.37, 0.03));
    this.mesh(wall, '#f4ecd8', new THREE.Vector3(0, 0.255, 0), house);
    this.mesh(this.roofGeometry, roofColor, new THREE.Vector3(0, 0.61, 0), house);
    this.mesh(this.boardTrack(new THREE.BoxGeometry(0.028, 0.028, 0.54)),
      new THREE.Color(roofColor).multiplyScalar(0.75).getStyle(), new THREE.Vector3(0, 0.86, 0), house);
    this.mesh(this.boardTrack(new THREE.BoxGeometry(0.10, 0.19, 0.025)), '#786849', new THREE.Vector3(0, 0.36, 0.221), house);
    const windowGeometry = this.boardTrack(new THREE.BoxGeometry(0.075, 0.075, 0.022));
    const windows = new THREE.MeshStandardMaterial({ color: '#ffe6ad', emissive: '#edb252', emissiveIntensity: 0.12, roughness: 0.45 });
    this.boardMaterials.push(windows);
    this.houseWindows.set(anchor, windows);
    this.mesh(windowGeometry, windows, new THREE.Vector3(-0.14, 0.48, 0.223), house);
    this.mesh(windowGeometry, windows, new THREE.Vector3(0.14, 0.48, 0.223), house);
    const sill = this.boardTrack(new THREE.BoxGeometry(0.11, 0.02, 0.05));
    this.mesh(sill, '#c7ae83', new THREE.Vector3(-0.14, 0.435, 0.24), house);
    this.mesh(sill, '#c7ae83', new THREE.Vector3(0.14, 0.435, 0.24), house);
    this.mesh(this.boardTrack(new THREE.BoxGeometry(0.075, 0.20, 0.075)), '#b89b7b', new THREE.Vector3(-0.14, 0.77, -0.08), house);
    this.mesh(this.boardTrack(roundedPrism(0.20, 0.16, 0.035, 0.03)), '#e3d6b8', new THREE.Vector3(0, 0.27, 0.27), house);
    this.mesh(this.boardTrack(new THREE.CylinderGeometry(0.012, 0.015, 0.20, 5)), '#92714f', new THREE.Vector3(0.31, 0.35, 0.18), house);
    this.mesh(this.boardTrack(roundedPrism(0.11, 0.11, 0.07, 0.025)), roofColor, new THREE.Vector3(0.31, 0.44, 0.18), house);
    group.add(this.label(anchor, roofColor));
  }

  setArrivals(anchors: readonly Anchor[]): void {
    this.houseWindows.forEach((material, anchor) => {
      material.emissiveIntensity = anchor === 'A' || anchors.includes(anchor) ? 0.85 : 0.12;
    });
    if (import.meta.env.DEV) {
      this.canvas.dataset['litStops'] = [...this.houseWindows].filter(([, material]) => material.emissiveIntensity >= 0.8)
        .map(([anchor]) => anchor).join(',');
    }
    this.dirty = true;
  }

  private makeWater(row: number, col: number): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.time,
        uShore: { value: new THREE.Vector4() },
        uOffset: { value: new THREE.Vector2(col, row) },
      },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float uTime; uniform vec4 uShore; uniform vec2 uOffset; varying vec2 vUv;
        void main(){
          vec2 uv=vUv+uOffset;
          float wave=sin(uv.x*21.+uv.y*13.+uTime*.8)*sin(uv.y*18.-uTime*.65);
          float shimmer=pow(max(0.,sin(uv.x*32.+uv.y*24.+uTime*.7)),18.)*.12;
          vec3 water=mix(vec3(.25,.62,.65),vec3(.57,.80,.76),.52+wave*.15);
          float shore=max(max((1.-smoothstep(0.,.065,vUv.x))*uShore.x,
            (1.-smoothstep(0.,.065,1.-vUv.x))*uShore.y),
            max((1.-smoothstep(0.,.065,vUv.y))*uShore.z,(1.-smoothstep(0.,.065,1.-vUv.y))*uShore.w));
          water=mix(water,vec3(.88,.94,.82),shore*.70)+shimmer;
          gl_FragColor=vec4(water,1.);
        }`,
    });
    this.boardMaterials.push(material);
    return material;
  }

  reset(board: Board, theme: Theme, seed: number): void {
    this.movement = null;
    this.callbacks.onBusy(false);
    this.clearBoard();
    this.board = board;
    this.size = board.length;
    const center = (this.size - 1) / 2;
    this.pickPlane.scale.set(this.size / 6, this.size / 6, 1);
    this.waterSurround.scale.setScalar(this.size / 6);
    const palette = THEMES[theme];
    this.mesh(this.boardTrack(roundedPrism(this.size + 0.02, this.size + 0.02, 0.055, 0.16)),
      new THREE.Color(palette.soil).multiplyScalar(0.76).getStyle(), new THREE.Vector3(0, -0.08, 0), this.boardGroup);
    this.baseSeaColor = palette.sea;
    this.setAppearance(this.darkMode);
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const tile = tileAt(board, { row, col });
        const random = randomSeed(seed + row * 731 + col * 1591);
        const group = new THREE.Group();
        group.position.set(col - center, 0, row - center);
        const soil = this.mesh(this.soilGeometry, palette.soil, new THREE.Vector3(0, -0.015, 0), group);
        soil.receiveShadow = true;
        if (!hasWater(tile)) this.mesh(this.topGeometry, palette.grass[Math.floor(random() * palette.grass.length)] ?? '#a6b575', new THREE.Vector3(0, 0.22, 0), group);
        let water: THREE.ShaderMaterial | null = null;
        const links: TileObject['links'] = [];
        if (hasWater(tile)) {
          water = this.makeWater(row, col);
          const plane = new THREE.Mesh(this.waterGeometry, water);
          plane.rotation.x = -Math.PI / 2;
          plane.position.y = 0.25;
          group.add(plane);
        }
        if (walkable(tile)) {
          if (tile === 'h' || tile === 'v') {
            const bridge = new THREE.Group();
            if (tile === 'v') bridge.rotation.y = Math.PI / 2;
            this.mesh(this.bridgeDeck, '#d7b681', new THREE.Vector3(0, 0.29, 0), bridge);
            const seams = new THREE.InstancedMesh(this.bridgeSeam, this.material('#a1875d'), 5);
            const matrix = new THREE.Matrix4();
            for (let index = 0; index < 5; index++) seams.setMatrixAt(index, matrix.makeTranslation((index - 2) * 0.18, 0.366, 0));
            seams.instanceMatrix.needsUpdate = true;
            bridge.add(seams);
            this.mesh(this.bridgeRail, '#b79764', new THREE.Vector3(0, 0.415, -0.205), bridge);
            this.mesh(this.bridgeRail, '#b79764', new THREE.Vector3(0, 0.415, 0.205), bridge);
            this.mesh(this.bridgeArrowShaft, '#675d43', new THREE.Vector3(0, 0.375, 0), bridge);
            for (const side of [-1, 1]) {
              const arrow = this.mesh(this.bridgeArrow, '#675d43', new THREE.Vector3(side * 0.25, 0.377, 0), bridge);
              arrow.rotation.z = -side * Math.PI / 2;
            }
            group.add(bridge);
          } else {
            this.mesh(this.stoneGeometry, '#eee7d3', new THREE.Vector3(0, 0.275, 0), group);
            for (let i = 0; i < 2; i++) {
              this.mesh(this.smallStone, '#d7ceb9', new THREE.Vector3((i - 0.5) * 0.22, 0.356, (i - 0.5) * 0.25), group);
            }
          }
          for (const direction of [{ row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 }]) {
            if (!connects(tile, direction.row, direction.col)) continue;
            const link = this.mesh(this.roadLinkGeometry, tile === 'h' || tile === 'v' ? '#d7b681' : '#e8dfca',
              new THREE.Vector3(direction.col * 0.30, 0.282, direction.row * 0.30), group);
            if (direction.col) link.rotation.y = Math.PI / 2;
            links.push({ mesh: link, ...direction });
          }
          if (isAnchor(tile)) this.addHouse(group, tile);
        } else if (tile === 'x') {
          const boulder = this.mesh(this.rockGeometry, '#718474', new THREE.Vector3(-0.06, 0.45, -0.025), group);
          boulder.scale.set(2.7, 2.2, 2.6);
          boulder.rotation.y = random() * Math.PI;
          const chip = this.mesh(this.rockGeometry, '#a3ad9b', new THREE.Vector3(0.20, 0.33, 0.16), group);
          chip.scale.set(1.25, 0.8, 1.2);
        } else if (tile === '.') {
          this.addGrass(group, random, Math.max(14, Math.round((this.container.clientWidth < 680 ? 26 : 48) * 6 / this.size)));
          if (random() > 0.79) this.addFlower(group, random, theme);
          else if ((row === 0 || row === this.size - 1 || col === 0 || col === this.size - 1) && random() > 0.84) this.addTree(group, random, theme);
        }
        this.boardGroup.add(group);
        this.tiles.push({ group, water, links });
      }
    }
    this.refreshTerrain();
    this.setArrivals([]);
    this.setRoutes([]);
    this.restAt('A');
    this.resize();
    this.dirty = true;
  }

  private refreshTerrain(): void {
    this.tiles.forEach((tile, index) => {
      const row = Math.floor(index / this.size);
      const col = index % this.size;
      tile.links.forEach((link) => { link.mesh.visible = canTraverse(this.board, { row, col }, { row: row + link.row, col: col + link.col }); });
      if (!tile.water) return;
      tile.water.uniforms['uOffset']?.value.set(col, row);
      tile.water.uniforms['uShore']?.value.set(
        hasWater(this.board[row]?.[col - 1]) ? 0 : 1,
        hasWater(this.board[row]?.[col + 1]) ? 0 : 1,
        hasWater(this.board[row + 1]?.[col]) ? 0 : 1,
        hasWater(this.board[row - 1]?.[col]) ? 0 : 1,
      );
    });
    if (import.meta.env.DEV) {
      this.canvas.dataset['terrain'] = this.board.join('/');
      this.canvas.dataset['roadEdges'] = JSON.stringify(this.tiles.flatMap((tile, index) =>
        tile.links.filter((link) => link.mesh.visible).map((link) => ({
          row: Math.floor(index / this.size), col: index % this.size, dr: link.row, dc: link.col,
        }))));
    }
  }

  animateSwap(move: Swap, next: Board): void {
    const objects: Movement['objects'] = [];
    for (let row = 0; row < move.rows; row++) {
      for (let col = 0; col < move.cols; col++) {
        const a = this.tiles[(move.a.row + row) * this.size + move.a.col + col];
        const b = this.tiles[(move.b.row + row) * this.size + move.b.col + col];
        if (!a || !b) throw new Error('The selected landscape patch is missing.');
        objects.push({ group: a.group, from: a.group.position.clone(), to: b.group.position.clone(), side: 1 });
        objects.push({ group: b.group, from: b.group.position.clone(), to: a.group.position.clone(), side: -1 });
      }
    }
    this.movement = { move, next, objects, began: this.visualTime };
    this.callbacks.onBusy(true);
    this.clearFrames();
    if (this.reduced) this.finishSwap();
    this.dirty = true;
  }

  private finishSwap(): void {
    const movement = this.movement;
    if (!movement) return;
    movement.objects.forEach(({ group, to }) => {
      group.position.copy(to);
      group.rotation.set(0, 0, 0);
    });
    const { move } = movement;
    for (let row = 0; row < move.rows; row++) {
      for (let col = 0; col < move.cols; col++) {
        const ai = (move.a.row + row) * this.size + move.a.col + col;
        const bi = (move.b.row + row) * this.size + move.b.col + col;
        const a = this.tiles[ai];
        const b = this.tiles[bi];
        if (!a || !b) throw new Error('The patch exchange lost a terrain tile.');
        this.tiles[ai] = b;
        this.tiles[bi] = a;
      }
    }
    this.board = movement.next;
    this.movement = null;
    this.refreshTerrain();
    this.callbacks.onBusy(false);
    this.dirty = true;
  }

  private clearFrames(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.frames.traverse((object) => {
      if (object instanceof THREE.LineSegments || object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
        else materials.add(object.material);
      }
    });
    this.frames.clear();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  private frameBadge(text: string, color: string): THREE.Sprite {
    const key = `${text}:${color}`;
    let material = this.frameBadgeMaterials.get(key);
    if (!material) {
      material = this.label(text, color, true).material;
      this.frameBadgeMaterials.set(key, material);
    }
    const badge = new THREE.Sprite(material);
    badge.scale.set(this.labelScale * 0.92, this.labelScale * 0.92, 1);
    badge.renderOrder = 60;
    return badge;
  }

  setHighlights(shape: Shape, first: Cell | null, second: Cell | null, hover: Cell | null, invalid: boolean, blockedCells: readonly Cell[]): void {
    this.clearFrames();
    const add = (cell: Cell, color: string, number: string, preview = false): void => {
      if (cell.row + shape.rows > this.size || cell.col + shape.cols > this.size || cell.row < 0 || cell.col < 0) return;
      const left = cell.col - this.size / 2 + 0.015;
      const back = cell.row - this.size / 2 + 0.015;
      const width = shape.cols - 0.03;
      const depth = shape.rows - 0.03;
      const border = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: preview ? 0.86 : 1,
        depthTest: false, depthWrite: false, toneMapped: false,
      });
      const halo = new THREE.MeshBasicMaterial({
        color: '#fffdf1', transparent: true, opacity: 0.96,
        depthTest: false, depthWrite: false, toneMapped: false,
      });
      const bar = (x: number, z: number, length: number, horizontal: boolean, material: THREE.MeshBasicMaterial, thickness: number, order: number): void => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? length : thickness, 0.025, horizontal ? thickness : length), material);
        mesh.position.set(x, 0.46, z);
        mesh.renderOrder = order;
        this.frames.add(mesh);
      };
      const edge = (x: number, z: number, length: number, horizontal: boolean): void => {
        const thickness = this.size / 6;
        bar(x, z, length + 0.06, horizontal, halo, 0.105 * thickness, 40);
        if (!preview) {
          bar(x, z, length + 0.015, horizontal, border, 0.060 * thickness, 42);
          return;
        }
        const count = Math.max(2, Math.floor(length / 0.26));
        const segment = length / count;
        for (let index = 0; index < count; index++) {
          const offset = -length / 2 + segment * (index + 0.5);
          bar(x + (horizontal ? offset : 0), z + (horizontal ? 0 : offset), segment * 0.65, horizontal, border, 0.055 * thickness, 42);
        }
      };
      edge(left + width / 2, back, width, true);
      edge(left + width / 2, back + depth, width, true);
      edge(left, back + depth / 2, depth, false);
      edge(left + width, back + depth / 2, depth, false);
      const fill = new THREE.Mesh(
        new THREE.PlaneGeometry(shape.cols - 0.035, shape.rows - 0.035),
        new THREE.MeshBasicMaterial({
          color, transparent: true, opacity: preview ? 0.065 : 0.145,
          depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        }),
      );
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(left + width / 2, 0.43, back + depth / 2);
      fill.renderOrder = 32;
      this.frames.add(fill);
      const badge = this.frameBadge(number, color);
      badge.position.set(left - 0.035, 0.72, back - 0.015);
      this.frames.add(badge);
    };
    if (!this.movement) {
      if (first) add(first, '#ad651b', '1');
      if (second) add(second, '#286797', '2');
      else if (hover && !(first && first.row === hover.row && first.col === hover.col)) {
        add(hover, invalid ? '#b33f35' : first ? '#286797' : '#ad651b', invalid ? '!' : first ? '2' : '1', true);
      }
      for (const cell of blockedCells) {
        const center = (this.size - 1) / 2;
        for (const [inner, outer, color, order] of [
          [0.35, 0.48, '#fffdf1', 64],
          [0.38, 0.45, '#a83e2f', 65],
        ] as const) {
          const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 24),
            new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(cell.col - center, 0.40, cell.row - center);
          ring.renderOrder = order;
          this.frames.add(ring);
        }
      }
    }
    if (import.meta.env.DEV) this.canvas.dataset['blockedCells'] = JSON.stringify(blockedCells);
    this.dirty = true;
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
    if (reduced && this.movement) this.finishSwap();
    this.dirty = true;
  }

  setAppearance(dark: boolean): void {
    this.darkMode = dark;
    this.hemisphere.color.set(dark ? '#b9c9ed' : '#fff8e9');
    this.hemisphere.groundColor.set(dark ? '#3d6652' : '#71917d');
    this.hemisphere.intensity = dark ? 1.25 : 1.9;
    this.sun.color.set(dark ? '#c1d0ff' : '#fff0d4');
    this.sun.intensity = dark ? 1.1 : 2.3;
    this.renderer.toneMappingExposure = dark ? 0.98 : 1.04;
    this.seaColor.set(this.baseSeaColor).multiplyScalar(dark ? 0.36 : 1);
    this.dirty = true;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.previousTick = performance.now();
    this.dirty = true;
  }

  setRoutes(routes: Cell[][]): void {
    this.trails.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (!Array.isArray(object.material)) object.material.dispose();
      }
    });
    this.trails.clear();
    routes.forEach((route, routeIndex) => {
      const material = new THREE.MeshBasicMaterial({ color: routeIndex === 0 ? '#f2d284' : '#bdddc7', transparent: true, opacity: 0.94 });
      for (const cell of route) {
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), material.clone());
        dot.rotation.x = -Math.PI / 2;
        dot.position.set(cell.col - (this.size - 1) / 2, 0.374, cell.row - (this.size - 1) / 2);
        this.trails.add(dot);
      }
      material.dispose();
    });
    this.dirty = true;
  }

  restAt(anchor: Anchor): void {
    const home = locate(this.board, anchor);
    if (!home) throw new Error(`The traveler cannot rest at missing home ${anchor}.`);
    this.traveler.visible = true;
    this.moveTraveler({ position: home, facing: { row: 0, col: 0 }, walking: false, arrivals: [], finished: false });
  }

  moveTraveler(frame: PlaybackFrame): void {
    const center = (this.size - 1) / 2;
    this.travelerWalking = frame.walking;
    this.traveler.position.set(frame.position.col - center, 0.35, frame.position.row - center + 0.14);
    if (frame.facing.row || frame.facing.col) this.traveler.rotation.y = Math.atan2(frame.facing.col, frame.facing.row);
    if (import.meta.env.DEV) {
      const position = this.traveler.position.clone().project(this.camera);
      this.canvas.dataset['travelerPixel'] = JSON.stringify({
        x: (position.x + 1) * this.canvas.clientWidth / 2,
        y: (1 - position.y) * this.canvas.clientHeight / 2,
      });
    }
    this.dirty = true;
  }

  celebrate(celebration: Celebration): void {
    this.clearFestivities();
    this.celebrationStarted = this.visualTime;
    this.celebrationComplete = celebration.complete;
    this.greetingUntil = this.celebrationStarted + (celebration.complete ? COMPLETION_CELEBRATION_MS : 1100);
    const center = (this.size - 1) / 2;
    for (const anchor of celebration.anchors) {
      const cell = locate(this.board, anchor);
      if (!cell) continue;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.42, 40),
        new THREE.MeshBasicMaterial({ color: '#ecc267', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cell.col - center, 0.39, cell.row - center);
      ring.userData['ring'] = true;
      this.festivities.add(ring);
      if (!this.reduced) {
        const count = celebration.complete ? 18 : 8;
        for (let index = 0; index < count; index++) {
          const angle = index * Math.PI * 2 / count;
          const confetti = new THREE.Mesh(
            new THREE.PlaneGeometry(0.07, 0.12),
            new THREE.MeshBasicMaterial({ color: ['#f1cb73', '#aac898', '#f4e3ba', '#dca48b'][index % 4] ?? '#f1cb73', side: THREE.DoubleSide, transparent: true }),
          );
          confetti.position.set(cell.col - center, 0.9, cell.row - center);
          confetti.userData['origin'] = confetti.position.clone();
          confetti.userData['velocity'] = new THREE.Vector3(Math.cos(angle) * 0.5, 0.8 + (index % 3) * 0.15, Math.sin(angle) * 0.5);
          confetti.userData['phase'] = index;
          this.festivities.add(confetti);
        }
      }
    }
    this.dirty = true;
  }

  private clearFestivities(): void {
    this.festivities.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (!Array.isArray(object.material)) object.material.dispose();
      }
    });
    this.festivities.clear();
  }

  clearCelebration(): void {
    this.clearFestivities();
    this.greetingUntil = 0;
    this.dirty = true;
  }

  private makeTraveler(): void {
    this.traveler.add(this.courierBody);
    this.mesh(this.track(new THREE.CapsuleGeometry(0.07, 0.10, 3, 7)), '#496d63', new THREE.Vector3(0, 0.12, 0), this.courierBody);
    this.mesh(this.track(new THREE.SphereGeometry(0.065, 10, 7)), '#e9c2a0', new THREE.Vector3(0, 0.265, 0), this.courierBody);
    const eye = this.track(new THREE.SphereGeometry(0.008, 5, 4));
    this.mesh(eye, '#384c41', new THREE.Vector3(-0.024, 0.269, 0.057), this.courierBody);
    this.mesh(eye, '#384c41', new THREE.Vector3(0.024, 0.269, 0.057), this.courierBody);
    this.mesh(this.track(new THREE.CylinderGeometry(0.095, 0.095, 0.025, 10)), '#d4ac58', new THREE.Vector3(0, 0.31, 0), this.courierBody);
    this.mesh(this.track(new THREE.CylinderGeometry(0.065, 0.075, 0.055, 8)), '#d4ac58', new THREE.Vector3(0, 0.34, 0), this.courierBody);
    this.mesh(this.track(new THREE.CylinderGeometry(0.073, 0.077, 0.016, 8)), '#8c7650', new THREE.Vector3(0, 0.322, 0), this.courierBody);
    this.mesh(this.track(new THREE.BoxGeometry(0.09, 0.10, 0.06)), '#bc8262', new THREE.Vector3(0, 0.15, -0.065), this.courierBody);
    const arm = this.track(new THREE.CapsuleGeometry(0.019, 0.065, 2, 5));
    const hand = this.track(new THREE.SphereGeometry(0.018, 6, 4));
    for (const [group, x] of [[this.armLeft, -0.08], [this.armRight, 0.08]] as const) {
      group.position.set(x, 0.185, 0);
      this.mesh(arm, '#496d63', new THREE.Vector3(0, -0.036, 0), group);
      this.mesh(hand, '#e9c2a0', new THREE.Vector3(0, -0.09, 0), group);
      this.courierBody.add(group);
    }
    const foot = this.track(new THREE.BoxGeometry(0.035, 0.07, 0.05));
    this.mesh(foot, '#5c5547', new THREE.Vector3(-0.035, 0.025, 0), this.footLeft);
    this.mesh(foot, '#5c5547', new THREE.Vector3(0.035, 0.025, 0), this.footRight);
    this.traveler.add(this.footLeft, this.footRight);
  }

  private updateFrameProjection(width: number, height: number): void {
    const origin = new THREE.Vector3(0, 0.3, 0).project(this.camera);
    const col = new THREE.Vector3(1, 0.3, 0).project(this.camera);
    const row = new THREE.Vector3(0, 0.3, 1).project(this.camera);
    const colAxis = new THREE.Vector2((col.x - origin.x) * width, -(col.y - origin.y) * height);
    const rowAxis = new THREE.Vector2((row.x - origin.x) * width, -(row.y - origin.y) * height);
    const scale = Math.max(colAxis.length(), rowAxis.length());
    if (scale > 0) {
      const round = (value: number): number => Number(value.toFixed(3));
      const axes: FrameAxes = {
        col: { x: round(colAxis.x / scale), y: round(colAxis.y / scale) },
        row: { x: round(rowAxis.x / scale), y: round(rowAxis.y / scale) },
      };
      const key = JSON.stringify(axes);
      if (key !== this.projectionKey) { this.projectionKey = key; this.callbacks.onProjection(axes); }
    }
  }

  guideBounds(cell: Cell, shape: Shape): GuideBounds {
    const bounds = this.canvas.getBoundingClientRect();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const col of [cell.col, cell.col + shape.cols]) {
      for (const row of [cell.row, cell.row + shape.rows]) {
        const point = new THREE.Vector3(col - this.size / 2, 0.45, row - this.size / 2).project(this.camera);
        xs.push(bounds.x + (point.x + 1) * bounds.width / 2);
        ys.push(bounds.y + (1 - point.y) * bounds.height / 2);
      }
    }
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }

  private updatePickingMap(): void {
    if (!import.meta.env.DEV) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.canvas.dataset['cellCenters'] = JSON.stringify(
      Array.from({ length: this.size * this.size }, (_, index) => {
        const row = Math.floor(index / this.size);
        const col = index % this.size;
        const center = (this.size - 1) / 2;
        const point = new THREE.Vector3(col - center, 0.30, row - center).project(this.camera);
        return { row, col, x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 };
      }),
    );
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.position.set(width < 680 ? 0.2 : 7.4, width < 680 ? 13 : 12, width < 680 ? 7.5 : 10.5);
    this.camera.lookAt(0, 0.1, 0);
    this.camera.updateMatrixWorld();
    let halfWidth = 0;
    let halfHeight = 0;
    for (const x of [-this.size / 2, this.size / 2]) {
      for (const z of [-this.size / 2, this.size / 2]) {
        for (const y of [0, 1.4]) {
          const point = new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse);
          halfWidth = Math.max(halfWidth, Math.abs(point.x));
          halfHeight = Math.max(halfHeight, Math.abs(point.y));
        }
      }
    }
    const margin = Math.min(24, Math.max(16, Math.min(width, height) * 0.08));
    const vertical = 2 * Math.max(
      halfHeight * height / Math.max(1, height - margin * 2),
      halfWidth * width / Math.max(1, width - margin * 2) / aspect,
    );
    this.camera.left = -vertical * aspect / 2;
    this.camera.right = vertical * aspect / 2;
    this.camera.top = vertical / 2;
    this.camera.bottom = -vertical / 2;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.labelScale = 28 * vertical / height;
    this.traveler.scale.setScalar(Math.max(1, Math.min(2.4, this.labelScale * 1.65)));
    this.landmarkSprites.forEach((sprite) => sprite.scale.set(this.labelScale, this.labelScale, 1));
    this.frames.children.forEach((object) => {
      if (object instanceof THREE.Sprite) object.scale.set(this.labelScale * 0.92, this.labelScale * 0.92, 1);
    });
    this.updateFrameProjection(width, height);
    this.updatePickingMap();
    this.dirty = true;
  }

  private pick(event: PointerEvent | MouseEvent): Cell | null {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const intersection of this.raycaster.intersectObjects(this.boardGroup.children, true)) {
      let root: THREE.Object3D = intersection.object;
      while (root.parent && root.parent !== this.boardGroup) root = root.parent;
      const index = this.tiles.findIndex((tile) => tile.group === root);
      if (index >= 0) return { row: Math.floor(index / this.size), col: index % this.size };
    }
    const hit = this.raycaster.intersectObject(this.pickPlane)[0];
    if (!hit) return null;
    const col = Math.floor(hit.point.x + this.size / 2);
    const row = Math.floor(hit.point.z + this.size / 2);
    return row >= 0 && col >= 0 && row < this.size && col < this.size ? { row, col } : null;
  }

  private pointerMove = (event: PointerEvent): void => {
    if (this.movement) return;
    const cell = this.pick(event);
    const key = cell ? `${cell.row},${cell.col}` : null;
    if (key !== this.currentHover) {
      this.currentHover = key;
      this.canvas.style.cursor = cell ? 'pointer' : 'default';
      this.callbacks.onHover(cell);
    }
  };

  private pointerLeave = (): void => {
    this.currentHover = null;
    this.callbacks.onHover(null);
  };

  private contextLost = (event: Event): void => {
    event.preventDefault();
    console.error('The living terrain WebGL context was lost.');
    this.callbacks.onError('The graphics context paused. Switching to the accessible flat map; your repair is safe.');
  };

  private pointerClick = (event: MouseEvent): void => {
    if (this.movement) return;
    const cell = this.pick(event);
    if (cell) this.callbacks.onCell(cell);
  };

  private resetTickTime = (): void => { this.previousTick = performance.now(); };

  private tick = (now: number): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const elapsedFrame = Math.min(60, Math.max(0, now - this.previousTick));
    this.previousTick = now;
    if (document.hidden || this.paused) return;
    this.visualTime += elapsedFrame;
    this.time.value = this.reduced ? 0 : this.visualTime / 1000;
    const stride = this.travelerWalking && !this.reduced ? Math.sin(this.time.value * 18) * 0.38 : 0;
    this.footLeft.rotation.x = stride;
    this.footRight.rotation.x = -stride;
    this.armLeft.rotation.x = -stride * 0.8;
    this.armRight.rotation.x = stride * 0.8;
    this.armRight.rotation.z = !this.reduced && !this.travelerWalking && this.visualTime < this.greetingUntil
      ? -1.35 + Math.sin(this.time.value * 11) * 0.18 : 0;
    this.courierBody.position.y = Math.abs(stride) * 0.04;
    this.courierBody.rotation.z = stride * 0.06;
    if (this.movement) {
      const progress = Math.min(1, (this.visualTime - this.movement.began) / 680);
      const eased = progress * progress * (3 - 2 * progress);
      for (const object of this.movement.objects) {
        object.group.position.lerpVectors(object.from, object.to, eased);
        object.group.position.y += Math.sin(Math.PI * progress) * (object.side === 1 ? 0.85 : 1.30);
        object.group.rotation.z = Math.sin(progress * Math.PI * 2) * 0.035 * object.side;
      }
      if (progress === 1) this.finishSwap();
    }
    if (this.festivities.children.length) {
      const elapsed = (this.visualTime - this.celebrationStarted) / 1000;
      const duration = this.reduced ? this.celebrationComplete ? 1.8 : 1.4 : this.celebrationComplete ? 3.2 : 2;
      if (elapsed >= duration) this.clearFestivities();
      else this.festivities.children.forEach((object) => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshBasicMaterial)) return;
        object.material.opacity = Math.max(0, 1 - elapsed / duration);
        if (object.userData['ring']) {
          object.scale.setScalar(this.reduced ? 1 : 1 + elapsed * 0.45);
        } else {
          const origin: unknown = object.userData['origin'];
          const velocity: unknown = object.userData['velocity'];
          if (origin instanceof THREE.Vector3 && velocity instanceof THREE.Vector3) {
            object.position.copy(origin).addScaledVector(velocity, elapsed);
            object.position.y -= 0.55 * elapsed * elapsed;
            object.rotation.set(elapsed * 2, elapsed + Number(object.userData['phase'] ?? 0), elapsed * 0.8);
          }
        }
      });
      this.dirty = true;
    }
    if (import.meta.env.DEV) this.canvas.dataset['greetingActive'] = String(this.armRight.rotation.z !== 0);
    if (!this.reduced || this.dirty || this.movement) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  };

  private clearBoard(): void {
    this.boardGroup.traverse((object) => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.boardGroup.clear();
    this.landmarkSprites = [];
    this.houseWindows.clear();
    this.greetingUntil = 0;
    this.clearFestivities();
    this.tiles = [];
    this.boardGeometries.forEach((geometry) => geometry.dispose());
    this.boardMaterials.forEach((material) => material.dispose());
    this.boardTextures.forEach((texture) => texture.dispose());
    this.boardGeometries = [];
    this.boardMaterials = [];
    this.boardTextures = [];
    this.clearFrames();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.resetTickTime);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    this.canvas.removeEventListener('click', this.pointerClick);
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.clearBoard();
    this.setRoutes([]);
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.extraMaterials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
    this.canvas.remove();
  }
}
