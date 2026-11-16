import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canTraverse, connects, isAnchor, locate, patchCells, patchOutline, tileAt, walkable } from '../shared/rules.ts';
import type { Anchor, Board, Celebration, Cell, FrameAxes, GuideBounds, Shape, Swap, Theme } from '../shared/types.ts';
import type { PlaybackFrame } from '../shared/playback.ts';
import { COMPLETION_CELEBRATION_MS } from '../shared/playback.ts';
import { COURIER_SCALE, FLOWER_COLORS, GRASS_COLORS, HOME_BADGE_BG, HOME_COLORS, worldPalette } from './worldTheme.ts';
import type { WorldColor, WorldPalette } from './worldTheme.ts';
import { sceneryOrigins, tileScenery, waterBanks } from './scenery.ts';
import type { Flower } from './scenery.ts';
import { HOME_GLYPHS, HOME_PLAQUE_PATH, HOME_SPROUT_PATH } from './homeLetter.ts';
import { communityCrowd, parcelMotion, postcardGarden, villageProgress } from './postcard.ts';
import { carvedEarth, postcardFlowers, postcardResident } from './postcardArt.ts';

interface Callbacks {
  onCell: (cell: Cell) => void;
  onHover: (cell: Cell | null) => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  onProjection: (axes: FrameAxes) => void;
}

interface TileObject {
  origin: number;
  group: THREE.Group;
  water: THREE.ShaderMaterial | null;
  links: { mesh: THREE.Mesh; row: number; col: number }[];
  bounds: THREE.Box3;
  batchParts: BatchedPart[];
  sprout: THREE.Mesh | null;
}

interface BatchedPart {
  batch: THREE.InstancedMesh;
  source: THREE.Mesh;
  sourceIndex: number | null;
  targetIndex: number;
}

interface Movement {
  move: Swap;
  next: Board;
  began: number;
  objects: { tile: TileObject; group: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; side: number }[];
  parcels: { side: number; from: THREE.Vector3; to: THREE.Vector3; objects: Movement['objects'] }[];
  courierYaw: number;
}

interface PostcardHome {
  door: THREE.Group;
  garden: THREE.Group;
  resident: THREE.Group | null;
  arm: THREE.Group | null;
  phase: number;
}

const hasWater = (tile: string | undefined): boolean => tile === '~' || tile === 'h' || tile === 'v';
const INPUT_LAYER = 1;

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
    bevelSegments: 1, steps: 1, curveSegments: 2,
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

function paving(width: number, depth: number, rows: number): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const random = randomSeed(4281 + rows);
  for (let row = 0; row < rows; row++) {
    const split = row % 2 ? 0.57 : 0.43;
    for (let col = 0; col < 2; col++) {
      const span = width * (col === 0 ? split : 1 - split);
      const x = col === 0 ? -width / 2 + span / 2 : width / 2 - span / 2;
      const stone = roundedPrism(span - 0.040, depth / rows - 0.040, 0.035 + random() * 0.006, 0.018);
      stone.translate(x, random() * 0.004, (row + 0.5) * depth / rows - depth / 2);
      const normals = stone.getAttribute('normal');
      const colors: number[] = [];
      const variation = 0.83 + random() * 0.17;
      for (let index = 0; index < normals.count; index++) {
        const shade = variation * (normals.getY(index) > 0.7 ? 1 : 0.82);
        colors.push(shade, shade, shade);
      }
      stone.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      pieces.push(stone);
    }
  }
  const geometry = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  if (!geometry) throw new Error('The stone paving could not be assembled.');
  return geometry;
}

function granite(): THREE.BufferGeometry {
  const geometry = new THREE.DodecahedronGeometry(0.34);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const grain = 1 + Math.sin(x * 21 + z * 13) * 0.11 + Math.cos(y * 17 + z * 7) * 0.07;
    positions.setXYZ(index, x * grain, y * grain * 0.84, z * grain * 0.91);
  }
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  const colors: number[] = [];
  for (let index = 0; index < normals.count; index++) {
    const shade = Math.min(1, 0.66 + normals.getY(index) * 0.24 - normals.getX(index) * 0.12);
    colors.push(shade * 0.94, shade * 0.98, shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function bridgeDirection(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.045, -0.045);
  shape.lineTo(0.045, 0);
  shape.lineTo(-0.045, 0.045);
  shape.closePath();
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

export class LivingIsland {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private hemisphere = new THREE.HemisphereLight('#fff8e9', '#71917d', 1.9);
  private sun = new THREE.DirectionalLight('#fff0d4', 2.3);
  private camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 80);
  private boardGroup = new THREE.Group();
  private terrainBatches = new THREE.Group();
  private batchBindings: BatchedPart[][] = [];
  private frames = new THREE.Group();
  private trails = new THREE.Group();
  private traveler = new THREE.Group();
  private travelerEnvelope = new THREE.Box3();
  private observer: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pickCandidates: THREE.Object3D[] = [];
  private pickHits: THREE.Intersection[] = [];
  private pickFrame = 0;
  private pendingPointer: { clientX: number; clientY: number } | null = null;
  private pointer = new THREE.Vector2();
  private pickPlane: THREE.Mesh;
  private tiles: TileObject[] = [];
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private terrainMaterials = new Map<string, { material: THREE.MeshStandardMaterial; role: WorldColor }>();
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
  private postcardHomes = new Map<Anchor, PostcardHome>();
  private postcardStarted: number | null = null;
  private postcardSettled = false;
  private postcardSoil: THREE.BufferGeometry | null = null;
  private postcardFlowerGeometries: THREE.BufferGeometry[] = [];
  private postcardMaterial: THREE.MeshStandardMaterial | null = null;
  private communityCount: number | null = null;
  private communityBodies: THREE.InstancedMesh | null = null;
  private communityArms: THREE.InstancedMesh | null = null;
  private crowdBodyPose = new THREE.Object3D();
  private crowdArmPose = new THREE.Object3D();
  private festivities = new THREE.Group();
  private celebrationStarted = 0;
  private celebrationComplete = false;
  private movement: Movement | null = null;
  private projectionKey = '';
  private reduced = false;
  private darkMode = false;
  private theme: Theme = 'meadow';
  private palette: WorldPalette = worldPalette('meadow', false);
  private seaColor = new THREE.Color(this.palette.sea);
  private paused = false;
  private visualTime = 0;
  private previousTick = performance.now();
  private frame = 0;
  private disposed = false;
  private currentHover: string | null = null;
  private dirty = true;
  private lastRender = 0;
  private renderHeight = 1;
  private liftPoint = new THREE.Vector3();
  private shadowsDirty = true;
  private highlightKey = '';
  private highlightMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private highlightBar = this.track(new THREE.BoxGeometry(1, 1, 1));
  private highlightFill = this.track(new THREE.PlaneGeometry(1, 1));
  private blockedOuter = this.track(new THREE.RingGeometry(0.35, 0.48, 24));
  private blockedInner = this.track(new THREE.RingGeometry(0.38, 0.45, 24));
  private batchMatrix = new THREE.Matrix4();
  private instanceMatrix = new THREE.Matrix4();
  private batchColor = new THREE.Color();
  private soilGeometry = this.track(roundedPrism(0.985, 0.985, 0.23, 0.07));
  private waterBedGeometry = this.track(roundedPrism(0.985, 0.985, 0.135, 0.07));
  private waterDepthGeometry = this.track(roundedPrism(0.99, 0.99, 0.06, 0.025));
  private topGeometry = this.track(roundedPrism(0.97, 0.97, 0.055, 0.055));
  private stoneGeometry = this.track(paving(0.70, 0.70, 3));
  private roadBedGeometry = this.track(roundedPrism(0.73, 0.73, 0.018, 0.055));
  private roadLinkGeometry = this.track(paving(0.44, 0.16, 1));
  private bridgeLinkGeometry = this.track(roundedPrism(0.44, 0.16, 0.045, 0.02));
  private bridgeDeck = this.track(roundedPrism(0.94, 0.44, 0.07, 0.025));
  private bridgePlank = this.track(roundedPrism(0.103, 0.46, 0.04, 0.012));
  private bridgePost = this.track(new THREE.BoxGeometry(0.038, 0.25, 0.038));
  private bridgePier = this.track(roundedPrism(0.14, 0.54, 0.12, 0.02));
  private bridgeRail = this.track(new THREE.BoxGeometry(0.94, 0.03, 0.025));
  private bridgeArrow = this.track(bridgeDirection());
  private bridgeArrowShaft = this.track(new THREE.BoxGeometry(0.40, 0.008, 0.027));
  private roofGeometry = this.track(cottageRoof());
  private flowerStem = this.track(new THREE.CylinderGeometry(0.008, 0.009, 0.12, 4));
  private flowerPetal = this.track(new THREE.SphereGeometry(0.027, 5, 4));
  private flowerCenter = this.track(new THREE.SphereGeometry(0.018, 5, 4));
  private rockGeometry = this.track(granite());
  private rockEdges = this.track(new THREE.EdgesGeometry(this.rockGeometry, 28));
  private rockSeams = new THREE.LineBasicMaterial({ color: '#415663', transparent: true, opacity: 0.28 });
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
  private readonly postcard: boolean;

  constructor(container: HTMLElement, callbacks: Callbacks, postcard = false) {
    this.container = container;
    this.callbacks = callbacks;
    this.postcard = postcard;
    if (postcard) {
      this.postcardSoil = this.track(carvedEarth(this.soilGeometry.clone()));
      this.postcardMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.9 });
      this.extraMaterials.push(this.postcardMaterial);
      const neighbor = postcardResident('#507e78');
      this.communityBodies = new THREE.InstancedMesh(this.track(neighbor.body), this.postcardMaterial, 12);
      this.communityArms = new THREE.InstancedMesh(this.track(neighbor.arm), this.postcardMaterial, 12);
      for (const crowd of [this.communityBodies, this.communityArms]) {
        crowd.count = 0; crowd.visible = false; crowd.frustumCulled = false;
        crowd.castShadow = true; crowd.receiveShadow = true;
        crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(crowd);
      }
    }
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Reuse the static island shadow until a caster moves.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.canvas = this.renderer.domElement;
    this.raycaster.layers.set(INPUT_LAYER);
    this.canvas.className = 'island-canvas';
    this.canvas.dataset['postcard'] = postcard ? 'puzzle' : 'off';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      console.error('The terrain shader could not compile:', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment));
      this.callbacks.onError('The living terrain could not render here. Switching to the fully playable flat map.');
    };
    this.canvas.addEventListener('webglcontextlost', this.contextLost);
    container.appendChild(this.canvas);
    this.scene.add(this.hemisphere);
    const sun = this.sun;
    sun.position.set(-3.5, 9, 5);
    sun.castShadow = true;
    const shadowSize = 1024;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.normalBias = 0.018;
    sun.shadow.bias = -0.0001;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    const seaMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: this.time, uColor: { value: this.seaColor } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        void main(){float d=length(vUv-.5)*2.; float a=smoothstep(1.,.52,d)*.38;
          float rings=sin(d*68.-uTime*.65)*.012; gl_FragColor=vec4(uColor+rings,a);
          #include <colorspace_fragment>
        }`,
    });
    this.extraMaterials.push(seaMaterial);
    const seaGeometry = this.track(new THREE.CircleGeometry(6.6, 80));
    this.waterSurround = new THREE.Mesh(seaGeometry, seaMaterial);
    this.waterSurround.rotation.x = -Math.PI / 2;
    this.waterSurround.position.y = -0.22;
    this.scene.add(this.waterSurround);
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.20 });
    this.extraMaterials.push(shadowMaterial);
    const shadow = new THREE.Mesh(this.track(new THREE.PlaneGeometry(14, 14)), shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.18;
    shadow.receiveShadow = true;
    this.scene.add(shadow);
    this.extraMaterials.push(this.rockSeams);
    this.grassMaterial = this.terrainMaterial('blade');
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
    this.pickPlane.layers.enable(INPUT_LAYER);
    this.scene.add(this.pickPlane, this.boardGroup, this.terrainBatches, this.frames, this.trails, this.festivities);
    this.makeTraveler();
    const travelerBounds = new THREE.Box3().setFromObject(this.traveler);
    const radius = Math.max(Math.abs(travelerBounds.min.x), travelerBounds.max.x, Math.abs(travelerBounds.min.z), travelerBounds.max.z) + 0.04;
    this.travelerEnvelope.set(
      new THREE.Vector3(-radius, travelerBounds.min.y - 0.03, -radius),
      new THREE.Vector3(radius, travelerBounds.max.y + 0.03, radius),
    );
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

  private terrainMaterial(role: WorldColor, vertexColors = false, flatShading = false): THREE.MeshStandardMaterial {
    const key = `${role}:${vertexColors}:${flatShading}`;
    const existing = this.terrainMaterials.get(key);
    if (existing) return existing.material;
    const material = new THREE.MeshStandardMaterial({
      color: this.palette[role], roughness: 0.94, vertexColors, flatShading,
    });
    this.terrainMaterials.set(key, { material, role });
    this.extraMaterials.push(material);
    return material;
  }

  private mesh(geometry: THREE.BufferGeometry, color: string | THREE.MeshStandardMaterial, position: THREE.Vector3, parent: THREE.Group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, typeof color === 'string' ? this.material(color) : color);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.layers.enable(INPUT_LAYER);
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
      const light = 0.78 + random() * 0.32;
      grass.setColorAt(i, new THREE.Color().setRGB(light, light, light));
    }
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    group.add(grass);
  }

  private addFlowers(group: THREE.Group, flowers: readonly Flower[], theme: Theme): void {
    for (const bloom of flowers) {
      const flower = new THREE.Group();
      flower.position.set(bloom.x, 0.25, bloom.z);
      flower.rotation.y = bloom.rotation;
      flower.scale.setScalar(bloom.scale);
      this.mesh(this.flowerStem, this.terrainMaterial('grassDeep'), new THREE.Vector3(0, 0.06, 0), flower);
      const petals = new THREE.InstancedMesh(this.flowerPetal, this.material(FLOWER_COLORS[theme][bloom.color]), 5);
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < 5; i++) {
        matrix.makeTranslation(Math.cos(i * 1.256) * 0.027, 0.125, Math.sin(i * 1.256) * 0.027);
        petals.setMatrixAt(i, matrix);
      }
      petals.instanceMatrix.needsUpdate = true;
      flower.add(petals);
      this.mesh(this.flowerCenter, '#f3d16f', new THREE.Vector3(0, 0.14, 0), flower);
      flower.traverse((part) => part.layers.disable(INPUT_LAYER));
      group.add(flower);
    }
  }

  private addTree(group: THREE.Group, random: () => number, theme: Theme): void {
    const tree = new THREE.Group();
    tree.position.set((random() - 0.5) * 0.35, 0.25, (random() - 0.5) * 0.35);
    this.mesh(this.boardTrack(new THREE.CylinderGeometry(0.028, 0.045, 0.25, 6)), '#92714f', new THREE.Vector3(0, 0.12, 0), tree);
    if (theme === 'coast') {
      this.mesh(this.boardTrack(new THREE.ConeGeometry(0.22, 0.32, 9)), this.terrainMaterial('grassDeep'), new THREE.Vector3(0, 0.36, 0), tree);
      this.mesh(this.boardTrack(new THREE.ConeGeometry(0.16, 0.26, 9)), this.terrainMaterial('blade'), new THREE.Vector3(0, 0.54, -0.025), tree);
      group.add(tree);
      return;
    }
    const foliage = this.boardTrack(new THREE.IcosahedronGeometry(0.19, 1));
    this.mesh(foliage, this.terrainMaterial('grassDeep'), new THREE.Vector3(-0.09, 0.37, 0.03), tree);
    this.mesh(foliage, this.terrainMaterial('grassAlt'), new THREE.Vector3(0.09, 0.4, -0.025), tree);
    this.mesh(foliage, this.terrainMaterial('blade'), new THREE.Vector3(0, 0.54, 0), tree);
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
    if (isAnchor(text) && !persistent) {
      context.save();
      context.translate(16, 10);
      context.scale(3, 3);
      const plaque = new Path2D(HOME_PLAQUE_PATH);
      context.fillStyle = HOME_BADGE_BG;
      context.fill(plaque);
      context.strokeStyle = color;
      context.lineWidth = 1.25;
      context.lineJoin = 'round';
      context.stroke(plaque);
      context.fillStyle = color;
      context.fill(new Path2D(HOME_GLYPHS[text]), 'evenodd');
      context.fill(new Path2D(HOME_SPROUT_PATH));
      context.restore();
    } else {
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
    }
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
    sprite.layers.enable(INPUT_LAYER);
    if (!persistent) this.landmarkSprites.push(sprite);
    return sprite;
  }

  private addHouse(group: THREE.Group, anchor: Anchor): void {
    const roofColor = HOME_COLORS[anchor];
    const house = new THREE.Group();
    house.position.set(-0.04, 0, -0.17);
    group.add(house);
    const wall = this.boardTrack(roundedPrism(0.47, 0.42, 0.37, 0.03));
    this.mesh(wall, '#f0dfb8', new THREE.Vector3(0, 0.255, 0), house);
    this.mesh(this.boardTrack(roundedPrism(0.52, 0.46, 0.035, 0.025)), this.terrainMaterial('roadShade'),
      new THREE.Vector3(0, 0.255, 0), house);
    this.mesh(this.roofGeometry, roofColor, new THREE.Vector3(0, 0.61, 0), house);
    const roofSeams = new THREE.InstancedMesh(this.boardTrack(new THREE.BoxGeometry(0.376, 0.012, 0.012)),
      this.material(new THREE.Color(roofColor).multiplyScalar(0.65).getStyle()), 10);
    const seam = new THREE.Object3D();
    for (let index = 0; index < 10; index++) {
      const side = index < 5 ? -1 : 1;
      seam.position.set(side * 0.145, 0.735, (index % 5 - 2) * 0.10);
      seam.rotation.z = -side * Math.atan2(0.24, 0.29);
      seam.updateMatrix();
      roofSeams.setMatrixAt(index, seam.matrix);
    }
    roofSeams.instanceMatrix.needsUpdate = true;
    house.add(roofSeams);
    this.mesh(this.boardTrack(new THREE.BoxGeometry(0.028, 0.028, 0.54)),
      new THREE.Color(roofColor).multiplyScalar(0.75).getStyle(), new THREE.Vector3(0, 0.86, 0), house);
    if (this.postcard) this.addPostcardHome(house, anchor);
    else {
      this.mesh(this.boardTrack(new THREE.BoxGeometry(0.10, 0.19, 0.025)), '#704c33', new THREE.Vector3(0, 0.36, 0.221), house);
      this.mesh(this.boardTrack(new THREE.SphereGeometry(0.009, 5, 4)), '#e3b960', new THREE.Vector3(0.027, 0.355, 0.239), house);
    }
    const doorPost = this.boardTrack(new THREE.BoxGeometry(0.018, 0.205, 0.035));
    for (const x of [-0.06, 0.06]) this.mesh(doorPost, '#c29c65', new THREE.Vector3(x, 0.36, 0.225), house);
    const windowGeometry = this.boardTrack(new THREE.BoxGeometry(0.075, 0.075, 0.022));
    const windows = new THREE.MeshStandardMaterial({ color: '#ffe6ad', emissive: '#edb252', emissiveIntensity: 0.12, roughness: 0.45 });
    this.boardMaterials.push(windows);
    this.houseWindows.set(anchor, windows);
    this.mesh(windowGeometry, windows, new THREE.Vector3(-0.14, 0.48, 0.223), house);
    this.mesh(windowGeometry, windows, new THREE.Vector3(0.14, 0.48, 0.223), house);
    const sill = this.boardTrack(new THREE.BoxGeometry(0.11, 0.02, 0.05));
    this.mesh(sill, '#c7ae83', new THREE.Vector3(-0.14, 0.435, 0.24), house);
    this.mesh(sill, '#c7ae83', new THREE.Vector3(0.14, 0.435, 0.24), house);
    const windowGarden = this.boardTrack(new THREE.BoxGeometry(0.09, 0.027, 0.035));
    for (const x of [-0.14, 0.14]) this.mesh(windowGarden, this.terrainMaterial('blade'), new THREE.Vector3(x, 0.446, 0.255), house);
    this.mesh(this.boardTrack(new THREE.BoxGeometry(0.075, 0.20, 0.075)), '#b89b7b', new THREE.Vector3(-0.14, 0.77, -0.08), house);
    this.mesh(this.boardTrack(roundedPrism(0.20, 0.16, 0.035, 0.03)), '#e3d6b8', new THREE.Vector3(0, 0.27, 0.27), house);
    this.mesh(this.boardTrack(new THREE.CylinderGeometry(0.012, 0.015, 0.20, 5)), '#92714f', new THREE.Vector3(0.31, 0.35, 0.18), house);
    this.mesh(this.boardTrack(roundedPrism(0.11, 0.11, 0.07, 0.025)), roofColor, new THREE.Vector3(0.31, 0.44, 0.18), house);
    group.add(this.label(anchor, roofColor));
  }

  private addPostcardHome(house: THREE.Group, anchor: Anchor): void {
    const material = this.postcardMaterial;
    const flowers = this.postcardFlowerGeometries[(anchor.charCodeAt(0) - 65) % 3];
    if (!material || !flowers) throw new Error('The living village is missing its shared art.');
    const phase = anchor.charCodeAt(0) - 65;
    this.mesh(this.boardTrack(new THREE.BoxGeometry(0.102, 0.19, 0.007)), '#293d37', new THREE.Vector3(0, 0.36, 0.222), house);
    const door = new THREE.Group();
    door.position.set(-0.05, 0.36, 0.238);
    this.mesh(this.boardTrack(new THREE.BoxGeometry(0.10, 0.19, 0.018)), '#785238', new THREE.Vector3(0.05, 0, 0), door);
    this.mesh(this.boardTrack(new THREE.SphereGeometry(0.009, 5, 4)), '#e3b960', new THREE.Vector3(0.079, -0.005, 0.017), door);
    house.add(door);
    const garden = new THREE.Group();
    garden.position.y = 0.45;
    for (const x of [-0.14, 0.14]) {
      const bloom = this.mesh(flowers, material, new THREE.Vector3(x, 0, 0.257), garden);
      bloom.scale.setScalar(0.42);
    }
    garden.scale.y = 0.001;
    garden.visible = false;
    house.add(garden);
    let resident: THREE.Group | null = null, arm: THREE.Group | null = null;
    if (anchor === 'B' || anchor === 'C' || anchor === 'D') {
      const art = postcardResident(HOME_COLORS[anchor]);
      resident = new THREE.Group();
      this.mesh(this.boardTrack(art.body), material, new THREE.Vector3(), resident);
      arm = new THREE.Group();
      arm.position.set(0.061, 0.186, 0.01);
      this.mesh(this.boardTrack(art.arm), material, new THREE.Vector3(), arm);
      resident.add(arm);
      resident.position.set(0, 0.27, 0.12);
      resident.visible = false;
      house.add(resident);
    }
    for (const animated of [door, garden, resident]) animated?.traverse((part) => {
      part.layers.disable(INPUT_LAYER);
      if (part instanceof THREE.Mesh) part.userData['postcardMotion'] = true;
    });
    this.postcardHomes.set(anchor, { door, garden, resident, arm, phase });
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

  private makeWater(row: number, col: number, fish: boolean, variant: number): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.time,
        uShore: { value: new THREE.Vector4() },
        uCorners: { value: new THREE.Vector4() },
        uOffset: { value: new THREE.Vector2(col, row) },
        uFish: { value: new THREE.Vector2(fish ? 1 : 0, variant) },
        uDeep: { value: new THREE.Color(this.palette.water) },
        uLight: { value: new THREE.Color(this.palette.waterLight) },
        uFoam: { value: new THREE.Color(this.palette.foam) },
      },
      vertexShader: `varying vec2 vUv; varying vec3 vWorld;
        void main(){vUv=uv; vWorld=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float uTime; uniform vec4 uShore; uniform vec4 uCorners; uniform vec2 uOffset; uniform vec2 uFish;
        uniform vec3 uDeep; uniform vec3 uLight; uniform vec3 uFoam; varying vec2 vUv; varying vec3 vWorld;
        void main(){
          vec2 uv=vWorld.xz;
          float a=uv.x*4.3+uv.y*3.1+uTime*.65;
          float b=uv.y*6.2-uv.x*2.4-uTime*.48;
          float c=uv.x*9.1-uv.y*7.7+uTime*.31;
          vec3 normal=normalize(vec3(cos(a)*.11+sin(c)*.025,1.,cos(b)*.085));
          vec3 view=normalize(cameraPosition-vWorld);
          float fresnel=pow(1.-max(0.,dot(view,normal)),3.);
          float glint=pow(max(0.,dot(normal,normalize(view+vec3(-.4,.85,.25)))),42.);
          float bank=2.;
          if(uShore.x>.5)bank=min(bank,vUv.x);
          if(uShore.y>.5)bank=min(bank,1.-vUv.x);
          if(uShore.z>.5)bank=min(bank,vUv.y);
          if(uShore.w>.5)bank=min(bank,1.-vUv.y);
          if(uCorners.x>.5)bank=min(bank,length(vUv));
          if(uCorners.y>.5)bank=min(bank,length(vUv-vec2(1.,0.)));
          if(uCorners.z>.5)bank=min(bank,length(vUv-vec2(0.,1.)));
          if(uCorners.w>.5)bank=min(bank,length(vUv-vec2(1.,1.)));
          float depth=smoothstep(0.,.26,bank);
          vec3 water=mix(uLight,uDeep,.44+depth*.56);
          water=mix(water,uLight,(sin(a)*sin(b)+1.)*.065);
          if(uFish.x>.5){
            float phase=uTime*.42+uFish.y*.83;
            vec2 q=vUv-vec2(.5+sin(phase)*.22,.5+sin(phase*.7)*.10);
            q.x*=cos(phase)>=0.?1.:-1.;
            float body=1.-smoothstep(.85,1.,length(q/vec2(.095,.035)));
            float tail=step(-.15,q.x)*(1.-step(-.075,q.x))*step(abs(q.y),(-.075-q.x)*.5);
            water=mix(water,mix(uDeep,uFoam,.45),max(body,tail)*.48);
          }
          float reflection=pow(max(0.,sin(a*.55+b*.2+sin(c)*.15)),10.);
          water=mix(water,mix(uLight,uFoam,.35),reflection*.17+fresnel*.26);
          float shore=1.-smoothstep(.012,.065+sin(a-b)*.008,bank);
          float ripple=(1.-smoothstep(.008,.025,abs(bank-(.075+sin(uTime*.65)*.012))))*(1.-smoothstep(.10,.18,bank));
          water=mix(water,uFoam,shore*.45+ripple*.13);
          water+=uFoam*glint*.20;
          gl_FragColor=vec4(water,1.);
          #include <colorspace_fragment>
        }`,
    });
    this.boardMaterials.push(material);
    return material;
  }

  reset(board: Board, theme: Theme, seed: number, origins: readonly number[] = sceneryOrigins(board.length, [])): void {
    this.cancelHoverFrame();
    this.movement = null;
    this.callbacks.onBusy(false);
    this.clearBoard();
    this.board = board;
    this.currentHover = null;
    this.shadowsDirty = true;
    this.size = board.length;
    const center = (this.size - 1) / 2;
    this.pickPlane.scale.set(this.size / 6, this.size / 6, 1);
    this.waterSurround.scale.setScalar(this.size / 6);
    this.theme = theme;
    this.setAppearance(this.darkMode);
    if (this.postcard) this.postcardFlowerGeometries = FLOWER_COLORS[theme].map((color) => this.boardTrack(postcardFlowers(color)));
    const islandBase = roundedPrism(this.size + 0.02, this.size + 0.02, this.postcard ? 0.14 : 0.055, 0.16);
    this.mesh(this.boardTrack(this.postcard ? carvedEarth(islandBase, 0.14) : islandBase),
      this.terrainMaterial(this.postcard ? 'soil' : 'soilEdge', this.postcard), new THREE.Vector3(0, this.postcard ? -0.15 : -0.08, 0), this.boardGroup);
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const tile = tileAt(board, { row, col });
        const origin = origins[row * this.size + col];
        if (origin === undefined) throw new Error('The island scenery is missing a terrain identity.');
        const scenery = tileScenery(seed, origin);
        const random = randomSeed(seed + Math.floor(origin / this.size) * 731 + origin % this.size * 1591);
        const group = new THREE.Group();
        group.position.set(col - center, 0, row - center);
        const earth = !hasWater(tile) && this.postcardSoil ? this.postcardSoil : hasWater(tile) ? this.waterBedGeometry : this.soilGeometry;
        const soil = this.mesh(earth, this.terrainMaterial('soil', this.postcard && !hasWater(tile)), new THREE.Vector3(0, -0.015, 0), group);
        soil.receiveShadow = true;
        const grassColor = GRASS_COLORS[Math.floor(random() * GRASS_COLORS.length)] ?? 'grass';
        if (!hasWater(tile)) this.mesh(this.topGeometry, this.terrainMaterial(grassColor), new THREE.Vector3(0, 0.22, 0), group);
        let water: THREE.ShaderMaterial | null = null;
        let sprout: THREE.Mesh | null = null;
        const links: TileObject['links'] = [];
        if (hasWater(tile)) {
          const depth = this.mesh(this.waterDepthGeometry, this.terrainMaterial('water'), new THREE.Vector3(0, 0.125, 0), group);
          depth.layers.disable(INPUT_LAYER);
          water = this.makeWater(row, col, tile === '~' && scenery.fish, scenery.variant);
          const plane = new THREE.Mesh(this.waterGeometry, water);
          plane.rotation.x = -Math.PI / 2;
          plane.position.y = 0.205;
          plane.layers.enable(INPUT_LAYER);
          group.add(plane);
        }
        if (walkable(tile)) {
          if (tile === 'h' || tile === 'v') {
            const bridge = new THREE.Group();
            if (tile === 'v') bridge.rotation.y = Math.PI / 2;
            this.mesh(this.bridgeDeck, this.terrainMaterial('woodShade'), new THREE.Vector3(0, 0.27, 0), bridge);
            const planks = new THREE.InstancedMesh(this.bridgePlank, this.terrainMaterial('woodLight'), 8);
            const matrix = new THREE.Matrix4();
            for (let index = 0; index < 8; index++) {
              planks.setMatrixAt(index, matrix.makeTranslation((index - 3.5) * 0.1175, 0.29 + Math.sin((index + 0.5) * Math.PI / 8) * 0.065, 0));
              planks.setColorAt(index, new THREE.Color().setScalar(0.88 + index % 3 * 0.06));
            }
            planks.instanceMatrix.needsUpdate = true;
            planks.castShadow = true;
            planks.receiveShadow = true;
            planks.layers.enable(INPUT_LAYER);
            bridge.add(planks);
            this.mesh(this.bridgeRail, this.terrainMaterial('wood'), new THREE.Vector3(0, 0.57, -0.23), bridge);
            this.mesh(this.bridgeRail, this.terrainMaterial('wood'), new THREE.Vector3(0, 0.57, 0.23), bridge);
            for (const x of [-0.39, 0.39]) {
              this.mesh(this.bridgePier, this.terrainMaterial('rock'), new THREE.Vector3(x, 0.22, 0), bridge);
              for (const z of [-0.23, 0.23]) this.mesh(this.bridgePost, this.terrainMaterial('woodShade'), new THREE.Vector3(x, 0.455, z), bridge);
            }
            this.mesh(this.bridgeArrowShaft, '#40372e', new THREE.Vector3(0, 0.418, 0), bridge);
            for (const side of [-1, 1]) {
              const arrow = this.mesh(this.bridgeArrow, '#40372e', new THREE.Vector3(side * 0.25, 0.402, 0), bridge);
              arrow.rotation.y = side > 0 ? 0 : Math.PI;
            }
            group.add(bridge);
          } else {
            this.mesh(this.roadBedGeometry, this.terrainMaterial('mortar'), new THREE.Vector3(0, 0.275, 0), group);
            this.mesh(this.stoneGeometry, this.terrainMaterial('road', true), new THREE.Vector3(0, 0.295, 0), group);
          }
          for (const direction of [{ row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 }]) {
            if (!connects(tile, direction.row, direction.col)) continue;
            const bridge = tile === 'h' || tile === 'v';
            const link = this.mesh(bridge ? this.bridgeLinkGeometry : this.roadLinkGeometry,
              this.terrainMaterial(bridge ? 'woodLight' : 'road', !bridge),
              new THREE.Vector3(direction.col * 0.425, 0.295, direction.row * 0.425), group);
            if (direction.col) link.rotation.y = Math.PI / 2;
            links.push({ mesh: link, ...direction });
          }
          if (isAnchor(tile)) this.addHouse(group, tile);
        } else if (tile === 'x') {
          const boulder = this.mesh(this.rockGeometry, this.terrainMaterial('rockLight', true, true),
            new THREE.Vector3(-0.04, 0.49, -0.025), group);
          boulder.rotation.y = random() * Math.PI;
          const seams = new THREE.LineSegments(this.rockEdges, this.rockSeams);
          boulder.add(seams);
          const chip = this.mesh(this.rockGeometry, this.terrainMaterial('rock', true, true), new THREE.Vector3(0.23, 0.34, 0.17), group);
          chip.scale.set(0.42, 0.40, 0.48);
          chip.rotation.y = 0.65;
          this.addGrass(group, random, 5);
          const moss = this.mesh(this.smallStone, this.terrainMaterial('moss'), new THREE.Vector3(-0.20, 0.29, 0.21), group);
          moss.scale.set(0.65, 0.6, 0.6);
        } else if (tile === '.') {
          this.addGrass(group, random, Math.max(14, Math.round((this.container.clientWidth < 680 ? 26 : 48) * 6 / this.size)));
          if (scenery.flowers.length) this.addFlowers(group, scenery.flowers, theme);
          else if ((row === 0 || row === this.size - 1 || col === 0 || col === this.size - 1) && random() > 0.84) this.addTree(group, random, theme);
          if (this.postcard && this.postcardMaterial) {
            const geometry = this.postcardFlowerGeometries[scenery.variant % 3];
            if (!geometry) throw new Error('The living garden is missing its flowers.');
            sprout = this.mesh(geometry, this.postcardMaterial,
              new THREE.Vector3((scenery.variant % 3 - 1) * 0.13, 0.255, (Math.floor(scenery.variant / 3) - 1) * 0.13), group);
            sprout.layers.disable(INPUT_LAYER);
            sprout.scale.setScalar(0.001);
            sprout.visible = false;
          }
        }
        this.boardGroup.add(group);
        this.tiles.push({ origin, group, water, links, bounds: new THREE.Box3(), batchParts: [], sprout });
      }
    }
    this.refreshTerrain();
    this.setArrivals([]);
    this.setRoutes([]);
    this.restAt('A');
    this.resize();
    this.buildTerrainBatches();
    this.dirty = true;
  }

  private buildTerrainBatches(): void {
    const groups = new Map<string, { tile: TileObject; source: THREE.Mesh }[]>();
    this.boardGroup.updateWorldMatrix(true, true);
    for (const tile of this.tiles) tile.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
      if (object.userData['postcardMotion']) return;
      const key = `${object.geometry.uuid}:${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
      const entries = groups.get(key) ?? [];
      entries.push({ tile, source: object });
      groups.set(key, entries);
    });
    for (const entries of groups.values()) {
      const first = entries[0]?.source;
      if (entries.length < 2 || !first) continue;
      const count = entries.reduce((sum, { source }) => sum + (source instanceof THREE.InstancedMesh ? source.count : 1), 0);
      const batch = new THREE.InstancedMesh(first.geometry, first.material, count);
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      batch.frustumCulled = false;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      let index = 0;
      for (const { tile, source } of entries) {
        source.layers.disable(0);
        const instances = source instanceof THREE.InstancedMesh ? source.count : 1;
        for (let sourceIndex = 0; sourceIndex < instances; sourceIndex++) {
          if (source instanceof THREE.InstancedMesh && source.instanceColor) source.getColorAt(sourceIndex, this.batchColor);
          else this.batchColor.setRGB(1, 1, 1);
          batch.setColorAt(index, this.batchColor);
          tile.batchParts.push({ batch, source, sourceIndex: source instanceof THREE.InstancedMesh ? sourceIndex : null, targetIndex: index++ });
        }
      }
      this.batchBindings.push(entries.flatMap(({ tile, source }) => tile.batchParts.filter((part) => part.source === source)));
      this.terrainBatches.add(batch);
    }
    this.refreshBatchSlots();
  }

  private refreshBatchSlots(): void {
    for (const parts of this.batchBindings) {
      const batch = parts[0]?.batch;
      if (!batch) continue;
      let index = 0;
      for (const part of parts) {
        if (!part.source.visible) { part.targetIndex = -1; continue; }
        part.targetIndex = index++;
        if (part.source instanceof THREE.InstancedMesh && part.source.instanceColor && part.sourceIndex !== null) {
          part.source.getColorAt(part.sourceIndex, this.batchColor);
        } else this.batchColor.setRGB(1, 1, 1);
        batch.setColorAt(part.targetIndex, this.batchColor);
      }
      batch.count = index;
      batch.visible = index > 0;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    }
    this.syncTerrainBatches(this.tiles);
  }

  private syncTerrainBatches(tiles: readonly TileObject[]): void {
    const changed = new Set<THREE.InstancedMesh>();
    for (const tile of tiles) {
      tile.group.updateWorldMatrix(true, true);
      for (const part of tile.batchParts) {
        if (part.targetIndex < 0) continue;
        if (part.source instanceof THREE.InstancedMesh && part.sourceIndex !== null) {
          part.source.getMatrixAt(part.sourceIndex, this.instanceMatrix);
          this.batchMatrix.multiplyMatrices(part.source.matrixWorld, this.instanceMatrix);
        } else this.batchMatrix.copy(part.source.matrixWorld);
        part.batch.setMatrixAt(part.targetIndex, this.batchMatrix);
        changed.add(part.batch);
      }
    }
    changed.forEach((batch) => { batch.instanceMatrix.needsUpdate = true; });
  }

  private updatePickingBounds(): void {
    this.boardGroup.updateWorldMatrix(true, true);
    const center = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const extent = new THREE.Vector3();
    for (const tile of this.tiles) {
      tile.bounds.setFromObject(tile.group);
      tile.group.traverse((object) => {
        if (!(object instanceof THREE.Sprite)) return;
        object.getWorldPosition(center);
        object.getWorldScale(scale);
        const radius = Math.hypot(scale.x, scale.y) / 2;
        extent.setScalar(radius);
        tile.bounds.expandByPoint(center.clone().sub(extent));
        tile.bounds.expandByPoint(center.clone().add(extent));
      });
      tile.bounds.expandByScalar(0.04);
    }
  }

  private refreshTerrain(): void {
    this.tiles.forEach((tile, index) => {
      const row = Math.floor(index / this.size);
      const col = index % this.size;
      tile.links.forEach((link) => { link.mesh.visible = canTraverse(this.board, { row, col }, { row: row + link.row, col: col + link.col }); });
      if (!tile.water) return;
      tile.water.uniforms['uOffset']?.value.set(col, row);
      const banks = waterBanks(this.board, { row, col });
      tile.water.uniforms['uShore']?.value.set(Number(banks.west), Number(banks.east), Number(banks.south), Number(banks.north));
      tile.water.uniforms['uCorners']?.value.set(Number(banks.southwest), Number(banks.southeast), Number(banks.northwest), Number(banks.northeast));
    });
    this.updatePickingBounds();
    this.refreshBatchSlots();
    this.shadowsDirty = true;
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
    for (const { row, col } of patchCells({ row: 0, col: 0 }, move)) {
        const a = this.tiles[(move.a.row + row) * this.size + move.a.col + col];
        const b = this.tiles[(move.b.row + row) * this.size + move.b.col + col];
        if (!a || !b) throw new Error('The selected landscape patch is missing.');
        objects.push({ tile: a, group: a.group, from: a.group.position.clone(), to: b.group.position.clone(), side: 1 });
        objects.push({ tile: b, group: b.group, from: b.group.position.clone(), to: a.group.position.clone(), side: -1 });
    }
    const parcels = this.postcard ? [1, -1].map((side) => {
      const parts = objects.filter((object) => object.side === side);
      const from = new THREE.Vector3(), to = new THREE.Vector3();
      for (const part of parts) { from.add(part.from); to.add(part.to); }
      from.divideScalar(parts.length); to.divideScalar(parts.length);
      return { side, from, to, objects: parts };
    }) : [];
    this.movement = { move, next, objects, parcels, courierYaw: this.traveler.rotation.y, began: this.visualTime };
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
    if (this.postcard) this.traveler.rotation.y = movement.courierYaw;
    const { move } = movement;
    for (const { row, col } of patchCells({ row: 0, col: 0 }, move)) {
        const ai = (move.a.row + row) * this.size + move.a.col + col;
        const bi = (move.b.row + row) * this.size + move.b.col + col;
        const a = this.tiles[ai];
        const b = this.tiles[bi];
        if (!a || !b) throw new Error('The patch exchange lost a terrain tile.');
        this.tiles[ai] = b;
        this.tiles[bi] = a;
    }
    this.board = movement.next;
    this.movement = null;
    this.refreshTerrain();
    this.resize();
    this.callbacks.onBusy(false);
    this.dirty = true;
  }

  private clearFrames(): void {
    this.frames.clear();
    this.highlightKey = '';
  }

  private highlightMaterial(color: string, opacity: number, doubleSided = false): THREE.MeshBasicMaterial {
    const key = `${color}:${opacity}:${doubleSided}`;
    const existing = this.highlightMaterials.get(key);
    if (existing) return existing;
    const material = new THREE.MeshBasicMaterial({
      color, opacity, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    this.highlightMaterials.set(key, material);
    this.extraMaterials.push(material);
    return material;
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
    const key = JSON.stringify([this.size, shape, first, second, hover, invalid, blockedCells, Boolean(this.movement)]);
    if (key === this.highlightKey) return;
    this.clearFrames();
    this.highlightKey = key;
    if (!hover) this.currentHover = null;
    const add = (cell: Cell, color: string, number: string, preview = false): void => {
      if (cell.row + shape.rows > this.size || cell.col + shape.cols > this.size || cell.row < 0 || cell.col < 0) return;
      const left = cell.col - this.size / 2 + 0.015;
      const back = cell.row - this.size / 2 + 0.015;
      const width = shape.cols - 0.03;
      const depth = shape.rows - 0.03;
      const border = this.highlightMaterial(color, preview ? 0.86 : 1);
      const halo = this.highlightMaterial('#fffdf1', 0.96);
      const bar = (x: number, z: number, length: number, horizontal: boolean, material: THREE.MeshBasicMaterial, thickness: number, order: number): void => {
        const mesh = new THREE.Mesh(this.highlightBar, material);
        mesh.scale.set(horizontal ? length : thickness, 0.025, horizontal ? thickness : length);
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
      if (shape.kind === 'ell') {
        const outline = patchOutline(shape);
        outline.forEach((start, index) => {
          const end = outline[(index + 1) % outline.length];
          if (!end) throw new Error('The L frame is missing an outline edge.');
          edge(cell.col - this.size / 2 + (start.col + end.col) / 2,
            cell.row - this.size / 2 + (start.row + end.row) / 2,
            Math.abs(end.col - start.col) + Math.abs(end.row - start.row), start.row === end.row);
        });
      } else {
        edge(left + width / 2, back, width, true);
        edge(left + width / 2, back + depth, width, true);
        edge(left, back + depth / 2, depth, false);
        edge(left + width, back + depth / 2, depth, false);
      }
      const fills = shape.kind === 'ell' ? patchCells(cell, shape).map((part) => ({
        x: part.col - (this.size - 1) / 2, z: part.row - (this.size - 1) / 2, width: 0.965, depth: 0.965,
      })) : [{ x: left + width / 2, z: back + depth / 2, width: shape.cols - 0.035, depth: shape.rows - 0.035 }];
      for (const part of fills) {
        const fill = new THREE.Mesh(this.highlightFill, this.highlightMaterial(color, preview ? 0.065 : 0.145, true));
        fill.scale.set(part.width, part.depth, 1);
        fill.rotation.x = -Math.PI / 2;
        fill.position.set(part.x, 0.43, part.z);
        fill.renderOrder = 32;
        this.frames.add(fill);
      }
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
        for (const [color, order] of [
          ['#fffdf1', 64],
          ['#a83e2f', 65],
        ] as const) {
          const ring = new THREE.Mesh(order === 64 ? this.blockedOuter : this.blockedInner,
            this.highlightMaterial(color, 1, true));
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
    this.palette = worldPalette(this.theme, dark);
    this.terrainMaterials.forEach(({ material, role }) => material.color.set(this.palette[role]));
    this.rockSeams.color.set(this.palette.rockShade);
    this.tiles.forEach(({ water }) => {
      if (!water) return;
      for (const [uniform, color] of [['uDeep', this.palette.water], ['uLight', this.palette.waterLight], ['uFoam', this.palette.foam]] as const) {
        const value: unknown = water.uniforms[uniform]?.value;
        if (!(value instanceof THREE.Color)) throw new Error(`The water appearance is missing ${uniform}.`);
        value.set(color);
      }
    });
    this.hemisphere.color.set(dark ? '#bfd9ed' : '#fff7e6');
    this.hemisphere.groundColor.set(dark ? '#57766c' : '#456d5b');
    this.hemisphere.intensity = dark ? 1.65 : 1.45;
    this.sun.color.set(dark ? '#c4daff' : '#fff2d6');
    this.sun.intensity = dark ? 1.55 : 2.65;
    this.renderer.toneMappingExposure = dark ? 1.08 : 1;
    this.seaColor.set(this.palette.sea);
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
    this.shadowsDirty = true;
    const center = (this.size - 1) / 2;
    this.travelerWalking = frame.walking;
    const cell = { row: Math.round(frame.position.row), col: Math.round(frame.position.col) };
    const tile = tileAt(this.board, cell);
    const arch = tile === 'h' ? Math.cos((frame.position.col - cell.col) * Math.PI) :
      tile === 'v' ? Math.cos((frame.position.row - cell.row) * Math.PI) : 0;
    this.traveler.position.set(frame.position.col - center, 0.37 + arch * 0.065, frame.position.row - center + 0.14);
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
    if (this.postcard && celebration.complete) {
      this.postcardStarted = this.visualTime;
      this.postcardSettled = false;
      this.postcardHomes.forEach(({ garden, resident }) => {
        garden.visible = true;
        if (resident) resident.visible = this.communityCount === null || this.communityCount === 0;
      });
      this.tiles.forEach((tile, index) => {
        if (tile.sprout) tile.sprout.visible = postcardGarden(this.board, { row: Math.floor(index / this.size), col: index % this.size });
      });
      this.refreshBatchSlots();
      this.updatePostcard();
    }
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
    if (this.postcard) {
      this.postcardStarted = null;
      this.postcardSettled = false;
      this.postcardHomes.forEach(({ door, garden, resident, arm }) => {
        door.rotation.y = 0; garden.visible = false; garden.scale.y = 0.001;
        if (resident) resident.visible = false;
        if (arm) arm.rotation.z = 0;
      });
      this.tiles.forEach(({ sprout }) => { if (sprout) { sprout.visible = false; sprout.scale.setScalar(0.001); } });
      this.refreshBatchSlots();
      this.canvas.dataset['postcard'] = 'puzzle';
      this.updateCommunityCrowd(0);
      this.shadowsDirty = true;
    }
    this.dirty = true;
  }

  private updatePostcard(): boolean {
    if (this.postcardStarted === null || this.postcardSettled) return false;
    const elapsed = this.visualTime - this.postcardStarted;
    this.postcardHomes.forEach(({ door, garden, resident, arm, phase }) => {
      const progress = this.reduced ? 1 : villageProgress(elapsed, phase);
      door.rotation.y = progress * 1.18;
      garden.scale.y = Math.max(0.001, progress);
      if (resident) resident.position.set(-0.20 * progress, 0.27, 0.12 + progress * 0.24);
      if (arm) arm.rotation.z = progress * 2 + (!this.reduced && elapsed < 2500 ? Math.sin(elapsed / 110 + phase) * 0.16 * progress : 0);
    });
    const grown: TileObject[] = [];
    for (const tile of this.tiles) {
      if (!tile.sprout?.visible) continue;
      const progress = this.reduced ? 1 : villageProgress(elapsed, tile.origin % 6);
      const scale = Math.max(0.001, progress);
      if (Math.abs(tile.sprout.scale.x - scale) < 0.00001) continue;
      tile.sprout.scale.setScalar(scale);
      grown.push(tile);
    }
    if (grown.length) this.syncTerrainBatches(grown);
    this.updateCommunityCrowd(elapsed);
    this.postcardSettled = this.reduced || elapsed >= 2500;
    this.canvas.dataset['postcard'] = this.reduced || elapsed >= 1200 ? 'alive' : 'opening';
    this.shadowsDirty = true;
    this.dirty = true;
    return !this.postcardSettled;
  }

  setCommunityCount(count: number | null): void {
    if (!this.postcard) return;
    communityCrowd([], count);
    this.communityCount = count;
    this.canvas.dataset['communityCount'] = count === null ? 'unknown' : String(count);
    if (this.postcardStarted !== null) {
      this.postcardHomes.forEach(({ resident }) => { if (resident) resident.visible = count === null || count === 0; });
      this.updateCommunityCrowd(this.visualTime - this.postcardStarted);
    }
    this.shadowsDirty = true;
    this.dirty = true;
  }

  private updateCommunityCrowd(elapsed: number): void {
    const bodies = this.communityBodies, arms = this.communityArms;
    if (!bodies || !arms) return;
    const people = this.postcardStarted === null ? [] : communityCrowd([...this.postcardHomes.keys()], this.communityCount);
    const center = (this.size - 1) / 2;
    bodies.count = people.length; arms.count = people.length;
    bodies.visible = people.length > 0; arms.visible = people.length > 0;
    people.forEach((person, index) => {
      const cell = locate(this.board, person.anchor);
      if (!cell) throw new Error('The community illustration references a missing home.');
      const progress = this.reduced ? 1 : villageProgress(elapsed, person.phase);
      this.crowdBodyPose.position.set(cell.col - center + person.side * 0.30 * progress, 0.27, cell.row - center - 0.05 + progress * 0.26);
      this.crowdBodyPose.updateMatrix();
      bodies.setMatrixAt(index, this.crowdBodyPose.matrix);
      this.crowdArmPose.position.set(0.061, 0.186, 0.01);
      this.crowdArmPose.rotation.z = progress * 2 + (!this.reduced && elapsed < 2500 ? Math.sin(elapsed / 110 + person.phase) * 0.16 * progress : 0);
      this.crowdArmPose.updateMatrix();
      this.batchMatrix.multiplyMatrices(this.crowdBodyPose.matrix, this.crowdArmPose.matrix);
      arms.setMatrixAt(index, this.batchMatrix);
    });
    bodies.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
  }

  private makeTraveler(): void {
    this.traveler.add(this.courierBody);
    this.mesh(this.track(new THREE.CapsuleGeometry(0.073, 0.10, 4, 9)), '#285e65', new THREE.Vector3(0, 0.13, 0), this.courierBody);
    const head = this.mesh(this.track(new THREE.SphereGeometry(0.069, 12, 9)), '#e7bb94', new THREE.Vector3(0, 0.28, 0), this.courierBody);
    head.scale.set(0.96, 1.08, 0.96);
    const eye = this.track(new THREE.SphereGeometry(0.008, 6, 5));
    const glint = this.track(new THREE.SphereGeometry(0.003, 5, 4));
    for (const x of [-0.024, 0.024]) {
      this.mesh(eye, '#243d42', new THREE.Vector3(x, 0.287, 0.061), this.courierBody);
      this.mesh(glint, '#fff3d4', new THREE.Vector3(x - 0.002, 0.290, 0.068), this.courierBody);
    }
    this.mesh(this.track(new THREE.SphereGeometry(0.013, 7, 5)), '#dca67e', new THREE.Vector3(0, 0.273, 0.071), this.courierBody);
    const smile = this.mesh(this.track(new THREE.TorusGeometry(0.016, 0.003, 3, 8, Math.PI)), '#8b5845',
      new THREE.Vector3(0, 0.257, 0.063), this.courierBody);
    smile.rotation.z = Math.PI;
    this.mesh(this.track(new THREE.CylinderGeometry(0.109, 0.113, 0.022, 16)), '#e6bd70', new THREE.Vector3(0, 0.332, 0), this.courierBody);
    this.mesh(this.track(new THREE.CylinderGeometry(0.068, 0.078, 0.062, 12)), '#d5a24e', new THREE.Vector3(0, 0.365, 0), this.courierBody);
    this.mesh(this.track(new THREE.CylinderGeometry(0.076, 0.080, 0.017, 12)), '#705136', new THREE.Vector3(0, 0.343, 0), this.courierBody);
    const scarf = this.mesh(this.track(new THREE.TorusGeometry(0.054, 0.012, 5, 12)), '#c97840',
      new THREE.Vector3(0, 0.226, 0), this.courierBody);
    scarf.rotation.x = Math.PI / 2;
    const scarfEnd = this.mesh(this.track(new THREE.BoxGeometry(0.025, 0.065, 0.012)), '#df9953',
      new THREE.Vector3(-0.029, 0.192, 0.070), this.courierBody);
    scarfEnd.rotation.z = -0.16;
    const strap = this.mesh(this.track(new THREE.CylinderGeometry(0.006, 0.006, 0.19, 5)), '#dab173',
      new THREE.Vector3(0.008, 0.164, 0.069), this.courierBody);
    strap.rotation.z = 0.58;
    this.mesh(this.track(roundedPrism(0.10, 0.065, 0.085, 0.018)), '#a96f3d', new THREE.Vector3(0.084, 0.085, 0.021), this.courierBody);
    this.mesh(this.track(roundedPrism(0.115, 0.073, 0.018, 0.018)), '#c58a4d', new THREE.Vector3(0.084, 0.17, 0.022), this.courierBody);
    this.mesh(this.track(new THREE.SphereGeometry(0.008, 5, 4)), '#f2ce80', new THREE.Vector3(0.084, 0.136, 0.058), this.courierBody);
    const arm = this.track(new THREE.CapsuleGeometry(0.019, 0.065, 2, 5));
    const hand = this.track(new THREE.SphereGeometry(0.018, 6, 4));
    for (const [group, x] of [[this.armLeft, -0.08], [this.armRight, 0.08]] as const) {
      group.position.set(x, 0.185, 0);
      this.mesh(arm, '#285e65', new THREE.Vector3(0, -0.036, 0), group);
      this.mesh(hand, '#e7bb94', new THREE.Vector3(0, -0.09, 0), group);
      this.courierBody.add(group);
    }
    const foot = this.track(new THREE.BoxGeometry(0.038, 0.068, 0.055));
    const boot = this.track(roundedPrism(0.044, 0.078, 0.027, 0.012));
    this.mesh(foot, '#334047', new THREE.Vector3(-0.035, 0.025, 0), this.footLeft);
    this.mesh(foot, '#334047', new THREE.Vector3(0.035, 0.025, 0), this.footRight);
    this.mesh(boot, '#644631', new THREE.Vector3(-0.035, -0.012, 0.012), this.footLeft);
    this.mesh(boot, '#644631', new THREE.Vector3(0.035, -0.012, 0.012), this.footRight);
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
      const key = JSON.stringify([axes, width, height, this.camera.left, this.camera.right, this.camera.top, this.camera.bottom]);
      if (key !== this.projectionKey) { this.projectionKey = key; this.callbacks.onProjection(axes); }
    }
  }

  guideBounds(cell: Cell, shape: Shape = { rows: 1, cols: 1 }): GuideBounds {
    const bounds = this.canvas.getBoundingClientRect();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const col of [cell.col, cell.col + shape.cols]) {
      for (const row of [cell.row, cell.row + shape.rows]) {
        const point = new THREE.Vector3(col - this.size / 2, 0.30, row - this.size / 2).project(this.camera);
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
    if (this.movement) { this.finishSwap(); return; }
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderHeight = height;
    const pixelRatio = Math.min(window.devicePixelRatio, 1.8, Math.sqrt(1_600_000 / (width * height)));
    if (this.renderer.getPixelRatio() !== pixelRatio) this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const headOn = width < 680 || aspect < 1.25;
    this.camera.position.set(headOn ? 0.2 : 7.4, headOn ? 13 : 12, headOn ? 7.5 : 10.5);
    this.camera.lookAt(0, 0.1, 0);
    this.camera.updateMatrixWorld();
    this.boardGroup.updateWorldMatrix(true, true);
    const extent = new THREE.Box3();
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    this.boardGroup.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      box.setFromObject(object);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        point.set(x, y, z).applyMatrix4(this.camera.matrixWorldInverse);
        extent.expandByPoint(point);
      }
    });
    if (extent.isEmpty()) extent.set(new THREE.Vector3(-4, -4, -1), new THREE.Vector3(4, 4, 1));
    const terrainExtent = extent.clone();
    const margin = Math.min(8, width / 8, height / 8);
    let vertical = 2 * Math.max(
      (extent.max.y - extent.min.y) / 2 * height / Math.max(1, height - margin * 2),
      (extent.max.x - extent.min.x) / 2 * width / Math.max(1, width - margin * 2) / aspect,
    );
    // Billboard labels keep a fixed pixel size as the camera fit changes.
    for (let pass = 0; pass < 8; pass++) {
      extent.copy(terrainExtent);
      const halfLabel = 14 * vertical / height;
      for (const sprite of this.landmarkSprites) {
        sprite.getWorldPosition(point).applyMatrix4(this.camera.matrixWorldInverse);
        extent.expandByPoint(new THREE.Vector3(point.x - halfLabel, point.y - halfLabel, point.z));
        extent.expandByPoint(new THREE.Vector3(point.x + halfLabel, point.y + halfLabel, point.z));
      }
      this.traveler.scale.setScalar(Math.min(3, COURIER_SCALE * Math.max(1, Math.min(2.4, 28 * vertical / height * 1.65))));
      const scale = this.traveler.scale.x;
      const center = (this.size - 1) / 2;
      for (let row = 0; row < this.size; row++) for (let col = 0; col < this.size; col++) {
        const tile = this.board[row]?.[col];
        if (!walkable(tile)) continue;
        const base = tile === 'h' || tile === 'v' ? 0.435 : 0.37;
        for (const x of [this.travelerEnvelope.min.x, this.travelerEnvelope.max.x])
          for (const y of [this.travelerEnvelope.min.y, this.travelerEnvelope.max.y])
            for (const z of [this.travelerEnvelope.min.z, this.travelerEnvelope.max.z]) {
              point.set(col - center + x * scale, base + y * scale, row - center + 0.14 + z * scale)
                .applyMatrix4(this.camera.matrixWorldInverse);
              extent.expandByPoint(point);
            }
      }
      this.traveler.updateWorldMatrix(true, true);
      box.setFromObject(this.traveler);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        point.set(x, y, z).applyMatrix4(this.camera.matrixWorldInverse);
        extent.expandByPoint(point);
      }
      const next = Math.max(
        (extent.max.y - extent.min.y) * height / Math.max(1, height - margin * 2),
        (extent.max.x - extent.min.x) * width / Math.max(1, width - margin * 2) / aspect,
      );
      if (Math.abs(next - vertical) < 0.00001) { vertical = next; break; }
      vertical = next;
    }
    const centerX = (extent.max.x + extent.min.x) / 2;
    const centerY = (extent.max.y + extent.min.y) / 2;
    this.camera.left = centerX - vertical * aspect / 2;
    this.camera.right = centerX + vertical * aspect / 2;
    this.camera.top = centerY + vertical / 2;
    this.camera.bottom = centerY - vertical / 2;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.labelScale = 28 * vertical / height;
    this.traveler.scale.setScalar(Math.min(3, COURIER_SCALE * Math.max(1, Math.min(2.4, this.labelScale * 1.65))));
    this.landmarkSprites.forEach((sprite) => sprite.scale.set(this.labelScale, this.labelScale, 1));
    this.frames.children.forEach((object) => {
      if (object instanceof THREE.Sprite) object.scale.set(this.labelScale * 0.92, this.labelScale * 0.92, 1);
    });
    this.updateFrameProjection(width, height);
    this.updatePickingMap();
    this.updatePickingBounds();
    this.shadowsDirty = true;
    this.dirty = true;
  }

  private fittedLift(object: Movement['objects'][number], desired: number): number {
    const up = this.renderHeight / (this.camera.top - this.camera.bottom) * (this.camera.matrixWorldInverse.elements[5] ?? 0);
    if (up <= 0) return desired;
    const bounds = object.tile.bounds;
    let top = Infinity;
    // Picking bounds stay at their pre-swap position until the patches land.
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      this.liftPoint.set(x, y, z).sub(object.from).applyQuaternion(object.group.quaternion)
        .add(object.group.position).project(this.camera);
      top = Math.min(top, (1 - this.liftPoint.y) * this.renderHeight / 2);
    }
    return Math.min(desired, Math.max(0, (top - 4) / up));
  }

  private pick(event: { clientX: number; clientY: number }): Cell | null {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.pickCandidates.length = 0;
    this.pickHits.length = 0;
    for (const tile of this.tiles) {
      if (this.raycaster.ray.intersectsBox(tile.bounds)) this.pickCandidates.push(tile.group);
    }
    this.raycaster.intersectObjects(this.pickCandidates, true, this.pickHits);
    for (const intersection of this.pickHits) {
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
    if (this.movement || this.paused) return;
    this.pendingPointer = { clientX: event.clientX, clientY: event.clientY };
    if (this.pickFrame) return;
    this.pickFrame = requestAnimationFrame(() => {
      this.pickFrame = 0;
      const pointer = this.pendingPointer;
      this.pendingPointer = null;
      if (!pointer || this.disposed || this.movement || this.paused) return;
      const cell = this.pick(pointer);
      const key = cell ? `${cell.row},${cell.col}` : null;
      if (key !== this.currentHover) {
        this.currentHover = key;
        this.canvas.style.cursor = cell ? 'pointer' : 'default';
        this.callbacks.onHover(cell);
      }
    });
  };

  private cancelHoverFrame(): void {
    cancelAnimationFrame(this.pickFrame);
    this.pickFrame = 0;
    this.pendingPointer = null;
  }

  private pointerLeave = (): void => {
    this.cancelHoverFrame();
    this.currentHover = null;
    this.canvas.style.cursor = 'default';
    this.callbacks.onHover(null);
  };

  private contextLost = (event: Event): void => {
    event.preventDefault();
    console.error('The living terrain WebGL context was lost.');
    this.callbacks.onError('The graphics context paused. Switching to the accessible flat map; your repair is safe.');
  };

  private pointerClick = (event: MouseEvent): void => {
    this.cancelHoverFrame();
    if (this.movement || this.paused) return;
    this.currentHover = null;
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
    const previousPoseMoving = this.footLeft.rotation.x !== 0 || this.armRight.rotation.z !== 0;
    const stride = this.travelerWalking && !this.reduced ? Math.sin(this.time.value * 18) * 0.38 : 0;
    this.footLeft.rotation.x = stride;
    this.footRight.rotation.x = -stride;
    this.armLeft.rotation.x = -stride * 0.8;
    this.armRight.rotation.x = stride * 0.8;
    this.armRight.rotation.z = !this.reduced && !this.travelerWalking && this.visualTime < this.greetingUntil
      ? -1.35 + Math.sin(this.time.value * 11) * 0.18 : 0;
    this.courierBody.position.y = Math.abs(stride) * 0.04;
    this.courierBody.rotation.z = stride * 0.06;
    if (previousPoseMoving || stride !== 0 || this.armRight.rotation.z !== 0) this.shadowsDirty = true;
    if (this.movement) {
      const progress = Math.min(1, (this.visualTime - this.movement.began) / 680);
      const eased = progress * progress * (3 - 2 * progress);
      if (this.postcard) {
        for (const parcel of this.movement.parcels) {
          const pose = parcelMotion(progress, parcel.side);
          const pivot = parcel.from.clone().lerp(parcel.to, pose.travel);
          for (const object of parcel.objects) {
            object.group.rotation.set(pose.tilt * 0.55, 0, pose.tilt);
            object.group.position.copy(object.from).sub(parcel.from).applyQuaternion(object.group.quaternion).add(pivot);
          }
          const lift = Math.min(...parcel.objects.map((object) => this.fittedLift(object, pose.lift)));
          for (const object of parcel.objects) object.group.position.y += lift;
        }
        const focus = this.movement.parcels[0]?.objects[0]?.group.position;
        if (focus) {
          const yaw = Math.atan2(focus.x - this.traveler.position.x, focus.z - this.traveler.position.z);
          const difference = Math.atan2(Math.sin(yaw - this.movement.courierYaw), Math.cos(yaw - this.movement.courierYaw));
          this.traveler.rotation.y = this.movement.courierYaw + difference * Math.sin(progress * Math.PI);
        }
      } else for (const object of this.movement.objects) {
        object.group.position.lerpVectors(object.from, object.to, eased);
        object.group.rotation.z = Math.sin(progress * Math.PI * 2) * 0.035 * object.side;
        object.group.position.y += this.fittedLift(object, Math.sin(Math.PI * progress) * (object.side === 1 ? 0.85 : 1.30));
      }
      this.syncTerrainBatches(this.movement.objects.map((object) => object.tile));
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
    const postcardMoving = this.updatePostcard();
    const activeMotion = this.movement || postcardMoving || this.travelerWalking || this.visualTime < this.greetingUntil || this.festivities.children.length > 0;
    if (this.dirty || activeMotion || (!this.reduced && now - this.lastRender >= 1000 / 30 - 0.5)) {
      if (this.shadowsDirty || this.movement) {
        this.renderer.shadowMap.needsUpdate = true;
      }
      this.renderer.render(this.scene, this.camera);
      this.lastRender = now;
      this.dirty = false;
      this.shadowsDirty = false;
    }
  };

  private clearBoard(): void {
    this.terrainBatches.traverse((object) => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.terrainBatches.clear();
    this.batchBindings = [];
    this.pickCandidates.length = 0;
    this.pickHits.length = 0;
    this.boardGroup.traverse((object) => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.boardGroup.clear();
    this.landmarkSprites = [];
    this.houseWindows.clear();
    this.postcardHomes.clear();
    this.postcardFlowerGeometries = [];
    this.postcardStarted = null;
    this.postcardSettled = false;
    this.communityCount = null;
    if (this.communityBodies && this.communityArms) {
      this.communityBodies.count = 0; this.communityBodies.visible = false;
      this.communityArms.count = 0; this.communityArms.visible = false;
    }
    this.canvas.dataset['postcard'] = this.postcard ? 'puzzle' : 'off';
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
    this.cancelHoverFrame();
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.resetTickTime);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    this.canvas.removeEventListener('click', this.pointerClick);
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.clearBoard();
    this.communityBodies?.dispose();
    this.communityArms?.dispose();
    this.setRoutes([]);
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.extraMaterials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
    this.canvas.remove();
  }
}
