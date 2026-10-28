import { fmt } from '../utils.js'

/** Miernik analogowy z łukową podziałką (domyślnie mikroamperomierz 75 µA, 75 działek). */
export function AnalogMeter({
  value,
  range = 75,
  unit = 'µA',
  label = 'LM-3 · kl. 0,5',
  divisions = 75,
  majorEvery = 15,
  midEvery = 5,
  digits = 0,
  readoutDigits = 1,
  smooth = false,
}) {
  const cx = 130
  const cy = 128
  const r = 100
  const a0 = -140
  const a1 = -40
  const frac = Math.max(-0.02, Math.min(1.03, value / range))
  const angDeg = a0 + (a1 - a0) * frac
  const pt = (a, rr) => [cx + rr * Math.cos((a * Math.PI) / 180), cy + rr * Math.sin((a * Math.PI) / 180)]
  const ticks = []
  const minor = range / divisions
  for (let k = 0; k <= divisions; k++) {
    const a = a0 + ((a1 - a0) * k) / divisions
    const major = k % majorEvery === 0
    const mid = k % midEvery === 0
    const [x1, y1] = pt(a, r)
    const [x2, y2] = pt(a, r - (major ? 14 : mid ? 9 : 5))
    ticks.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} className={major ? 'mtick major' : 'mtick'} />)
    if (major) {
      const [tx, ty] = pt(a, r - 26)
      ticks.push(<text key={'t' + k} x={tx} y={ty + 4} textAnchor="middle" className="mnum">{fmt(k * minor, digits)}</text>)
    }
  }
  const over = value > range
  return (
    <div className="meter analog">
      <svg viewBox="0 0 260 150">
        <rect x="4" y="4" width="252" height="142" rx="10" className="meter-face" />
        <path d={`M${pt(a0, r).join(' ')} A${r} ${r} 0 0 1 ${pt(a1, r).join(' ')}`} className="marc" />
        {ticks}
        <text x={cx} y={cy - 30} textAnchor="middle" className="munit">{unit}</text>
        <line
          x1={cx}
          y1={cy}
          x2={cx + r - 6}
          y2={cy}
          className="needle"
          style={{ transform: `rotate(${angDeg}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: smooth ? 'transform 0.45s cubic-bezier(.3,1.4,.5,1)' : 'none' }}
        />
        <circle cx={cx} cy={cy} r="6" className="pivot" />
        <text x={14} y={140} className="mlabel">{label}</text>
      </svg>
      <div className={'meter-readout' + (over ? ' warn' : '')}>
        {over ? 'przekroczony zakres!' : `≈ ${fmt(value, readoutDigits)} ${unit}`}
      </div>
    </div>
  )
}

/** Woltomierz cyfrowy (wyświetlacz 7-segmentowy w stylu LCD). */
export function DigitalMeter({ value, unit = 'V', label = 'MXD-4660A', active = true }) {
  return (
    <div className="meter digital">
      <div className="lcd">
        <span className="lcd-ghost">88,88</span>
        <span className="lcd-val">{active ? fmt(value, 2) : '----'}</span>
        <span className="lcd-unit">{unit}</span>
      </div>
      <div className="meter-sub">
        <span>{label}</span>
        <span>DC · 0,01 V</span>
      </div>
    </div>
  )
}

export function Stopwatch({ t, started }) {
  const tt = started ? Math.max(0, t) : 0
  const m = Math.floor(tt / 60)
  const s = tt - m * 60
  return (
    <div className="meter stopwatch">
      <div className="sw-val">
        {String(m).padStart(2, '0')}:{s.toFixed(1).padStart(4, '0').replace('.', ',')}
      </div>
      <div className="meter-sub"><span>stoper</span><span>t od otwarcia W</span></div>
    </div>
  )
}
