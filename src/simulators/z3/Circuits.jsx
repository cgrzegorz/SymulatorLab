import { fmt } from '../../utils.js'

const I_REF = 150 // mA – prąd, przy którym animacja płynie "pełną prędkością"

/** Przewód; przy płynącym prądzie (mA) nakładka z animowanymi kropkami. */
function Wire({ d, i = 0 }) {
  const on = i > 0.5
  const dur = Math.min(4, Math.max(0.22, (0.5 * I_REF) / Math.max(i, 1)))
  return (
    <g>
      <path d={d} className="wire" />
      {on && <path d={d} className="flow flow-anim" style={{ animationDuration: `${dur}s`, opacity: 0.35 + 0.65 * Math.min(1, i / I_REF) }} />}
    </g>
  )
}

/** Żarówka – jasność zależna od mocy P = U·I. */
function Bulb({ cx, cy, U, I, label, labelPos = 'right' }) {
  const P = U * I // mW
  const g = Math.min(1, Math.max(0, Math.pow(P / 650, 0.7)))
  const lx = labelPos === 'right' ? cx + 26 : labelPos === 'below' ? cx : cx - 26
  const ly = labelPos === 'below' ? cy + 36 : cy + 26
  return (
    <g className="bulb">
      {g > 0.01 && <circle cx={cx} cy={cy} r={18 + 26 * g} fill="url(#bulbGlow)" opacity={g} />}
      <circle cx={cx} cy={cy} r={18} className="bulb-glass" style={{ fill: `color-mix(in srgb, #ffd166 ${Math.round(g * 85)}%, var(--panel))` }} />
      <path d={`M${cx - 12.7} ${cy - 12.7}L${cx + 12.7} ${cy + 12.7}M${cx - 12.7} ${cy + 12.7}L${cx + 12.7} ${cy - 12.7}`} className="bulb-x" />
      <text x={lx} y={ly} className="lbl" textAnchor={labelPos === 'right' ? 'start' : labelPos === 'below' ? 'middle' : 'end'}>{label}</text>
    </g>
  )
}

function Meter({ cx, cy, text, sub, value, tag = 'right' }) {
  const pos = { right: [cx + 26, cy + 5, 'start'], left: [cx - 26, cy + 5, 'end'], above: [cx, cy - 26, 'middle'], below: [cx, cy + 36, 'middle'] }[tag]
  return (
    <g className="meter-sym">
      <circle cx={cx} cy={cy} r={18} />
      <text x={cx} y={cy + 5} textAnchor="middle" className="meter-sym-text">
        {text}
        {sub && <tspan fontSize="10" dy="3">{sub}</tspan>}
      </text>
      {value != null && (
        <text x={pos[0]} y={pos[1]} textAnchor={pos[2]} className="val-tag">{value}</text>
      )}
    </g>
  )
}

function Terminals({ x, top, bottom }) {
  return (
    <g>
      <circle cx={x} cy={top} r={4} className="terminal" />
      <circle cx={x} cy={bottom} r={4} className="terminal" />
      <text x={x - 4} y={top - 10} className="lbl small" textAnchor="middle">+</text>
      <text x={x - 4} y={bottom + 20} className="lbl small" textAnchor="middle">−</text>
    </g>
  )
}

function Nodes({ pts }) {
  return pts.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={3.5} className="node" />)
}

function Defs() {
  return (
    <defs>
      <radialGradient id="bulbGlow">
        <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.95" />
        <stop offset="45%" stopColor="#ffc94d" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ffb703" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

const V = (v) => `${fmt(v, 2)} V`
const A = (i) => `${fmt(i, 1)} mA`

/** Rys. 1 – połączenie szeregowe R i Ż. */
export function SeriesCircuit({ s }) {
  return (
    <svg className="circuit" viewBox="0 0 600 270" role="img" aria-label="Układ szeregowy R i Ż">
      <Defs />
      <Wire d="M40 70 H132" i={s.I} />
      <Wire d="M168 70 H250" i={s.I} />
      <Wire d="M320 70 H420 V142" i={s.I} />
      <Wire d="M420 178 V230 H40" i={s.I} />
      <Wire d="M230 70 V34 H267" />
      <Wire d="M303 34 H340 V70" />
      <Wire d="M100 70 V142" />
      <Wire d="M100 178 V230" />
      <Wire d="M420 70 H520 V142" />
      <Wire d="M520 178 V230 H420" />
      <Nodes pts={[[100, 70], [100, 230], [230, 70], [340, 70], [420, 70], [420, 230]]} />
      <Terminals x={40} top={70} bottom={230} />
      <Meter cx={150} cy={70} text="A" value={A(s.I)} tag="below" />
      <Meter cx={285} cy={34} text="V" sub="R" value={V(s.UR)} tag="left" />
      <Meter cx={100} cy={160} text="V" value={V(s.U)} tag="right" />
      <Meter cx={520} cy={160} text="V" sub="Ż" value={V(s.UB)} tag="below" />
      <g className="resistor">
        <rect x={250} y={59} width={70} height={22} rx={2} />
        <text x={285} y={100} textAnchor="middle" className="lbl">R</text>
      </g>
      <Bulb cx={420} cy={160} U={s.UB} I={s.I} label="Ż" labelPos="left" />
    </svg>
  )
}

/** Rys. 2 – połączenie równoległe R i Ż. */
export function ParallelCircuit({ s }) {
  return (
    <svg className="circuit" viewBox="0 0 600 280" role="img" aria-label="Układ równoległy R i Ż">
      <Defs />
      <Wire d="M40 60 H202" i={s.I} />
      <Wire d="M238 60 H380" i={s.I} />
      <Wire d="M380 60 V92" i={s.IB} />
      <Wire d="M380 60 H520 V92" i={s.IR} />
      <Wire d="M380 128 V160" i={s.IB} />
      <Wire d="M380 196 V240" i={s.IB} />
      <Wire d="M520 128 V150" i={s.IR} />
      <Wire d="M520 206 V240 H380" i={s.IR} />
      <Wire d="M380 240 H40" i={s.I} />
      <Wire d="M110 60 V132" />
      <Wire d="M110 168 V240" />
      <Nodes pts={[[110, 60], [110, 240], [380, 60], [380, 240]]} />
      <Terminals x={40} top={60} bottom={240} />
      <Meter cx={220} cy={60} text="A" value={A(s.I)} tag="above" />
      <Meter cx={110} cy={150} text="V" value={V(s.U)} tag="right" />
      <Meter cx={380} cy={110} text="A" sub="Ż" value={A(s.IB)} tag="left" />
      <Meter cx={520} cy={110} text="A" sub="R" value={A(s.IR)} tag="left" />
      <Bulb cx={380} cy={178} U={s.U} I={s.IB} label="Ż" labelPos="left" />
      <g className="resistor">
        <rect x={509} y={150} width={22} height={56} rx={2} />
        <text x={542} y={184} className="lbl">R</text>
      </g>
    </svg>
  )
}

/** Rys. 3 – połączenie mieszane Ż1 + (R ‖ Ż2). */
export function MixedCircuit({ s }) {
  return (
    <svg className="circuit" viewBox="0 0 600 280" role="img" aria-label="Układ mieszany Ż1 + (R ‖ Ż2)">
      <Defs />
      <Wire d="M40 60 H162" i={s.I} />
      <Wire d="M198 60 H272" i={s.I} />
      <Wire d="M308 60 H400" i={s.I} />
      <Wire d="M400 60 V122" i={s.IR} />
      <Wire d="M400 178 V240" i={s.IR} />
      <Wire d="M400 60 H520 V132" i={s.I2} />
      <Wire d="M520 168 V240 H400" i={s.I2} />
      <Wire d="M400 240 H40" i={s.I} />
      <Wire d="M100 60 V132" />
      <Wire d="M100 168 V240" />
      <Nodes pts={[[100, 60], [100, 240], [400, 60], [400, 240]]} />
      <Terminals x={40} top={60} bottom={240} />
      <Meter cx={180} cy={60} text="A" value={A(s.I)} tag="above" />
      <Meter cx={100} cy={150} text="V" value={V(s.U)} tag="right" />
      <Bulb cx={290} cy={60} U={s.U1} I={s.I} label="Ż₁" labelPos="below" />
      <g className="resistor">
        <rect x={389} y={122} width={22} height={56} rx={2} />
        <text x={378} y={156} className="lbl" textAnchor="end">R</text>
      </g>
      <Bulb cx={520} cy={150} U={s.Up} I={s.I2} label="Ż₂" labelPos="right" />
      <text x={455} y={265} textAnchor="middle" className="lbl small">UŻ1 = {fmt(s.U1, 2)} V · UR‖Ż2 = {fmt(s.Up, 2)} V</text>
    </svg>
  )
}
