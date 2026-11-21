import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Board, Shape, Tile } from '../shared/types.ts';
import { canTraverse, patchCells, patchOutline, tileAt } from '../shared/rules.ts';
import { FLAT_AXES, Icon, Modal, TileGlyph } from './components.tsx';
import { frameArrowPath } from './frameArrow.ts';
import './tutorialCards.css';

const cards = [
  { id: 'terrain', title: 'What moves. What stays.' },
  { id: 'bridges', title: 'Bridge ends connect.' },
  { id: 'starts', title: 'Pick the starting tile.' },
] as const;

function TerrainCards() {
  const groups: { label: string; fixed: boolean; tiles: { tile: Tile; name: string }[] }[] = [
    { label: 'MOVES', fixed: false, tiles: [
      { tile: 'o', name: 'Road' }, { tile: '.', name: 'Grass' },
      { tile: '~', name: 'Water' }, { tile: 'h', name: 'Bridge' },
    ] },
    { label: 'STAYS', fixed: true, tiles: [{ tile: 'A', name: 'Home' }, { tile: 'x', name: 'Boulder' }] },
  ];
  return <div className="rule-terrain-groups">
    {groups.map(group => <section className={`rule-terrain-group ${group.fixed ? 'rule-fixed' : ''}`} key={group.label}>
      <h3><Icon name={group.fixed ? 'lock' : 'swap'} size={21}/>{group.label}</h3>
      <div className="rule-terrain-tiles">{group.tiles.map(({ tile, name }) =>
        <figure key={tile}><TileGlyph tile={tile}/><figcaption>{name}</figcaption></figure>)}</div>
    </section>)}
    <p className="rule-card-note"><strong>The whole patch moves.</strong> Leave fixed tiles out.</p>
  </div>;
}

function BridgeExample({ board, label }: { board: Board; label: string }) {
  const vertical = board.length > 1;
  const positions = [0, 1, 2].map(index => vertical ? { row: index, col: 0 } : { row: 0, col: index });
  const connections = positions.slice(1).map((to, index) => ({
    from: vertical ? { row: index, col: 0 } : { row: 0, col: index }, to,
  }));
  const connected = connections.every(({ from, to }) => canTraverse(board, from, to));
  return <figure className={`rule-bridge-example ${connected ? 'rule-connected' : 'rule-blocked'}`}>
    <svg className="rule-bridge-picture" viewBox="0 0 180 180" aria-hidden="true">
      {positions.map((cell, index) => <g key={index}
        transform={`translate(${vertical ? 68 : 12 + index * 56} ${vertical ? 12 + index * 56 : 68})`}>
        <TileGlyph tile={tileAt(board, cell)}/>
      </g>)}
      {connections.map(({ from, to }, index) => {
        const works = canTraverse(board, from, to);
        const x = vertical ? 88 : 60 + index * 56, y = vertical ? 60 + index * 56 : 88;
        return <g key={index} className={works ? 'rule-link-good' : 'rule-link-bad'}>
          {works ? <path d={vertical ? `M${x} ${y - 6}v12` : `M${x - 6} ${y}h12`} strokeWidth="5" strokeLinecap="round"/> :
            <path d={`m${x - 6} ${y - 6} 12 12m0-12-12 12`} strokeWidth="4" strokeLinecap="round"/>}
        </g>;
      })}
    </svg>
    <figcaption><Icon name={connected ? 'check' : 'close'} size={19}/>{label}</figcaption>
  </figure>;
}

function BridgeCards() {
  return <div className="rule-bridge-content">
    <p className="rule-card-lead"><strong>Both directions. Along the planks.</strong></p>
    <div className="rule-bridge-grid">
      <BridgeExample board={['ohB']} label="Across"/>
      <BridgeExample board={['B', 'v', 'o']} label="Up / down"/>
      <BridgeExample board={['B', 'h', 'o']} label="Side blocked"/>
    </div>
    <p className="rule-card-note"><strong>Ends can touch homes directly.</strong><br/>Bridges never rotate.</p>
  </div>;
}

function StartPicture({ shape }: { shape: Shape }) {
  const cells = patchCells({ row: 0, col: 0 }, shape);
  const scale = 37;
  const x = (180 - shape.cols * scale) / 2, y = (126 - shape.rows * scale) / 2;
  const outline = patchOutline(shape).map(cell => `${x + cell.col * scale},${y + cell.row * scale}`).join(' ');
  return <svg className="rule-start-picture" viewBox="0 0 180 126" aria-hidden="true">
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
    eyebrow={`PICTURE CARD ${index + 1} / ${cards.length}`} headerControl={soundControl}
    kind="guide" onClose={onClose}>
    <div ref={content} className="rule-flash-content">
      <section key={card.id} className="rule-flash-page" data-testid="tutorial-rule-card" data-rule-card={card.id}>
        {card.id === 'terrain' ? <TerrainCards/> : card.id === 'bridges' ? <BridgeCards/> : <StartCards/>}
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
