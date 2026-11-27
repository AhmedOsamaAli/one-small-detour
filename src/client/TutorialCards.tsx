import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Board, Cell, Shape, Tile } from '../shared/types.ts';
import { canTraverse, checkPuzzle, isAnchor, patchCells, patchOutline, tileAt } from '../shared/rules.ts';
import { TUTORIAL, TUTORIAL_ROUTE_EXAMPLES } from '../shared/tutorial.ts';
import type { TutorialRouteExample } from '../shared/tutorial.ts';
import { FLAT_AXES, Icon, Modal, TileGlyph } from './components.tsx';
import { frameArrowPath } from './frameArrow.ts';
import './tutorialCards.css';

const cards = [
  { id: 'order', title: 'Home order.' },
  { id: 'once', title: 'No road twice.' },
  { id: 'terrain', title: 'Move or stay.' },
  { id: 'horizontal', title: 'Horizontal bridge.' },
  { id: 'vertical', title: 'Vertical bridge.' },
  { id: 'starts', title: 'Start here.' },
] as const;

function RouteExample({ example }: { example: TutorialRouteExample }) {
  const solved = checkPuzzle(example.board, TUTORIAL).solved;
  const top = Math.min(...example.route.map(cell => cell.row));
  const left = Math.min(...example.route.map(cell => cell.col));
  const rows = Math.max(...example.route.map(cell => cell.row)) - top + 1;
  const cols = Math.max(...example.route.map(cell => cell.col)) - left + 1;
  const position = (cell: Cell) => ({ x: 6 + (cell.col - left) * 44, y: 6 + (cell.row - top) * 44 });
  const squares = Array.from({ length: rows * cols }, (_, index) => {
    const cell = { row: top + Math.floor(index / cols), col: left + index % cols };
    return { cell, ...position(cell), tile: tileAt(example.board, cell),
      visits: example.route.filter(item => item.row === cell.row && item.col === cell.col).length };
  });
  const points = example.route.map(cell => {
    const point = position(cell);
    return { x: point.x + 20, y: point.y + 20 };
  });
  return <figure className={`rule-route-example ${solved ? 'rule-connected' : 'rule-blocked'}`}
    data-route-example={example.id} data-route-valid={solved}
    aria-label={`${solved ? 'Correct' : 'Not allowed'}: ${example.caption}`}>
    <svg className="rule-route-picture" viewBox={`0 0 ${cols * 44 + 8} ${rows * 44 + 8}`} aria-hidden="true">
      {squares.map(({ cell, x, y, tile, visits }) => <g key={`${cell.row}:${cell.col}`}
        transform={`translate(${x} ${y})`} data-route-visits={visits}>
        <TileGlyph tile={isAnchor(tile) ? '.' : tile}/>
      </g>)}
      <polyline className="rule-route-trail" points={points.map(point => `${point.x},${point.y}`).join(' ')}/>
      {points.slice(1).map((point, index) => {
        const from = points[index]!;
        const angle = Math.atan2(point.y - from.y, point.x - from.x) * 180 / Math.PI;
        return <path key={index} className="rule-route-trail" d="m-4-4 4 4-4 4"
          transform={`translate(${(point.x + from.x) / 2} ${(point.y + from.y) / 2}) rotate(${angle})`}/>;
      })}
      {squares.filter(square => isAnchor(square.tile)).map(({ cell, x, y, tile }) =>
        <g key={`${cell.row}:${cell.col}`} transform={`translate(${x} ${y})`}>
          <TileGlyph tile={tile}/><rect className="rule-route-home-plaque" x="10" y="17" width="20" height="20" rx="3"/>
          <text className="rule-route-home-label" x="20" y="28">{tile}</text>
        </g>)}
      {squares.filter(square => square.visits > 1).map(({ cell, x, y, visits }) =>
        <g key={`${cell.row}:${cell.col}`} data-route-repeat={visits}>
          <rect className="rule-route-repeat" x={x - 1} y={y - 1} width="42" height="42" rx="7"/>
          <circle className="rule-route-repeat-badge" cx={x + 31} cy={y + 31} r="10"/>
          <text className="rule-route-repeat-label" x={x + 31} y={y + 31}>{visits}x</text>
        </g>)}
    </svg>
    <figcaption><Icon name={solved ? 'check' : 'close'} size={18}/>{example.caption}</figcaption>
  </figure>;
}

function RouteCards({ rule }: { rule: 'order' | 'once' }) {
  return <div className={`rule-route-content rule-route-${rule}`}>
    <p className="rule-route-lead">{rule === 'order' ? 'Example order: A, then B, then C.' :
      'Never step on the same road square again.'}</p>
    <div className="rule-route-comparison">
      {TUTORIAL_ROUTE_EXAMPLES[rule].map(example => <RouteExample key={example.id} example={example}/>)}
    </div>
    <p className="rule-card-note">{rule === 'order' ? 'Follow the order shown above your board.' :
      'Back over that square means two visits.'}</p>
  </div>;
}

function TerrainCards() {
  const groups: { label: string; fixed: boolean; tiles: { tile: Tile; name: string }[] }[] = [
    { label: 'MOVES', fixed: false, tiles: [
      { tile: 'o', name: 'Road' }, { tile: '.', name: 'Grass + trees' },
      { tile: '~', name: 'Water' }, { tile: 'h', name: 'Bridge' },
    ] },
    { label: 'STAYS', fixed: true, tiles: [{ tile: 'A', name: 'Home' }, { tile: 'x', name: 'Boulder' }] },
  ];
  return <div className="rule-terrain-groups">
    {groups.map(group => <section className={`rule-terrain-group ${group.fixed ? 'rule-fixed' : ''}`} key={group.label}>
      <h3><Icon name={group.fixed ? 'lock' : 'swap'} size={21}/>{group.label}</h3>
      <div className="rule-terrain-tiles">{group.tiles.map(({ tile, name }) =>
        <figure key={tile}><TileGlyph tile={tile} trees={tile === '.'}/><figcaption>{name}</figcaption></figure>)}</div>
    </section>)}
  </div>;
}

function HomeConnections() {
  const board = ['.v.', 'hAh', '.v.'];
  const home = { row: 1, col: 1 };
  const ports: { name: string; cell: Cell; path: string }[] = [
    { name: 'top', cell: { row: 0, col: 1 }, path: 'M48 6v19m-5-6 5 6 5-6m-10-7 5-6 5 6' },
    { name: 'right', cell: { row: 1, col: 2 }, path: 'M71 48h19m-6-5 6 5-6 5m-7-10-6 5 6 5' },
    { name: 'bottom', cell: { row: 2, col: 1 }, path: 'M48 71v19m-5-6 5 6 5-6m-10-7 5-6 5 6' },
    { name: 'left', cell: { row: 1, col: 0 }, path: 'M6 48h19m-6-5 6 5-6 5m-7-10-6 5 6 5' },
  ];
  return <div className="rule-home-connections">
    <svg className="rule-home-picture" viewBox="0 0 96 96" aria-hidden="true">
      <g transform="translate(28 28)"><TileGlyph tile="A"/></g>
      {ports.map(({ name, cell, path }) => {
        const connected = canTraverse(board, home, cell) && canTraverse(board, cell, home);
        return <path key={name} d={path} data-home-port={name} data-home-connected={connected}
          className={connected ? 'rule-link-good' : 'rule-link-bad'} fill="none" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"/>;
      })}
    </svg>
    <div><strong>Home: any side.</strong><span>Roads or bridge ends.</span></div>
  </div>;
}

function BridgeExample({ board }: { board: Board }) {
  const vertical = board.length > 1;
  const positions = [{ row: 0, col: 0 }, vertical ? { row: 1, col: 0 } : { row: 0, col: 1 }];
  const from = { row: 0, col: 0 }, to = vertical ? { row: 1, col: 0 } : { row: 0, col: 1 };
  const connected = canTraverse(board, from, to) && canTraverse(board, to, from);
  return <figure className={`rule-bridge-example ${connected ? 'rule-connected' : 'rule-blocked'}`}
    aria-label={connected ? 'Bridge end connects directly to home' : 'Bridge side cannot connect to home'}
    data-bridge-connected={connected} data-bridge-tile={tileAt(board, to)}>
    <svg className="rule-bridge-picture" viewBox="0 0 156 156" aria-hidden="true">
      {positions.map((cell, index) => <g key={index}
        transform={`translate(${vertical ? 49 : 16 + index * 66} ${vertical ? 16 + index * 66 : 49}) scale(1.45)`}>
        <TileGlyph tile={tileAt(board, cell)}/>
      </g>)}
      <g className={connected ? 'rule-link-good' : 'rule-link-bad'}>
        {connected ? <path d={vertical ? 'M78 73v10' : 'M73 78h10'} strokeWidth="5" strokeLinecap="round"/> :
          <path d="m72 72 12 12m0-12-12 12" strokeWidth="4" strokeLinecap="round"/>}
      </g>
    </svg>
    <figcaption><Icon name={connected ? 'check' : 'close'} size={19}/>{connected ? 'ENDS' : 'SIDES'}</figcaption>
  </figure>;
}

function BridgeCards({ orientation }: { orientation: 'h' | 'v' }) {
  const horizontal = orientation === 'h';
  return <div className="rule-bridge-content">
    <HomeConnections/>
    <div className="rule-bridge-grid">
      <BridgeExample board={horizontal ? ['Bh'] : ['B', 'v']}/>
      <BridgeExample board={horizontal ? ['B', 'h'] : ['Bv']}/>
    </div>
    <p className="rule-card-note"><strong>{horizontal ? 'Left / right only.' : 'Up / down only.'}</strong> Never rotates.</p>
  </div>;
}

function StartPicture({ shape }: { shape: Shape }) {
  const cells = patchCells({ row: 0, col: 0 }, shape);
  const scale = 37;
  const x = 8, y = 8;
  const outline = patchOutline(shape).map(cell => `${x + cell.col * scale},${y + cell.row * scale}`).join(' ');
  return <svg className="rule-start-picture" viewBox={`0 0 ${shape.cols * scale + 16} ${shape.rows * scale + 16}`} aria-hidden="true">
      {cells.map((cell, index) => <rect key={index} x={x + cell.col * scale + 2} y={y + cell.row * scale + 2}
        width={scale - 4} height={scale - 4} rx="5" className="rule-patch-cell"/>)}
      <polygon points={outline} className="rule-patch-outline" strokeWidth="2.5" strokeLinejoin="round"/>
      <g transform={`translate(${x + scale / 2 - 16} ${y + scale / 2 - 16})`}>
        <circle cx="16" cy="16" r="15" className="rule-start-badge"/>
        <path d={frameArrowPath(shape, FLAT_AXES)} className="rule-start-arrow" fill="none"
          strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>;
}

function StartExample({ shape, label }: { shape: Shape; label: string }) {
  return <figure className="rule-start-example">
    <StartPicture shape={shape}/>
    <figcaption>{label}</figcaption>
  </figure>;
}

function StartCards() {
  return <div className="rule-start-content">
    <div className="rule-start-grid">
      <StartExample shape={{ rows: 1, cols: 2 }} label="WIDE: LEFT"/>
      <StartExample shape={{ rows: 2, cols: 1 }} label="TALL: TOP"/>
      <figure className="rule-start-example rule-corner-start">
        <div className="rule-start-pair"><StartPicture shape={{ rows: 2, cols: 2 }}/>
          <StartPicture shape={{ rows: 3, cols: 2, kind: 'ell' }}/></div>
        <figcaption>SQUARE / L: TOP-LEFT</figcaption>
      </figure>
    </div>
    <p className="rule-clear-choice"><Icon name="undo" size={23}/>
      <strong>Tap or click the same start again to clear.</strong></p>
    <p className="rule-card-note"><strong>Whole patch outlined.</strong><br/>Arrows select, not steer.</p>
  </div>;
}

export function TutorialCards({ onClose, onFinish, soundControl }: {
  onClose: () => void; onFinish: () => void; soundControl: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const content = useRef<HTMLDivElement>(null);
  const card = cards[index];
  if (!card) throw new Error('The selected picture card could not be found.');
  const last = index === cards.length - 1;
  useLayoutEffect(() => { content.current?.scrollTo({ top: 0 }); }, [index]);
  return <Modal title={card.title} className="walkthrough-dialog rule-flash-dialog"
    eyebrow={`CARD ${index + 1} / ${cards.length}`} headerControl={soundControl}
    kind="guide" onClose={onClose}>
    <div ref={content} className="rule-flash-content">
      <section key={card.id} className="rule-flash-page" data-testid="tutorial-rule-card" data-rule-card={card.id}>
        {card.id === 'order' || card.id === 'once' ? <RouteCards rule={card.id}/> :
          card.id === 'terrain' ? <TerrainCards/> : card.id === 'horizontal' ? <BridgeCards orientation="h"/> :
          card.id === 'vertical' ? <BridgeCards orientation="v"/> : <StartCards/>}
      </section>
    </div>
    <footer className="rule-flash-footer">
      <ol className="rule-flash-progress" aria-label="Picture card progress">
        {cards.map((item, position) => <li key={item.id} aria-current={position === index ? 'step' : undefined}>
          <span className="sr-only">{item.title}</span>
        </li>)}
      </ol>
      <div className="dialog-actions">
        <button className="secondary-button" onClick={() => index === 0 ? onClose() : setIndex(index - 1)}>
          {index === 0 ? 'Back home' : 'Back'}</button>
        <button className="primary-button" onClick={() => last ? onFinish() : setIndex(index + 1)}>
          {last ? 'Ready to play' : 'Next card'}<Icon name="arrow" size={17}/></button>
      </div>
    </footer>
  </Modal>;
}
