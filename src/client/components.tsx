import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import type { FrameAxes, GuideTopic, Shape, Theme, Tile } from '../shared/types.ts';
import { isAnchor } from '../shared/rules.ts';

type IconName = 'sound' | 'mute' | 'undo' | 'reset' | 'book' | 'help' | 'close' | 'arrow' | 'sun' | 'moon' | 'leaf' | 'trophy' | 'map' | 'swap' | 'check' | 'chevron' | 'lock' | 'clock' | 'warning' | 'bridge' | 'play' | 'grid' | 'trash' | 'cube';

const paths: Record<IconName, ReactNode> = {
  sound: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  mute: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/></>,
  undo: <><path d="m9 5-5 5 5 5"/><path d="M4 10h10a6 6 0 0 1 0 12"/></>,
  reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></>,
  book: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v15"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1 .7-1.7 1.2-1.7 2.7M12 17h.01"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
  moon: <path d="M20 15.4A9 9 0 0 1 8.6 4a9 9 0 1 0 11.4 11.4Z"/>,
  leaf: <><path d="M20 3C10 2 3 6 4 13c1 7 11 8 14 1 2-4 2-7 2-11Z"/><path d="M4 21c1-8 7-11 12-14"/></>,
  trophy: <><path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-5 2h10"/></>,
  map: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16m6-14v16"/></>,
  swap: <><path d="M3 8h16l-4-4m6 12H5l4 4"/></>,
  check: <path d="m5 12 4 4L20 5"/>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  warning: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v1"/></>,
  bridge: <><path d="M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4"/></>,
  play: <path d="m8 4 12 8-12 8V4Z"/>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
  cube: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5m-9 5v9"/></>,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function BrandMark() {
  return <svg width="35" height="35" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="m5 14 12-7 12 7-12 7L5 14Z" fill="#9eaf7d" stroke="#456b58" strokeWidth="1.3"/>
    <path d="M5 14v8l12 7 12-7v-8l-12 7L5 14Z" fill="#d4c7a6" stroke="#456b58" strokeWidth="1.3"/>
    <path d="m20 23 8-5 8 5-8 5-8-5Z" fill="#b5d7cf" stroke="#456b58" strokeWidth="1.3"/>
    <path d="M20 23v6l8 5 8-5v-6l-8 5-8-5Z" fill="#ddcfad" stroke="#456b58" strokeWidth="1.3"/>
    <path d="m12 13 5 3 5-3" stroke="#fdf9e8" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

export function GuideCourier({ portrait = false }: { portrait?: boolean }) {
  return <svg className={`guide-courier ${portrait ? 'courier-portrait' : ''}`} width="64" height="84"
    viewBox={portrait ? '12 5 50 45' : '0 0 76 100'} fill="none" aria-hidden="true">
    <ellipse cx="36" cy="94" rx="25" ry="4" fill="#172f2529"/>
    <path d="m25 74-3 16h12l3-14m5-2 2 16h12l-6-17" fill="#344c42" stroke="#283f35" strokeWidth="2"/>
    <path d="M20 88h15v6H18q-2-4 2-6Zm24 0h12q4 2 4 6H44v-6Z" fill="#493f32"/>
    <path d="M20 58q15-12 30 0l6 23H17l3-23Z" fill="#648a62" stroke="#355c44" strokeWidth="2"/>
    <path d="m22 57 25 22" stroke="#d4ae6d" strokeWidth="5"/>
    <rect x="39" y="69" width="18" height="16" rx="4" fill="#ba925a" stroke="#795b35" strokeWidth="2"/>
    <path d="M24 59 12 74l7 6 13-16" fill="#648a62" stroke="#355c44" strokeWidth="2"/>
    <circle cx="15" cy="78" r="5" fill="#ecc79d" stroke="#b48b64"/>
    <g className="guide-point">
      <path d="m47 59 13 9 4 11" stroke="#355c44" strokeWidth="12" strokeLinecap="round"/>
      <path d="m47 59 13 9 4 11" stroke="#648a62" strokeWidth="8" strokeLinecap="round"/>
      <path d="M60 77q-1-5 3-5 3 0 3 5l3 7q1 4-2 5l-5-6q-4 0-5-3-1-3 3-3Z" fill="#ecc79d" stroke="#b48b64" strokeWidth="1.5" strokeLinejoin="round"/>
    </g>
    <path d="M25 42h24v13q-12 10-24 0V42Z" fill="#dfb58c"/>
    <ellipse cx="37" cy="32" rx="19" ry="22" fill="#edcba3" stroke="#b28b62" strokeWidth="1.5"/>
    <path d="M18 29q-3-24 20-23 21 1 19 25l-6-10-30 3-3 5Z" fill="#796043"/>
    <path d="M16 23q0-19 20-19 20 0 20 19H16Z" fill="#d5ae60" stroke="#98743a" strokeWidth="1.5"/>
    <path d="M11 23q24-9 49 0-22 8-49 2v-2Z" fill="#e1c47c" stroke="#98743a" strokeWidth="1.5"/>
    <path d="m26 32 4-1m14 0 4 1" stroke="#795b3e" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="29" cy="36" r="2" fill="#304b3d"/><circle cx="45" cy="36" r="2" fill="#304b3d"/>
    <path d="M33 44q4 4 8 0" stroke="#9e684c" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="24" cy="42" r="3" fill="#e4ab83" fillOpacity=".65"/><circle cx="50" cy="42" r="3" fill="#e4ab83" fillOpacity=".65"/>
  </svg>;
}

export function LandscapeIllustration({ theme = 'meadow' }: { theme?: Theme }) {
  const orchard = theme === 'orchard';
  const coast = theme === 'coast';
  return <svg className="landscape-illustration" width="180" height="112" viewBox="0 0 180 112" fill="none" aria-hidden="true">
    <path d="M12 80C-2 34 31 9 84 14c35-21 92-4 85 39 20 38-21 55-69 45-45 16-84 6-88-18Z"
      fill={coast ? '#dcece4' : orchard ? '#f0ebce' : '#e5ecd6'}/>
    <circle cx="142" cy="24" r="13" fill="#edcf86"/>
    <path d="M15 75q30-48 65-19c25-41 62-27 89 2v32H15V75Z" fill={coast ? '#b5c9b3' : '#c1d19e'}/>
    <path d="M12 85q48-39 90-14c25-21 50-16 67-6v27H12v-7Z" fill={orchard ? '#b4c38d' : '#a9c29a'}/>
    {coast && <><path d="M16 84q48-13 68 3t81-1v11H17L16 84Z" fill="#92c4c0"/>
      <path d="M30 90h24m53 3h23m12-6h14" stroke="#e0f0df" strokeWidth="2" strokeLinecap="round"/></>}
    <path d="M38 85h29q21 0 21-21t23-21h22" stroke="#fdf2d5" strokeWidth="12" strokeLinecap="round"/>
    <path d="M38 85h29q21 0 21-21t23-21h22" stroke="#bea97d" strokeWidth="1.5" strokeDasharray="3 5"/>
    <path d="M25 86V66h25v20H25Z" fill="#fff6de" stroke="#a49d7d"/>
    <path d="m20 67 18-16 17 16H20Z" fill="#628b73"/>
    <path d="M33 86V75h7v11" fill="#9c7d52"/>
    <rect x="43" y="70" width="4" height="5" rx="1" fill="#e1ba67"/>
    <path d="M121 45V29h22v16h-22Z" fill="#fff6de" stroke="#a49d7d"/>
    <path d="m117 30 15-14 16 14h-31Z" fill="#bb8669"/>
    <path d="M129 45V35h6v10" fill="#9c7d52"/>
    <path d="M155 71V51M17 49V33" stroke="#9c895e" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="155" cy="48" r="11" fill="#7fa178"/><circle cx="151" cy="39" r="9" fill="#9ab780"/>
    <circle cx="17" cy="28" r="10" fill="#95b283"/>
    {orchard && <><circle cx="151" cy="47" r="2" fill="#cc8c5c"/><circle cx="159" cy="43" r="2" fill="#cc8c5c"/></>}
    <path d="m100 76 8-3 5 5-10 4-3-6Z" fill="#d5aa59"/><path d="M103 81v7h7v-8" fill="#4a7562"/>
    <circle cx="107" cy="75" r="3" fill="#e8c69d"/>
    <path d="M57 37h15m-4-10h18" stroke="#fbf8e9" strokeWidth="4" strokeLinecap="round"/>
    <path d="m57 98 3-5m6 5 2-4m63 2 3-4" stroke="#839d68" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

export function CompletionSeal({ perfect }: { perfect: boolean }) {
  return <svg className="completion-seal" width="64" height="64" viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <path d="m20 56-3 22 14-6 9 5 2-19m18-3 3 23-14-6-9 5-2-19" fill={perfect ? '#cba762' : '#94b28b'} stroke="#fff8e7" strokeWidth="2"/>
    <circle cx="40" cy="36" r="32" fill={perfect ? '#f6e6b9' : '#e4ecd7'} stroke={perfect ? '#b28a3e' : '#789b72'} strokeWidth="2"/>
    <circle cx="40" cy="36" r="26" stroke="#fffaf0" strokeWidth="2" strokeDasharray="3 4"/>
    <path d="M19 45h12q8 0 8-9t9-9h13" stroke="#fff8e9" strokeWidth="7" strokeLinecap="round"/>
    <path d="M19 45h12q8 0 8-9t9-9h13" stroke={perfect ? '#aa8541' : '#6f9164'} strokeWidth="2" strokeLinecap="round"/>
    <path d="M14 47V36h12v11H14Zm40-18V18h12v11H54Z" fill="#fff5da"/>
    <path d="m11 37 9-8 9 8H11Zm40-18 9-8 9 8H51Z" fill="#4f785d"/>
    <path d="m29 22 6 6 11-12" stroke="#3d674d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

function TileGlyph({ tile }: { tile: Tile }) {
  const bridge = tile === 'h' || tile === 'v';
  return <svg className="tile-guide-glyph" width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="6"
      fill={tile === '~' || bridge ? '#8fc2bf' : tile === 'x' ? '#b2b7a0' : '#a9bd86'} stroke="#819578"/>
    {tile === 'o' && <><path d="M16 1v30M1 16h30" stroke="#e8dfca" strokeWidth="10"/>
      <rect x="6" y="6" width="20" height="20" rx="4" fill="#f1e8d4" stroke="#c8bba0"/>
      <path d="M10 13h5m2 6h5" stroke="#d7ceb9" strokeWidth="2"/></>}
    {tile === '~' && <path d="M5 11q4-4 8 0t8 0m-12 9q4-4 8 0t8 0" stroke="#d4ece1" strokeWidth="2" strokeLinecap="round"/>}
    {tile === '.' && <path d="m7 22 2-6m4 7 2-8m5 8 2-6" stroke="#718a56" strokeWidth="2" strokeLinecap="round"/>}
    {tile === 'x' && <><path d="m9 6 14 1 5 9-5 10-13 1-6-9L9 6Z" fill="#8a9b89" stroke="#526c5c"/>
      <path d="m9 6 7 11 7-10m-7 10 7 9m-7-9-12 1" stroke="#aab5a0" strokeWidth="2"/></>}
    {bridge && <g transform={tile === 'v' ? 'rotate(90 16 16)' : undefined}>
      <rect x="1" y="8" width="30" height="16" rx="2" fill="#dec493" stroke="#997a4f" strokeWidth="2"/>
      <path d="M8 9v14m8-14v14m8-14v14" stroke="#b79865"/>
      <g transform="translate(4 4)" stroke="#5b573f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths.bridge}</g>
    </g>}
    {isAnchor(tile) && <><rect x="8" y="13" width="16" height="14" rx="1" fill="#fff2db" stroke="#a99a7b"/>
      <path d="m6 14 10-9 10 9H6Z" fill="#698775"/><rect x="14" y="20" width="4" height="7" fill="#9c8259"/></>}
  </svg>;
}

export function TileGuide({ only }: { only?: readonly GuideTopic[] }) {
  const entries: { tiles: Tile[]; name: string; label: string; description: string }[] = [
    { tiles: ['o'], name: 'Paving', label: 'Moves', description: 'Walkable stone road. Connects on all four sides.' },
    { tiles: ['.', '~'], name: 'Grass & water', label: 'Moves', description: 'Not walkable. Exchange them to place road here.' },
    { tiles: ['x', 'A'], name: 'Boulders & homes', label: 'Fixed', description: 'Cannot move. Neither selected patch may include them.' },
    { tiles: ['h', 'v'], name: 'Wooden bridges', label: 'Straight only', description: 'Move with the patch. Cross along the arrows; bridges do not rotate.' },
  ];
  return <section className="tile-guide" aria-label="Tile rules">
    <h3>Read the landscape.</h3>
    <div className="tile-guide-grid">{entries.filter((entry) => !only ||
      (only.includes('rocks') && entry.tiles.includes('x')) ||
      (only.includes('bridges') && entry.tiles.includes('h'))).map((entry) => <div className="tile-guide-item" key={entry.name}>
      <div className="tile-guide-pictures">{entry.tiles.map((tile) => <TileGlyph key={tile} tile={tile}/>)}</div>
      <div><h4>{entry.name}<span className={`tile-guide-tag ${entry.label === 'Fixed' ? 'fixed-tag' : ''}`}>{entry.label}</span></h4>
        <p>{entry.description}</p></div>
    </div>)}</div>
  </section>;
}

export function WalkthroughFeatures({ section }: { section: 'tools' | 'places' }) {
  const entries: { icon: IconName; title: string; text: string }[] = section === 'tools' ? [
    { icon: 'undo', title: 'One tap back', text: 'Reverse the last exchange. Fix a mistaken tap.' },
    { icon: 'sound', title: 'A little sound', text: 'Tap the speaker to listen or mute. Sound is optional.' },
    { icon: 'cube', title: 'Your point of view', text: 'Switch 3D / Flat. Use the top sun or moon to choose light or dark.' },
    { icon: 'swap', title: 'Choose a frame', text: 'Picture buttons choose a tall or wide patch. Tiles do not rotate.' },
  ] : [
    { icon: 'sun', title: 'One daily island', text: 'One shared UTC puzzle. Its countdown starts after this practice.' },
    { icon: 'trophy', title: 'Earn your comparison', text: 'Shown after a saved finish. Fewest moves, then fastest time.' },
    { icon: 'map', title: 'Practice: 200 places', text: 'Preview, then play. Finish one unranked stop to open the next.' },
    { icon: 'help', title: 'A guide nearby', text: 'Tap the top question mark to replay this walkthrough or read every tile rule.' },
  ];
  return <div className="tour-feature-grid">{entries.map((entry) =>
    <div className="tour-feature" key={entry.title}><span className="state-emblem"><Icon name={entry.icon} size={23}/></span>
      <div><h3>{entry.title}</h3><p>{entry.text}</p></div></div>)}</div>;
}

export const FLAT_AXES: FrameAxes = { col: { x: 1, y: 0 }, row: { x: 0, y: 1 } };

export function ShapeGlyph({ shape, axes = FLAT_AXES, tiles }: { shape: Shape; axes?: FrameAxes; tiles?: Tile[] }) {
  const scale = tiles ? 25 : 16;
  const point = (row: number, col: number) => ({
    x: (col * axes.col.x + row * axes.row.x) * scale,
    y: (col * axes.col.y + row * axes.row.y) * scale,
  });
  const corners = [point(0, 0), point(0, shape.cols), point(shape.rows, 0), point(shape.rows, shape.cols)];
  const left = Math.min(...corners.map((corner) => corner.x)) - 3;
  const top = Math.min(...corners.map((corner) => corner.y)) - 3;
  const width = Math.max(...corners.map((corner) => corner.x)) - left + 3;
  const height = Math.max(...corners.map((corner) => corner.y)) - top + 3;
  return <svg className={`shape-glyph ${tiles ? 'terrain-glyph' : ''}`} width={width} height={height}
    viewBox={`${left} ${top} ${width} ${height}`} fill="none" aria-hidden="true">
    {Array.from({ length: shape.rows * shape.cols }, (_, index) => {
      const row = Math.floor(index / shape.cols);
      const col = index % shape.cols;
      const polygon = [point(row + 0.06, col + 0.06), point(row + 0.06, col + 0.94),
        point(row + 0.94, col + 0.94), point(row + 0.94, col + 0.06)]
        .map((corner) => `${corner.x},${corner.y}`).join(' ');
      const tile = tiles?.[index];
      return <polygon key={index} points={polygon}
        fill={tile === '~' ? '#85c5cd' : tile === 'o' ? '#f1e5c7' : tiles ? '#adc58a' : 'currentColor'}
        fillOpacity={tiles ? 1 : 0.18} stroke={tiles ? '#6d7f65' : 'currentColor'} strokeWidth={1.4} strokeLinejoin="round"/>;
    })}
  </svg>;
}

type DialogKind = 'guide' | 'map' | 'erase';
const dialogIdentity: Record<DialogKind, { icon: IconName; label: string }> = {
  guide: { icon: 'book', label: 'FIELD GUIDE' },
  map: { icon: 'map', label: 'PRACTICE PLACES' },
  erase: { icon: 'lock', label: 'YOUR DATA' },
};

export function Modal({ title, children, onClose, wide = false, className = '', kind = 'guide', emblem }: {
  title: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string; kind?: DialogKind; emblem?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  useEffect(() => { ref.current?.scrollTo(0, 0); }, [title]);
  const identity = dialogIdentity[kind];
  return <dialog ref={ref} className={`dialog dialog-${kind} ${wide ? 'dialog-wide' : ''} ${className}`} aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-heading">
      <span className="dialog-emblem">{emblem ?? <Icon name={identity.icon} size={25}/>}</span>
      <div className="dialog-title"><p className="eyebrow">{identity.label}</p><h2 id={id}>{title}</h2></div>
      <button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close"/></button>
    </div>
    {children}
  </dialog>;
}

export function GuideIllustration({ step }: { step: number }) {
  return <svg className="guide-picture" viewBox="0 0 150 100" fill="none" aria-hidden="true">
    <rect x="19" y="18" width="112" height="66" rx="10" fill="#e4e6d3"/>
    {Array.from({ length: 6 }, (_, index) => <rect key={index} x={27 + index % 3 * 34} y={26 + Math.floor(index / 3) * 26} width="28" height="22" rx="5" fill={index === 2 ? '#a4d3d5' : '#faf5e8'} stroke="#cfccb8"/>)}
    {step === 1 && <><rect x="23" y="22" width="66" height="30" rx="7" stroke="#c58f4a" strokeWidth="3"/><path d="M45 37h12" stroke="#adab94" strokeWidth="3"/></>}
    {step === 2 && <><path d="M41 38h64m-8-7 8 7-8 7" stroke="#789b88" strokeWidth="3"/><rect x="57" y="49" width="67" height="28" rx="7" stroke="#789b88" strokeDasharray="5 4" strokeWidth="2"/></>}
    {step === 3 && <><path d="M38 37h34v26h34" stroke="#6b9875" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      {[{ x: 38, y: 37, label: 'A' }, { x: 72, y: 63, label: 'B' }, { x: 106, y: 63, label: 'C' }].map((stop) =>
        <g key={stop.label}><circle cx={stop.x} cy={stop.y} r="10" fill="#fff6de" stroke="#7d9872"/>
          <text x={stop.x} y={stop.y + 4} textAnchor="middle" fill="#446c50" fontSize="11" fontFamily="sans-serif" fontWeight="bold">{stop.label}</text></g>)}</>}
  </svg>;
}
