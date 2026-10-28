import { useEffect, useMemo, useState } from 'react'
import XYChart, { Legend } from '../../components/XYChart.jsx'
import { AnalogMeter } from '../../components/Meters.jsx'
import { MixedCircuit, ParallelCircuit, SeriesCircuit } from './Circuits.jsx'
import {
  DEFAULT_BULB,
  MODES,
  bulbI,
  bulbRd,
  bulbU,
  readI,
  readV,
  solveMixed,
  solveParallel,
  solveParallelForI,
  solveSeries,
  voltRange,
} from './physics.js'
import { REPORT } from './reportData.js'
import { fmt, signed } from '../../utils.js'

const DEFAULTS = { R: 30, a: DEFAULT_BULB.a, n: DEFAULT_BULB.n, mixedOther: true, k: 1.58 }
const emptyRows = () => ({ series: [], parallel: [], mixed: [] })

function NumField({ label, unit, value, onChange, min, max, step, disabled, hint }) {
  return (
    <label className={'field' + (disabled ? ' disabled' : '')}>
      <span className="field-label">{label}{hint && <small> {hint}</small>}</span>
      <span className="field-input">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!Number.isNaN(v) && v >= 0) onChange(v)
          }}
        />
        <span className="unit">{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  )
}

function VoltMeter({ value, label }) {
  const range = voltRange(value)
  return (
    <AnalogMeter
      value={value}
      range={range}
      unit="V"
      label={label}
      divisions={75}
      majorEvery={15}
      digits={range === 7.5 ? 1 : 0}
      readoutDigits={2}
      smooth
    />
  )
}

function AmpMeter({ value, label }) {
  return <AnalogMeter value={value} range={300} unit="mA" label={label} divisions={60} majorEvery={12} midEvery={2} smooth />
}

export default function Z3Simulator() {
  const [mode, setMode] = useState('series')
  const [p, setP] = useState(DEFAULTS)
  const [realism, setRealism] = useState(true)
  const [showRef, setShowRef] = useState(true)
  const [uSet, setUSet] = useState({ series: 6, parallel: 2.5, mixed: 3 })
  const [rows, setRows] = useState(emptyRows)
  const [auto, setAuto] = useState(null) // { mode, idx }
  const [opKind, setOpKind] = useState('series')
  const [opU, setOpU] = useState(6)
  const [opI, setOpI] = useState(150)

  const bulb = useMemo(() => ({ a: p.a, n: p.n }), [p.a, p.n])
  const bulbMix = useMemo(() => (p.mixedOther ? { a: p.a * p.k, n: p.n } : bulb), [bulb, p.a, p.n, p.k, p.mixedOther])
  const R = p.R

  // Zmiana elementów obwodu kasuje pomiary
  useEffect(() => setRows(emptyRows()), [R, bulb, bulbMix])

  const solve = (m, U) =>
    m === 'series' ? solveSeries(U, R, bulb) : m === 'parallel' ? solveParallel(U, R, bulb) : solveMixed(U, R, bulbMix, bulbMix)

  const takeReading = (m, U) => {
    const s = solve(m, U)
    const base = { U: Math.round(U * 100) / 100, I: readI(s.I, realism) }
    if (m === 'series') return { ...base, UR: readV(s.UR, realism), UB: readV(s.UB, realism) }
    if (m === 'parallel') return { ...base, IR: readI(s.IR, realism), IB: readI(s.IB, realism) }
    return base
  }

  const record = (m, U) =>
    setRows((r) => ({ ...r, [m]: [...r[m].filter((q) => Math.abs(q.U - U) > 1e-6), takeReading(m, U)].sort((a, b) => a.U - b.U) }))

  // Seria automatyczna: ustawia kolejne napięcia z instrukcji i po ustaleniu się wskazówek zapisuje odczyt.
  useEffect(() => {
    if (!auto) return
    const steps = MODES[auto.mode].steps
    if (auto.idx >= steps.length) {
      setAuto(null)
      return
    }
    const U = steps[auto.idx]
    setUSet((u) => ({ ...u, [auto.mode]: U }))
    const t = setTimeout(() => {
      record(auto.mode, U)
      setAuto((a) => (a ? { ...a, idx: a.idx + 1 } : a))
    }, 650)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto])

  const switchMode = (m) => {
    setAuto(null)
    setMode(m)
  }

  const isMeas = mode !== 'op'
  const U = isMeas ? uSet[mode] : 0
  const sol = isMeas ? solve(mode, U) : null
  const cur = rows[mode] ?? []
  const uMax = MODES[mode].uMax
  const stepSize = mode === 'series' ? 1 : 0.5

  // ---------- Wykresy ----------
  const iR = (u) => (u / R) * 1000
  const iB = (u) => bulbI(bulb, u)
  const refRows = REPORT[mode]
  let chart = null
  let legend = []
  let summary = null

  if (mode === 'series') {
    const Imax = 125
    chart = {
      xMax: 9.5,
      yMax: 130,
      xLabel: 'U [V]',
      yLabel: 'I [mA]',
      series: [
        { kind: 'curve', fn: iR, x0: 0, x1: (Imax * R) / 1000, cls: 'c-r thin' },
        { kind: 'param', fn: (i) => [bulbU(bulb, i), i], s0: 0, s1: Imax, cls: 'c-b thin' },
        { kind: 'param', fn: (i) => [(i * R) / 1000 + bulbU(bulb, i), i], s0: 0, s1: Imax, cls: 'c-sum model' },
        { kind: 'line', data: cur.map((r) => [r.UR + r.UB, r.I]), cls: 'c-sum thick' },
        { kind: 'points', data: cur.map((r) => [r.UR + r.UB, r.I]), marker: 'circle', cls: 'c-sum' },
        { kind: 'points', data: cur.map((r) => [r.UR, r.I]), marker: 'circle', cls: 'c-r hollow' },
        { kind: 'points', data: cur.map((r) => [r.UB, r.I]), marker: 'square', cls: 'c-b hollow' },
        { kind: 'points', data: cur.map((r) => [r.U, r.I]), marker: 'cross', cls: 'c-meas' },
        ...(showRef
          ? [
              { kind: 'points', data: refRows.map((r) => [r.UR, r.I]), marker: 'tri', cls: 'c-ref hollow' },
              { kind: 'points', data: refRows.map((r) => [r.UB, r.I]), marker: 'tri', cls: 'c-ref hollow' },
              { kind: 'points', data: refRows.map((r) => [r.U, r.I]), marker: 'cross', cls: 'c-ref' },
            ]
          : []),
      ],
      annotations: sol.I > 1
        ? [
            { x1: 0, y1: sol.I, x2: sol.UR, y2: sol.I, cls: 'acc-r', label: 'UR' },
            { x1: sol.UR, y1: sol.I, x2: sol.U, y2: sol.I, cls: 'acc-b', label: 'UŻ' },
            { x1: sol.U, y1: 0, x2: sol.U, y2: sol.I, cls: 'dash' },
          ]
        : [],
    }
    legend = [
      { label: 'rezystor I = f(UR)', cls: 'c-r', marker: 'circle', line: true },
      { label: 'żarówka I = f(UŻ)', cls: 'c-b', marker: 'square', line: true },
      { label: 'teoria UR + UŻ (z pomiarów)', cls: 'c-sum thick', marker: 'circle', line: true },
      { label: 'pomiar U', cls: 'c-meas', marker: 'cross' },
      ...(showRef ? [{ label: 'sprawozdanie', cls: 'c-ref', marker: 'tri' }] : []),
    ]
    const devs = cur.filter((r) => r.U > 0).map((r) => r.UR + r.UB - r.U)
    summary = devs.length ? { label: 'max |U − (UR + UŻ)|', value: `${fmt(Math.max(...devs.map(Math.abs)), 2)} V`, note: 'II prawo Kirchhoffa' } : null
  }

  if (mode === 'parallel') {
    chart = {
      xMax: 5,
      yMax: 260,
      xLabel: 'U [V]',
      yLabel: 'I [mA]',
      series: [
        { kind: 'curve', fn: iR, x0: 0, x1: 5, cls: 'c-r thin' },
        { kind: 'curve', fn: iB, x0: 0, x1: 5, cls: 'c-b thin' },
        { kind: 'curve', fn: (u) => iR(u) + iB(u), x0: 0, x1: 5, cls: 'c-sum model' },
        { kind: 'line', data: cur.map((r) => [r.U, r.IR + r.IB]), cls: 'c-sum thick' },
        { kind: 'points', data: cur.map((r) => [r.U, r.IR + r.IB]), marker: 'circle', cls: 'c-sum' },
        { kind: 'points', data: cur.map((r) => [r.U, r.IR]), marker: 'circle', cls: 'c-r hollow' },
        { kind: 'points', data: cur.map((r) => [r.U, r.IB]), marker: 'square', cls: 'c-b hollow' },
        { kind: 'points', data: cur.map((r) => [r.U, r.I]), marker: 'cross', cls: 'c-meas' },
        ...(showRef
          ? [
              { kind: 'points', data: refRows.map((r) => [r.U, r.IR]), marker: 'tri', cls: 'c-ref hollow' },
              { kind: 'points', data: refRows.map((r) => [r.U, r.IB]), marker: 'tri', cls: 'c-ref hollow' },
              { kind: 'points', data: refRows.map((r) => [r.U, r.I]), marker: 'cross', cls: 'c-ref' },
            ]
          : []),
      ],
      annotations: sol.U > 0.05
        ? [
            { x1: sol.U, y1: 0, x2: sol.U, y2: sol.IB, cls: 'acc-b', label: 'IŻ', lx: sol.U + 0.12, ly: sol.IB / 2, anchor: 'start' },
            { x1: sol.U, y1: sol.IB, x2: sol.U, y2: sol.I, cls: 'acc-r', label: 'IR', lx: sol.U + 0.12, ly: (sol.IB + sol.I) / 2, anchor: 'start' },
          ]
        : [],
    }
    legend = [
      { label: 'rezystor IR = f(U)', cls: 'c-r', marker: 'circle', line: true },
      { label: 'żarówka IŻ = f(U)', cls: 'c-b', marker: 'square', line: true },
      { label: 'teoria IR + IŻ (z pomiarów)', cls: 'c-sum thick', marker: 'circle', line: true },
      { label: 'pomiar I', cls: 'c-meas', marker: 'cross' },
      ...(showRef ? [{ label: 'sprawozdanie', cls: 'c-ref', marker: 'tri' }] : []),
    ]
    const devs = cur.filter((r) => r.I > 0).map((r) => ((r.I - (r.IR + r.IB)) / (r.IR + r.IB)) * 100)
    summary = devs.length ? { label: 'max |I − (IR + IŻ)| / (IR + IŻ)', value: `${fmt(Math.max(...devs.map(Math.abs)), 1)} %`, note: 'I prawo Kirchhoffa' } : null
  }

  if (mode === 'mixed') {
    const theory = (u) => solveMixed(u, R, bulb, bulb).I
    chart = {
      xMax: 9.5,
      yMax: 260,
      xLabel: 'U [V]',
      yLabel: 'I [mA]',
      series: [
        { kind: 'param', fn: (i) => [bulbU(bulb, i), i], s0: 0, s1: 125, cls: 'c-b thin' },
        { kind: 'curve', fn: (u) => iR(u) + bulbI(bulb, u), x0: 0, x1: 4.5, cls: 'c-r thin' },
        { kind: 'curve', fn: theory, x0: 0, x1: 9, cls: 'c-sum thick' },
        ...(p.mixedOther ? [{ kind: 'curve', fn: (u) => solveMixed(u, R, bulbMix, bulbMix).I, x0: 0, x1: 9, cls: 'c-act' }] : []),
        { kind: 'points', data: cur.map((r) => [r.U, r.I]), marker: 'cross', cls: 'c-meas' },
        ...(showRef
          ? [
              { kind: 'points', data: refRows.map((r) => [r.U, r.I]), marker: 'cross', cls: 'c-ref' },
              { kind: 'points', data: refRows.map((r) => [r.U, r.Ith]), marker: 'circle', cls: 'c-ref' },
            ]
          : []),
      ],
      annotations: sol.I > 1
        ? [
            { x1: 0, y1: sol.I, x2: sol.Up, y2: sol.I, cls: 'acc-r', label: 'UR‖Ż2' },
            { x1: sol.Up, y1: sol.I, x2: sol.U, y2: sol.I, cls: 'acc-b', label: 'UŻ1' },
          ]
        : [],
    }
    legend = [
      { label: 'żarówka Ż (pkt 1)', cls: 'c-b', line: true },
      { label: 'R ‖ Ż (pkt 2)', cls: 'c-r', line: true },
      { label: 'teoria Ż1 + (R‖Ż2), Ż1 = Ż2 = Ż', cls: 'c-sum thick', line: true },
      ...(p.mixedOther ? [{ label: `model z żarówkami ×${fmt(p.k, 2)}`, cls: 'c-act', line: true }] : []),
      { label: 'pomiar', cls: 'c-meas', marker: 'cross' },
      ...(showRef ? [{ label: 'sprawozdanie: pomiar / teoria', cls: 'c-ref', marker: 'cross' }] : []),
    ]
    const devs = cur.filter((r) => r.U > 0 && r.U <= 7).map((r) => ((r.I - theory(r.U)) / theory(r.U)) * 100)
    summary = devs.length ? { label: 'średnia różnica pomiar vs teoria', value: signed(devs.reduce((a, b) => a + b, 0) / devs.length, 0) + ' %', note: p.mixedOther ? 'inne żarówki Ż1, Ż2' : 'żarówki jak Ż' } : null
  }

  // ---------- Punkt pracy (metoda przecięcia) ----------
  let op = null
  if (mode === 'op') {
    if (opKind === 'series') {
      const s = solveSeries(opU, R, bulb)
      const i0 = (opU / R) * 1000
      const rd = bulbRd(bulb, s.UB)
      const tan = (u) => s.I + ((u - s.UB) / rd) * 1000
      op = {
        s,
        chart: {
          xMax: Math.max(6.5, opU * 1.05),
          yMax: Math.max(130, i0 * 1.05),
          xLabel: 'U [V]',
          yLabel: 'I [mA]',
          series: [
            { kind: 'curve', fn: iB, x0: 0, x1: Math.max(6, opU), cls: 'c-b' },
            { kind: 'line', data: [[0, i0], [opU, 0]], cls: 'c-r dashed' },
            { kind: 'line', data: [[s.UB - 1.8, tan(s.UB - 1.8)], [s.UB + 1.8, tan(s.UB + 1.8)]], cls: 'c-tan' },
            ...(showRef ? [{ kind: 'points', data: REPORT.series.map((r) => [r.UB, r.I]), marker: 'tri', cls: 'c-ref hollow' }] : []),
            { kind: 'points', data: [[s.UB, s.I]], marker: 'ring', cls: 'c-p' },
          ],
          annotations: [
            { x1: 0, y1: s.I, x2: s.UB, y2: s.I, cls: 'dash' },
            { x1: s.UB, y1: 0, x2: s.UB, y2: s.I, cls: 'dash' },
            { x1: 0, y1: 4, x2: s.UB, y2: 4, cls: 'acc-b', label: `UŻ ≈ ${fmt(s.UB, 2)} V` },
            { x1: s.UB, y1: 4, x2: opU, y2: 4, cls: 'acc-r', label: `UR ≈ ${fmt(s.UR, 2)} V` },
          ],
        },
        rows: [
          ['Prąd I', 'mA', fmt(s.I, 1), opU === 6 ? fmt(REPORT.opSeries.I, 0) : '–', opU === 6 ? fmt(REPORT.opSeries.meas.I, 0) : '–'],
          ['Napięcie UŻ', 'V', fmt(s.UB, 2), opU === 6 ? fmt(REPORT.opSeries.UB, 2) : '–', opU === 6 ? fmt(REPORT.opSeries.meas.UB, 1) : '–'],
          ['Napięcie UR', 'V', fmt(s.UR, 2), opU === 6 ? fmt(REPORT.opSeries.UR, 2) : '–', opU === 6 ? fmt(REPORT.opSeries.meas.UR, 1) : '–'],
          ['Rezystancja statyczna RŻ = UŻ / I', 'Ω', fmt((s.UB / s.I) * 1000, 1), opU === 6 ? fmt(REPORT.opSeries.Rstat, 1) : '–', ''],
          ['Rezystancja dynamiczna rd = dUŻ / dI', 'Ω', fmt(rd, 0), opU === 6 ? fmt(REPORT.opSeries.Rd, 0) + ' *' : '–', ''],
        ],
      }
      op.legend = [
        { label: 'żarówka I = f(UŻ)', cls: 'c-b', line: true },
        { label: 'prosta rezystora I = (U − UŻ)/R', cls: 'c-r dashed', line: true },
        { label: 'styczna w P (1/rd)', cls: 'c-tan', line: true },
        { label: 'punkt pracy P', cls: 'c-p', marker: 'ring' },
        ...(showRef ? [{ label: 'żarówka – sprawozdanie', cls: 'c-ref', marker: 'tri' }] : []),
      ]
    } else {
      const s = solveParallelForI(opI, R, bulb)
      const u0 = (opI * R) / 1000
      op = {
        s,
        chart: {
          xMax: Math.max(5, u0 * 1.05),
          yMax: Math.max(160, opI * 1.08),
          xLabel: 'U [V]',
          yLabel: 'I [mA]',
          series: [
            { kind: 'curve', fn: iB, x0: 0, x1: Math.max(5, u0), cls: 'c-b' },
            { kind: 'line', data: [[0, opI], [u0, 0]], cls: 'c-r dashed' },
            ...(showRef ? [{ kind: 'points', data: REPORT.parallel.map((r) => [r.U, r.IB]), marker: 'tri', cls: 'c-ref hollow' }] : []),
            { kind: 'points', data: [[s.U, s.IB]], marker: 'ring', cls: 'c-p' },
          ],
          annotations: [
            { x1: 0, y1: s.IB, x2: s.U, y2: s.IB, cls: 'dash', label: `IŻ ≈ ${fmt(s.IB, 0)} mA`, lx: 0.1, anchor: 'start' },
            { x1: s.U, y1: 0, x2: s.U, y2: s.IB, cls: 'dash', label: `U ≈ ${fmt(s.U, 2)} V`, lx: s.U + 0.08, ly: 8, anchor: 'start' },
          ],
        },
        rows: [
          ['Napięcie U', 'V', fmt(s.U, 2), opI === 150 ? fmt(REPORT.opParallel.U, 1) : '–', opI === 150 ? fmt(REPORT.opParallel.meas.U, 1) : '–'],
          ['Prąd IŻ', 'mA', fmt(s.IB, 1), opI === 150 ? fmt(REPORT.opParallel.IB, 0) : '–', opI === 150 ? fmt(REPORT.opParallel.meas.IB, 0) : '–'],
          ['Prąd IR = I − IŻ', 'mA', fmt(s.IR, 1), opI === 150 ? fmt(REPORT.opParallel.IR, 0) : '–', opI === 150 ? fmt(REPORT.opParallel.meas.IR, 0) : '–'],
          ['Rezystancja statyczna RŻ = U / IŻ', 'Ω', fmt((s.U / s.IB) * 1000, 1), '–', ''],
        ],
      }
      op.legend = [
        { label: 'żarówka IŻ = f(U)', cls: 'c-b', line: true },
        { label: 'prosta IŻ = I − U/R', cls: 'c-r dashed', line: true },
        { label: 'punkt pracy', cls: 'c-p', marker: 'ring' },
        ...(showRef ? [{ label: 'żarówka – sprawozdanie', cls: 'c-ref', marker: 'tri' }] : []),
      ]
    }
  }

  const exportCsv = () => {
    const lines = ['uklad;U_V;I_mA;UR_V;UZ_V;IR_mA;IZ_mA']
    for (const m of ['series', 'parallel', 'mixed'])
      for (const r of rows[m]) lines.push([m, r.U, r.I, r.UR ?? '', r.UB ?? '', r.IR ?? '', r.IB ?? ''].join(';'))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([lines.join('\n').replace(/\./g, ',')], { type: 'text/csv;charset=utf-8' }))
    a.download = 'Z3_pomiary.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const setPk = (k) => (v) => setP((q) => ({ ...q, [k]: v }))
  const refFor = (u) => refRows?.find((r) => Math.abs(r.U - u) < 1e-6)

  return (
    <div className="sim">
      <header className="sim-header">
        <div>
          <div className="crumbs">Elektrotechnika / Ćwiczenie Z3</div>
          <h1>Nieliniowe obwody prądu stałego</h1>
          <p className="lead">
            Charakterystyki I = f(U) rezystora R = {fmt(R, 0)} Ω i żarówki z włóknem metalowym oraz ich połączeń. Zmieniaj napięcie
            zasilacza, zapisuj wskazania mierników i zbuduj charakterystykę zastępczą metodą graficzną.
          </p>
        </div>
        <div className="formula-card">
          <div>szeregowo: U = UR + UŻ (I = const)</div>
          <div>równolegle: I = IR + IŻ (U = const)</div>
          <div className="big">R = U/I · rd = ΔU/ΔI</div>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {Object.entries(MODES).map(([k, m]) => (
          <button key={k} role="tab" aria-selected={mode === k} className={'tab' + (mode === k ? ' active' : '')} onClick={() => switchMode(k)}>
            {m.label}
            {rows[k]?.length >= m.steps.length && m.steps.length > 0 && <span className="tab-done">✓</span>}
          </button>
        ))}
      </nav>

      {isMeas ? (
        <div className="sim-grid">
          <section className="card circuit-card">
            <div className="card-head">
              <h2>Układ pomiarowy <small>({MODES[mode].fig} z instrukcji)</small></h2>
              <span className={'status' + (auto ? ' live' : '')}>{auto ? `Seria: ${auto.idx + 1}/${MODES[mode].steps.length}` : `${cur.length} pomiarów`}</span>
            </div>
            {mode === 'series' && <SeriesCircuit s={sol} />}
            {mode === 'parallel' && <ParallelCircuit s={sol} />}
            {mode === 'mixed' && <MixedCircuit s={sol} />}

            <div className="supply">
              <div className="supply-display">
                <span className="supply-label">Zasilacz DC</span>
                <span className="supply-val">{fmt(U, 2)}<small> V</small></span>
              </div>
              <div className="supply-ctrl">
                <input
                  type="range"
                  min={0}
                  max={uMax}
                  step={0.05}
                  value={U}
                  disabled={!!auto}
                  onChange={(e) => setUSet((u) => ({ ...u, [mode]: parseFloat(e.target.value) }))}
                  aria-label="Napięcie zasilacza"
                />
                <div className="supply-btns">
                  <button className="btn small" disabled={!!auto} onClick={() => setUSet((u) => ({ ...u, [mode]: Math.max(0, Math.round((U - stepSize) / stepSize) * stepSize) }))}>− {fmt(stepSize, 1)} V</button>
                  <button className="btn small" disabled={!!auto} onClick={() => setUSet((u) => ({ ...u, [mode]: Math.min(uMax, Math.round((U + stepSize) / stepSize) * stepSize) }))}>+ {fmt(stepSize, 1)} V</button>
                  <span className="muted-text">0 … {fmt(uMax, 1)} V</span>
                </div>
              </div>
            </div>

            <div className={'meters-grid' + (mode === 'mixed' ? ' two' : '')}>
              <VoltMeter value={sol.U} label="V · LM-3 · kl. 0,5" />
              <AmpMeter value={sol.I} label="A · LM-1 · kl. 0,5" />
              {mode === 'series' && <VoltMeter value={sol.UR} label="VR · LM-3" />}
              {mode === 'series' && <VoltMeter value={sol.UB} label="VŻ · LM-3" />}
              {mode === 'parallel' && <AmpMeter value={sol.IB} label="AŻ · LM-1" />}
              {mode === 'parallel' && <AmpMeter value={sol.IR} label="AR · LM-1" />}
            </div>

            <div className="controls">
              <button className="btn primary" onClick={() => record(mode, U)} disabled={!!auto}>✎ Zapisz pomiar</button>
              {auto ? (
                <button className="btn" onClick={() => setAuto(null)}>⏹ Zatrzymaj serię</button>
              ) : (
                <button className="btn" onClick={() => setAuto({ mode, idx: 0 })}>▶ Seria wg instrukcji</button>
              )}
              <button className="btn ghost" onClick={() => setRows((r) => ({ ...r, [mode]: [] }))} disabled={!!auto}>↺ Wyczyść</button>
            </div>
          </section>

          <section className="card chart-card">
            <div className="card-head">
              <h2>Charakterystyki I = f(U)</h2>
              <div className="toggles">
                <label><input type="checkbox" checked={showRef} onChange={(e) => setShowRef(e.target.checked)} /> sprawozdanie</label>
              </div>
            </div>
            <XYChart {...chart} ariaLabel="Charakterystyki prądowo-napięciowe" />
            <Legend items={legend} />
            <p className="note">
              {mode === 'series' && 'Konstrukcja graficzna: przy stałym prądzie (linia pozioma) dodajemy napięcia UR i UŻ. Linia przerywana – model elementów.'}
              {mode === 'parallel' && 'Konstrukcja graficzna: przy stałym napięciu (linia pionowa) dodajemy prądy IR i IŻ. Linia przerywana – model elementów.'}
              {mode === 'mixed' && 'Najpierw gałąź R ‖ Ż2 (suma prądów), potem dodajemy napięcie Ż1 przy tym samym prądzie. Teoria zakłada Ż1 = Ż2 = Ż z punktów 1 i 2.'}
            </p>
            <div className="result-row three">
              <div className="kpi">
                <span>Punkt pracy</span>
                <b>{fmt(sol.I, 1)} mA</b>
                <small>przy U = {fmt(U, 2)} V</small>
              </div>
              <div className="kpi">
                <span>{mode === 'parallel' ? 'RŻ = U / IŻ' : mode === 'series' ? 'RŻ = UŻ / I' : 'R zastępcza U / I'}</span>
                <b>
                  {sol.I > 0.5
                    ? fmt(mode === 'parallel' ? (sol.U / sol.IB) * 1000 : mode === 'series' ? (sol.UB / sol.I) * 1000 : (sol.U / sol.I) * 1000, 1) + ' Ω'
                    : '–'}
                </b>
                <small>rezystancja statyczna</small>
              </div>
              <div className="kpi">
                <span>{summary?.label ?? 'Zgodność z teorią'}</span>
                <b>{summary?.value ?? '–'}</b>
                <small>{summary?.note ?? 'zapisz pomiary'}</small>
              </div>
            </div>
          </section>

          <section className="card table-card">
            <div className="card-head">
              <h2>Tabela pomiarowa <small>({mode === 'series' ? 'tab. 2' : mode === 'parallel' ? 'tab. 3' : 'tab. 4'})</small></h2>
              <span className="muted-text">{cur.length} / {MODES[mode].steps.length}</span>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  {mode === 'series' && (
                    <tr><th>U, V</th><th>I, mA</th><th>UR, V</th><th>UŻ, V</th><th>UR+UŻ, V</th>{showRef && <th>spraw. I</th>}</tr>
                  )}
                  {mode === 'parallel' && (
                    <tr><th>U, V</th><th>I, mA</th><th>IR, mA</th><th>IŻ, mA</th><th>IR+IŻ, mA</th>{showRef && <th>spraw. I</th>}</tr>
                  )}
                  {mode === 'mixed' && (
                    <tr><th>U, V</th><th>I, mA</th><th>teoria, mA</th>{showRef && <><th>spraw. I</th><th>spraw. teoria</th></>}</tr>
                  )}
                </thead>
                <tbody>
                  {cur.length === 0 && (
                    <tr><td colSpan={7} className="empty">Brak pomiarów – ustaw napięcie i kliknij „Zapisz pomiar” albo uruchom serię.</td></tr>
                  )}
                  {cur.map((r) => {
                    const ref = refFor(r.U)
                    return (
                      <tr key={r.U}>
                        <td>{fmt(r.U, r.U % 1 ? 1 : 0)}</td>
                        <td className="num">{fmt(r.I, 0)}</td>
                        {mode === 'series' && (
                          <>
                            <td className="num">{fmt(r.UR, 1)}</td>
                            <td className="num">{fmt(r.UB, 1)}</td>
                            <td className="num dim">{fmt(r.UR + r.UB, 1)}</td>
                          </>
                        )}
                        {mode === 'parallel' && (
                          <>
                            <td className="num">{fmt(r.IR, 0)}</td>
                            <td className="num">{fmt(r.IB, 0)}</td>
                            <td className="num dim">{fmt(r.IR + r.IB, 0)}</td>
                          </>
                        )}
                        {mode === 'mixed' && <td className="num dim">{fmt(solveMixed(r.U, R, bulb, bulb).I, 0)}</td>}
                        {showRef && <td className="num dim">{ref ? fmt(ref.I, 0) : ''}</td>}
                        {showRef && mode === 'mixed' && <td className="num dim">{ref?.Ith != null ? fmt(ref.Ith, 0) : ref ? '–' : ''}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="controls">
              <button className="btn small" onClick={exportCsv}>⬇ CSV (wszystkie układy)</button>
            </div>
          </section>

          <ParamsCard p={p} setPk={setPk} setP={setP} realism={realism} setRealism={setRealism} />
          <TheoryCard />
        </div>
      ) : (
        <div className="sim-grid">
          <section className="card circuit-card">
            <div className="card-head">
              <h2>Metoda przecięcia charakterystyk</h2>
              <div className="seg">
                <button className={'chip' + (opKind === 'series' ? ' active' : '')} onClick={() => setOpKind('series')}>Szeregowy, zadane U</button>
                <button className={'chip' + (opKind === 'parallel' ? ' active' : '')} onClick={() => setOpKind('parallel')}>Równoległy, zadane I</button>
              </div>
            </div>
            {opKind === 'series' ? <SeriesCircuit s={op.s} /> : <ParallelCircuit s={op.s} />}
            <div className="fields" style={{ marginTop: 14 }}>
              {opKind === 'series' ? (
                <NumField label="Napięcie zasilania U" unit="V" value={opU} onChange={setOpU} min={0.5} max={9} step={0.1} hint="(spraw.: 6 V)" />
              ) : (
                <NumField label="Prąd całkowity I" unit="mA" value={opI} onChange={setOpI} min={10} max={250} step={1} hint="(spraw.: 150 mA)" />
              )}
            </div>
            <p className="note">
              {opKind === 'series'
                ? `Prosta rezystora I = (U − UŻ)/R przecina oś prądu w U/R = ${fmt((opU / R) * 1000, 0)} mA, a oś napięcia w U = ${fmt(opU, 1)} V. Jej przecięcie z charakterystyką żarówki to punkt pracy P.`
                : `Prosta IŻ = I − U/R przecina oś prądu w I = ${fmt(opI, 0)} mA, a oś napięcia w I·R = ${fmt((opI * R) / 1000, 2)} V.`}
            </p>
          </section>
          <section className="card chart-card">
            <div className="card-head">
              <h2>{opKind === 'series' ? `Punkt pracy układu szeregowego (U = ${fmt(opU, 1)} V)` : `Punkt pracy układu równoległego (I = ${fmt(opI, 0)} mA)`}</h2>
              <div className="toggles">
                <label><input type="checkbox" checked={showRef} onChange={(e) => setShowRef(e.target.checked)} /> sprawozdanie</label>
              </div>
            </div>
            <XYChart {...op.chart} ariaLabel="Wyznaczanie punktu pracy" />
            <Legend items={op.legend} />
          </section>
          <section className="card summary-card span-all">
            <div className="card-head">
              <h2>Wyniki metody przecięcia <small>(tabela 5 i 6)</small></h2>
            </div>
            <div className="table-wrap">
              <table className="data summary">
                <thead>
                  <tr><th>Wielkość</th><th>Jedn.</th><th>Symulator (model)</th><th>Spraw. – z wykresu</th><th>Spraw. – z pomiaru</th></tr>
                </thead>
                <tbody>
                  {op.rows.map((r) => (
                    <tr key={r[0]}>
                      <td>{r[0]}</td>
                      <td>{r[1]}</td>
                      <td className="num">{r[2]}</td>
                      <td className="num dim">{r[3]}</td>
                      <td className="num dim">{r[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {opKind === 'series' && (
              <p className="note">
                * W sprawozdaniu rd policzono z sąsiednich punktów pomiarowych (2,7 V; 75 mA) i (4,1 V; 90 mA), co daje przybliżenie ~93 Ω.
                Symulator liczy rd z pochodnej charakterystyki w punkcie P (nachylenie stycznej).
              </p>
            )}
          </section>
          <ParamsCard p={p} setPk={setPk} setP={setP} realism={realism} setRealism={setRealism} compact />
        </div>
      )}
    </div>
  )
}

function ParamsCard({ p, setPk, setP, realism, setRealism, compact }) {
  return (
    <section className={'card params-card' + (compact ? ' span-all' : '')}>
      <div className="card-head">
        <h2>Parametry elementów</h2>
        <button className="btn ghost small" onClick={() => setP(DEFAULTS)}>Domyślne</button>
      </div>
      <div className="fields">
        <NumField label="Rezystor R" unit="Ω" value={p.R} onChange={setPk('R')} min={5} max={100} step={1} />
        <NumField label="Żarówka: współczynnik a" unit="mA/Vⁿ" value={p.a} onChange={setPk('a')} min={10} max={100} step={0.1} hint="I = a·Uⁿ" />
        <NumField label="Żarówka: wykładnik n" unit="" value={p.n} onChange={setPk('n')} min={0.3} max={1} step={0.005} hint="(n = 1 → liniowa)" />
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={p.mixedOther} onChange={(e) => setPk('mixedOther')(e.target.checked)} />
            Ż1, Ż2 w układzie mieszanym inne niż Ż (jak w pomiarze)
          </label>
          <NumField label="Krotność prądu Ż1, Ż2" unit="×" value={p.k} onChange={setPk('k')} min={1} max={2.5} step={0.01} disabled={!p.mixedOther} />
        </div>
      </div>
      {!compact && (
        <div className="subsection">
          <h3>Realizm pomiaru</h3>
          <label className="check">
            <input type="checkbox" checked={realism} onChange={(e) => setRealism(e.target.checked)} />
            Błędy odczytu mierników analogowych kl. 0,5 (V: działka 0,1 V / 0,2 V, A: odczyt co 1 mA)
          </label>
        </div>
      )}
      <p className="note">
        Domyślny model żarówki (a = 42,17 mA/Vⁿ, n = 0,556) dopasowano do charakterystyki żarówki z tabel 2 i 3 sprawozdania.
        Krotność 1,58 dla Ż1, Ż2 odtwarza pomiar układu mieszanego (tabela 4) – zgodnie z wnioskiem nr 7, że użyto tam innych żarówek.
        Zmiana parametrów kasuje pomiary.
      </p>
    </section>
  )
}

function TheoryCard() {
  return (
    <section className="card theory-card">
      <details>
        <summary><h2>Teoria i przyrządy</h2></summary>
        <div className="theory-grid">
          <div>
            <p>
              Element nieliniowy (żarówka) nie ma stałej rezystancji – w każdym punkcie pracy wyznacza się rezystancję statyczną
              i dynamiczną:
            </p>
            <p className="eq">R = U / I, &nbsp; r<sub>d</sub> = ΔU / ΔI</p>
            <p>
              Włókno metalowe nagrzewa się, a rezystancja metalu rośnie z temperaturą, dlatego charakterystyka żarówki „kładzie się”
              w stronę osi napięcia, a r<sub>d</sub> &gt; R.
            </p>
            <p>
              <b>Połączenie szeregowe</b> (II prawo Kirchhoffa): przy tym samym prądzie U = U<sub>R</sub> + U<sub>Ż</sub>.
              <br />
              <b>Połączenie równoległe</b> (I prawo Kirchhoffa): przy tym samym napięciu I = I<sub>R</sub> + I<sub>Ż</sub>.
              <br />
              <b>Połączenie mieszane</b>: redukujemy kolejno gałąź równoległą R ‖ Ż2, a potem dodajemy szeregowo Ż1.
            </p>
            <p>
              <b>Metoda przecięcia:</b> prosta „obciążenia” rezystora I = (U − U<sub>Ż</sub>)/R przecięta z charakterystyką żarówki
              daje punkt pracy układu szeregowego bez rysowania charakterystyki zastępczej.
            </p>
          </div>
          <div>
            <table className="data small">
              <thead><tr><th>Przyrząd</th><th>Typ</th><th>Nr</th><th>Zakres, klasa</th></tr></thead>
              <tbody>
                {REPORT.instruments.map((r, k) => (
                  <tr key={k}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <p className="note">Model żarówki: I = a · Uⁿ (statyczny – bez bezwładności cieplnej włókna). Mierniki traktowane jako idealne (bez poboru prądu przez woltomierze i spadku na amperomierzach).</p>
          </div>
        </div>
      </details>
    </section>
  )
}
