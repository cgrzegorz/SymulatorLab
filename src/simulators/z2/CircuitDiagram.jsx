import { fmt } from '../../utils.js'

// Odcinki przewodów każdego układu, zapisane zgodnie z kierunkiem prądu.
// 'pre' – płynie prąd przed otwarciem W, 'post' – po otwarciu W.
const LAYOUTS = {
  'charge-i': {
    wires: [
      { d: 'M60 118 V50 H130', pre: true, post: true },
      { d: 'M170 50 H230', pre: true, post: true },
      { d: 'M300 50 H380', pre: true, post: true },
      { d: 'M380 50 V132', post: true },
      { d: 'M380 148 V230', post: true },
      { d: 'M380 50 H500 V118', pre: true },
      { d: 'M500 162 V230 H380', pre: true },
      { d: 'M380 230 H60 V162', pre: true, post: true },
    ],
    source: [60, 140],
    meterA: { c: [150, 50], horizontal: true },
    R: { x: 230, y: 50, horizontal: true },
    C: { x: 380, y: 140 },
    W: { x: 500, y: 140, vertical: true },
    nodes: [[380, 50], [380, 230]],
  },
  'charge-u': {
    wires: [
      { d: 'M60 118 V50 H160', pre: true, post: true },
      { d: 'M230 50 H300', pre: true, post: true },
      { d: 'M300 50 V132', post: true },
      { d: 'M300 148 V230', post: true },
      { d: 'M300 50 H410', pre: true },
      { d: 'M410 50 V120' },
      { d: 'M410 160 V230' },
      { d: 'M410 50 H520 V118', pre: true },
      { d: 'M520 162 V230 H410', pre: true },
      { d: 'M410 230 H300', pre: true },
      { d: 'M300 230 H60 V162', pre: true, post: true },
    ],
    source: [60, 140],
    meterV: { c: [410, 140] },
    R: { x: 160, y: 50, horizontal: true },
    C: { x: 300, y: 140 },
    W: { x: 520, y: 140, vertical: true },
    nodes: [[300, 50], [300, 230], [410, 50], [410, 230]],
  },
  discharge: {
    wires: [
      { d: 'M60 118 V50 H120', pre: true },
      { d: 'M170 50 H240', pre: true },
      { d: 'M240 132 V50', post: true },
      { d: 'M240 50 H310', pre: true, post: true },
      { d: 'M380 50 H480 V120', pre: true, post: true },
      { d: 'M480 160 V230 H240', pre: true, post: true },
      { d: 'M240 230 V148', post: true },
      { d: 'M240 230 H60 V162', pre: true },
    ],
    source: [60, 140],
    meterA: { c: [480, 140] },
    R: { x: 310, y: 50, horizontal: true },
    C: { x: 240, y: 140 },
    W: { x: 120, y: 50, horizontal: true },
    nodes: [[240, 50], [240, 230]],
  },
}

function Switch({ x, y, vertical, closed, onClick, label }) {
  // Łącznik W: dwa zaciski i dźwignia; kliknięcie otwiera łącznik (t = 0).
  const t1 = vertical ? [x, y + 22] : [x, y]
  const t2 = vertical ? [x, y - 22] : [x + 50, y]
  const open = vertical ? [x + 30, y - 14] : [x + 44, y - 26]
  const end = closed ? t2 : open
  return (
    <g className={'switch' + (onClick ? ' clickable' : '')} onClick={onClick}>
      <rect x={Math.min(t1[0], t2[0]) - 16} y={Math.min(t1[1], t2[1]) - 32} width={vertical ? 64 : 84} height={vertical ? 76 : 50} className="hit" />
      <line x1={t1[0]} y1={t1[1]} x2={end[0]} y2={end[1]} className="lever" />
      <circle cx={t1[0]} cy={t1[1]} r={4} className="terminal" />
      <circle cx={t2[0]} cy={t2[1]} r={4} className="terminal" />
      {vertical ? (
        <>
          <text x={x + 14} y={y + 30} className="lbl">W</text>
          <text x={x + 14} y={y - 30} className="lbl small">t = 0</text>
        </>
      ) : (
        <>
          <text x={x + 25} y={y + 22} className="lbl" textAnchor="middle">W</text>
          <text x={x - 6} y={y - 18} className="lbl small" textAnchor="end">{label}</text>
        </>
      )}
    </g>
  )
}

function Meter({ c, text, horizontal, value }) {
  const [cx, cy] = c
  return (
    <g className="meter-sym">
      <circle cx={cx} cy={cy} r={20} />
      <text x={cx} y={cy + 5} textAnchor="middle" className="meter-sym-text">{text}</text>
      {value && (
        <text x={horizontal ? cx : cx + 28} y={horizontal ? cy - 28 : cy + 5} textAnchor={horizontal ? 'middle' : 'start'} className="val-tag">
          {value}
        </text>
      )}
    </g>
  )
}

export default function CircuitDiagram({ mode, closed, uC, U, i, iRef, phase, onSwitch }) {
  const L = LAYOUTS[mode]
  const phaseKey = closed ? 'pre' : 'post'
  const intensity = Math.min(1, Math.max(0, i / iRef))
  const charge = Math.min(1, Math.max(0, uC / U))
  const [sx, sy] = L.source
  const { x: cX, y: cY } = L.C

  return (
    <svg className="circuit" viewBox="0 0 580 260" role="img" aria-label="Schemat układu pomiarowego">
      {L.wires.map((w, k) => (
        <g key={k}>
          <path d={w.d} className="wire" />
          {w[phaseKey] && intensity > 0.002 && (
            <path d={w.d} className="flow" style={{ strokeDashoffset: -phase, opacity: 0.25 + 0.75 * Math.sqrt(intensity) }} />
          )}
        </g>
      ))}
      {L.nodes.map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={4} className="node" />
      ))}

      {/* Źródło napięcia U */}
      <g className="source">
        <circle cx={sx} cy={sy} r={22} />
        <path d={`M${sx} ${sy + 14} V${sy - 12} M${sx - 6} ${sy - 4} L${sx} ${sy - 13} L${sx + 6} ${sy - 4}`} />
        <text x={sx + 30} y={sy + 5} className="lbl">U</text>
        <text x={sx + 30} y={sy + 22} className="lbl small">{fmt(U, 1)} V</text>
      </g>

      {/* Rezystor R */}
      <g className="resistor">
        <rect x={L.R.x} y={L.R.y - 11} width={70} height={22} rx={2} />
        <text x={L.R.x + 35} y={L.R.y - 18} textAnchor="middle" className="lbl">R</text>
      </g>

      {/* Kondensator C – okładki zabarwione proporcjonalnie do naładowania */}
      <g className="capacitor">
        <line x1={cX - 22} x2={cX + 22} y1={cY - 8} y2={cY - 8} className="plate" style={{ stroke: `color-mix(in srgb, var(--pos) ${Math.round(charge * 100)}%, var(--ink))` }} />
        <line x1={cX - 22} x2={cX + 22} y1={cY + 8} y2={cY + 8} className="plate" style={{ stroke: `color-mix(in srgb, var(--neg) ${Math.round(charge * 100)}%, var(--ink))` }} />
        <text x={cX - 30} y={cY + 5} textAnchor="end" className="lbl">C</text>
        <text x={cX + 30} y={cY - 14} className="val-tag">{fmt(uC, 2)} V</text>
        <rect x={cX + 30} y={cY - 4} width={46} height={6} rx={3} className="charge-bar-bg" />
        <rect x={cX + 30} y={cY - 4} width={46 * charge} height={6} rx={3} className="charge-bar" />
      </g>

      {L.meterA && <Meter c={L.meterA.c} text="µA" horizontal={L.meterA.horizontal} value={`${fmt(i * 1e6, 1)} µA`} />}
      {L.meterV && <Meter c={L.meterV.c} text="V" value={`${fmt(uC, 2)} V`} />}

      <Switch
        x={L.W.x}
        y={L.W.y}
        vertical={L.W.vertical}
        closed={closed}
        label="t = 0"
        onClick={closed ? onSwitch : undefined}
      />
    </svg>
  )
}
