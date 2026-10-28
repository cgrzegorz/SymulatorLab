import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Chart, { niceMax } from '../../components/Chart.jsx'
import { AnalogMeter, DigitalMeter, Stopwatch } from '../../components/Meters.jsx'
import CircuitDiagram from './CircuitDiagram.jsx'
import {
  MODES,
  buildModel,
  buildSchedule,
  gauss,
  measured,
  readInstrument,
  tauFromGraph,
  tauFromRegression,
} from './physics.js'
import { REPORT } from './reportData.js'
import { fmt, signed } from '../../utils.js'

const DEFAULTS = { U: 29.6, R: 510, C: 30, Ra: 1, Rv: 10, leakOn: false, Rleak: 50 }
const SPEEDS = [1, 2, 5, 10, 20]

const freshRun = () => ({ t: 0, started: false, running: false, done: false, points: [], nextIdx: 0, needle: 0, phase: 0 })
const freshRuns = () => ({ 'charge-i': freshRun(), 'charge-u': freshRun(), discharge: freshRun() })

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
            if (!Number.isNaN(v) && v > 0) onChange(v)
          }}
        />
        <span className="unit">{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  )
}

export default function Z2Simulator() {
  const [mode, setMode] = useState('charge-i')
  const [params, setParams] = useState(DEFAULTS)
  const [tol, setTol] = useState({ on: false, kR: 1, kC: 1, reveal: false })
  const [realism, setRealism] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [sched, setSched] = useState({ kind: 'instr', step: 5, duration: 90 })
  const [showRef, setShowRef] = useState(true)
  const [showTheory, setShowTheory] = useState(true)
  const [, rerender] = useReducer((x) => x + 1, 0)
  const runsRef = useRef(freshRuns())

  const actual = useMemo(
    () => ({
      U: params.U,
      R: params.R * 1e3 * (tol.on ? tol.kR : 1),
      C: params.C * 1e-6 * (tol.on ? tol.kC : 1),
      Ra: params.Ra * 1e3,
      Rv: params.Rv * 1e6,
      Rleak: params.leakOn ? params.Rleak * 1e6 : Infinity,
    }),
    [params, tol.on, tol.kR, tol.kC],
  )
  const nominal = useMemo(() => ({ ...actual, R: params.R * 1e3, C: params.C * 1e-6 }), [actual, params.R, params.C])
  const tauTheory = params.R * 1e3 * params.C * 1e-6

  const model = useMemo(() => buildModel(mode, actual), [mode, actual])
  const nomModel = useMemo(() => buildModel(mode, nominal), [mode, nominal])
  const schedule = useMemo(() => buildSchedule(sched.kind, sched.step, sched.duration), [sched])
  const tEnd = schedule[schedule.length - 1] + 5

  // Zmiana obwodu lub harmonogramu unieważnia dotychczasowe pomiary.
  useEffect(() => {
    runsRef.current = freshRuns()
    rerender()
  }, [actual, schedule])

  const cfg = useRef()
  cfg.current = { mode, model, schedule, realism, speed, tEnd }

  // Pętla symulacji (requestAnimationFrame): czas, odczyty, wskazówka miernika, animacja prądu.
  useEffect(() => {
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const c = cfg.current
      const s = runsRef.current[c.mode]
      if (s.running) {
        s.t += dt * c.speed
        while (s.nextIdx < c.schedule.length && c.schedule[s.nextIdx] <= s.t) {
          const ts = c.schedule[s.nextIdx]
          // Odczyt w chwili "ts" z błędem refleksu przy stoperze (σ ≈ 0,25 s)
          const tr = c.realism ? Math.max(0, ts + gauss() * 0.25) : ts
          s.points.push({ t: ts, v: readInstrument(c.mode, measured(c.mode, c.model.at(tr)), c.realism) })
          s.nextIdx++
        }
        if (s.t >= c.tEnd) {
          s.t = c.tEnd
          s.running = false
          s.done = true
        }
      }
      const st = c.model.at(s.started ? s.t : null)
      const target = st.i * 1e6
      s.needle += (target - s.needle) * (1 - Math.exp(-dt / 0.18))
      const frozen = s.started && !s.running
      if (!frozen) s.phase += dt * 70 * Math.min(1.2, st.i / c.model.I0) * (s.started ? Math.sqrt(c.speed) : 1)
      rerender()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const run = runsRef.current[mode]
  const state = model.at(run.started ? run.t : null)
  const isCurrent = mode !== 'charge-u'
  const uSteady = Math.round(model.uInf * 100) / 100

  const start = () => {
    if (run.done) return
    if (!run.started) {
      run.started = true
      run.t = 0
    }
    run.running = true
  }
  const pause = () => (run.running = false)
  const reset = () => {
    runsRef.current[mode] = { ...freshRun(), needle: run.needle }
  }
  const resetAll = () => {
    runsRef.current = freshRuns()
  }
  const manualRead = () => {
    if (!run.started) return
    const t = Math.round(run.t * 10) / 10
    run.points.push({ t, v: readInstrument(mode, measured(mode, model.at(t)), realism), manual: true })
  }
  const drawTolerance = () => {
    // R: tolerancja ±5%, kondensator elektrolityczny: typowo −10%…+20%
    const kR = 1 + (Math.random() * 2 - 1) * 0.05
    const kC = 1 + (Math.random() * 0.3 - 0.1)
    setTol({ on: true, kR, kC, reveal: false })
  }

  const setP = (k) => (v) => setParams((p) => ({ ...p, [k]: v }))

  // Wyniki dla bieżącego trybu
  const pts = [...run.points].sort((a, b) => a.t - b.t)
  const graph = tauFromGraph(mode, pts, uSteady)
  const reg = tauFromRegression(mode, pts, uSteady)
  const refPts = REPORT.points[mode]

  const yMax = isCurrent ? niceMax(Math.max(model.I0 * 1e6, nomModel.I0 * 1e6, showRef ? 58 : 0) * 1.08) : niceMax(Math.max(params.U, showRef ? 29 : 0) * 1.05)
  const theoryFn = isCurrent
    ? (t) => (pts[0]?.v ?? nomModel.I0 * 1e6) * Math.exp(-t / tauTheory)
    : (t) => uSteady * (1 - Math.exp(-t / tauTheory))
  const liveFn = (t) => measured(mode, model.at(t))

  const summary = Object.keys(MODES).map((m) => {
    const r = runsRef.current[m]
    const p = [...r.points].sort((a, b) => a.t - b.t)
    const us = Math.round(buildModel(m, actual).uInf * 100) / 100
    const g = tauFromGraph(m, p, us)
    return { m, n: p.length, tau: g?.tau ?? null, reg: tauFromRegression(m, p, us), done: r.done }
  })

  const exportCsv = () => {
    const rows = [['uklad', 't_s', MODES[mode].quantity + '_' + MODES[mode].unit]]
    for (const m of Object.keys(MODES)) {
      for (const p of [...runsRef.current[m].points].sort((a, b) => a.t - b.t)) rows.push([m, p.t, p.v])
    }
    const csv = rows.map((r) => r.join(';')).join('\n').replace(/\./g, ',')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'Z2_pomiary.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const statusText = run.done ? 'Pomiar zakończony' : run.running ? 'Pomiar w toku…' : run.started ? 'Wstrzymano' : 'Gotowy – W zamknięty'

  return (
    <div className="sim">
      <header className="sim-header">
        <div>
          <div className="crumbs">Elektrotechnika / Ćwiczenie Z2</div>
          <h1>Stany nieustalone w obwodach RC</h1>
          <p className="lead">
            Ładowanie i rozładowanie kondensatora przez rezystor. Otwórz łącznik <b>W</b> w chwili t = 0, rejestruj wskazania
            przyrządów co 5 s i wyznacz stałą czasową τ z wykresu.
          </p>
        </div>
        <div className="formula-card">
          <div>τ = R · C = {fmt(params.R, 0)} kΩ · {fmt(params.C, 1)} µF</div>
          <div className="big">τ = {fmt(tauTheory, 2)} s</div>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {Object.entries(MODES).map(([k, m]) => (
          <button key={k} role="tab" aria-selected={mode === k} className={'tab' + (mode === k ? ' active' : '')} onClick={() => setMode(k)}>
            {m.label}
            {runsRef.current[k].done && <span className="tab-done">✓</span>}
          </button>
        ))}
      </nav>

      <div className="sim-grid">
        <section className="card circuit-card">
          <div className="card-head">
            <h2>Układ pomiarowy <small>({MODES[mode].fig} z instrukcji)</small></h2>
            <span className={'status' + (run.running ? ' live' : run.done ? ' done' : '')}>{statusText}</span>
          </div>
          <CircuitDiagram
            mode={mode}
            closed={!run.started}
            uC={state.uC}
            U={params.U}
            i={state.i}
            iRef={model.I0}
            phase={run.phase}
            onSwitch={start}
          />
          <div className="meters">
            {isCurrent ? <AnalogMeter value={run.needle} /> : <DigitalMeter value={state.uC} />}
            <Stopwatch t={run.t} started={run.started} />
          </div>
          <div className="controls">
            {!run.running ? (
              <button className="btn primary" onClick={start} disabled={run.done}>
                {run.started ? '▶ Wznów' : '▶ Otwórz W (t = 0)'}
              </button>
            ) : (
              <button className="btn" onClick={pause}>⏸ Pauza</button>
            )}
            <button className="btn" onClick={manualRead} disabled={!run.started || run.done}>✎ Odczyt teraz</button>
            <button className="btn ghost" onClick={reset}>↺ Od nowa</button>
            <div className="speed">
              <span title="×1 = czas rzeczywisty. Przyspieszenie nie zmienia wyników – stoper i wykres pokazują czas obwodu.">Przyspieszenie czasu</span>
              {SPEEDS.map((s) => (
                <button key={s} className={'chip' + (speed === s ? ' active' : '')} onClick={() => setSpeed(s)}>{s === 1 ? "×1 (rzeczywisty)" : `×${s}`}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="card chart-card">
          <div className="card-head">
            <h2>
              {isCurrent ? (mode === 'discharge' ? 'Prąd rozładowania |i|(t)' : 'Prąd ładowania i(t)') : 'Napięcie na kondensatorze uC(t)'}
            </h2>
            <div className="toggles">
              <label><input type="checkbox" checked={showTheory} onChange={(e) => setShowTheory(e.target.checked)} /> teoria</label>
              <label><input type="checkbox" checked={showRef} onChange={(e) => setShowRef(e.target.checked)} /> sprawozdanie</label>
            </div>
          </div>
          <Chart
            xMax={Math.max(90, schedule[schedule.length - 1])}
            yMax={yMax}
            yLabel={isCurrent ? (mode === 'discharge' ? '|i| [µA]' : 'i [µA]') : 'uC [V]'}
            theory={showTheory ? theoryFn : null}
            live={run.started ? liveFn : null}
            liveT={run.t}
            points={pts}
            refPoints={showRef ? refPts : null}
            level={graph?.level ?? null}
            tauRead={graph?.tau ?? null}
            levelLabel={isCurrent ? `0,368 · I₀ = ${fmt(graph?.level, 2)} µA` : `0,632 · UC ust = ${fmt(graph?.level, 2)} V`}
          />
          <div className="legend">
            <span><i className="lg theory" /> teoria (τ = {fmt(tauTheory, 1)} s)</span>
            <span><i className="lg live" /> przebieg w obwodzie</span>
            <span><i className="lg meas" /> pomiar (symulacja)</span>
            {showRef && <span><i className="lg ref" /> pomiar ze sprawozdania</span>}
          </div>
          <div className="result-row">
            <div className="kpi">
              <span>τ z wykresu</span>
              <b>{graph?.tau != null ? `${fmt(graph.tau, 1)} s` : '–'}</b>
              <small>{graph?.tau != null ? `${signed(((graph.tau - tauTheory) / tauTheory) * 100)}% vs RC` : 'za mało punktów'}</small>
            </div>
            <div className="kpi">
              <span>τ z regresji ln</span>
              <b>{reg != null ? `${fmt(reg, 1)} s` : '–'}</b>
              <small>{reg != null ? `${signed(((reg - tauTheory) / tauTheory) * 100)}% vs RC` : '≥ 3 punkty'}</small>
            </div>
            <div className="kpi">
              <span>{isCurrent ? 'I₀ (pierwszy odczyt)' : 'UC ust'}</span>
              <b>{isCurrent ? (pts[0] ? `${fmt(pts[0].v, 1)} µA` : '–') : `${fmt(uSteady, 2)} V`}</b>
              <small>{isCurrent ? `U/R = ${fmt(model.I0 * 1e6, 1)} µA` : `zasilanie ${fmt(params.U, 2)} V`}</small>
            </div>
            <div className="kpi muted">
              <span>sprawozdanie</span>
              <b>{fmt(REPORT.tauGraph[mode], 1)} s</b>
              <small>{signed(((REPORT.tauGraph[mode] - REPORT.tauTheory) / REPORT.tauTheory) * 100)}%</small>
            </div>
          </div>
        </section>

        <section className="card table-card">
          <div className="card-head">
            <h2>Tabela pomiarów</h2>
            <span className="muted-text">{pts.length} / {schedule.length} odczytów</span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>t, s</th>
                  <th>{MODES[mode].quantity}, {MODES[mode].unit}</th>
                  <th>teoria</th>
                  {showRef && <th>spraw.</th>}
                </tr>
              </thead>
              <tbody>
                {schedule.map((t) => {
                  const p = pts.find((q) => q.t === t && !q.manual)
                  const r = refPts.find((q) => q.t === t)
                  return (
                    <tr key={t} className={p ? '' : 'pending'}>
                      <td>{fmt(t, 0)}</td>
                      <td className="num">{p ? fmt(p.v, isCurrent ? 1 : 2) : '·'}</td>
                      <td className="num dim">{fmt(theoryFn(t), isCurrent ? 1 : 2)}</td>
                      {showRef && <td className="num dim">{r ? fmt(r.v, isCurrent ? 1 : 2) : ''}</td>}
                    </tr>
                  )
                })}
                {pts.filter((p) => p.manual).map((p, k) => (
                  <tr key={'m' + k} className="manual">
                    <td>{fmt(p.t, 1)} ✎</td>
                    <td className="num">{fmt(p.v, isCurrent ? 1 : 2)}</td>
                    <td className="num dim">{fmt(theoryFn(p.t), isCurrent ? 1 : 2)}</td>
                    {showRef && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card params-card">
          <div className="card-head">
            <h2>Parametry obwodu</h2>
            <button className="btn ghost small" onClick={() => { setParams(DEFAULTS); setTol({ on: false, kR: 1, kC: 1, reveal: false }) }}>Domyślne</button>
          </div>
          <div className="fields">
            <NumField label="Napięcie zasilania U" unit="V" value={params.U} onChange={setP('U')} min={1} max={30} step={0.1} />
            <NumField label="Rezystancja R" unit="kΩ" value={params.R} onChange={setP('R')} min={10} max={1000} step={1} />
            <NumField label="Pojemność C" unit="µF" value={params.C} onChange={setP('C')} min={1} max={100} step={0.5} />
            <NumField label="Rezystancja µA" unit="kΩ" value={params.Ra} onChange={setP('Ra')} min={0.1} max={20} step={0.1} hint="(3.1, 3.3)" />
            <NumField label="Rezystancja woltomierza" unit="MΩ" value={params.Rv} onChange={setP('Rv')} min={1} max={100} step={1} hint="(3.2)" />
            <div className="field">
              <label className="check">
                <input type="checkbox" checked={params.leakOn} onChange={(e) => setP('leakOn')(e.target.checked)} /> Upływ kondensatora
              </label>
              <NumField label="Rezystancja upływu" unit="MΩ" value={params.Rleak} onChange={setP('Rleak')} min={1} max={500} step={1} disabled={!params.leakOn} />
            </div>
          </div>

          <div className="subsection">
            <h3>Realizm pomiaru</h3>
            <label className="check">
              <input type="checkbox" checked={realism} onChange={(e) => setRealism(e.target.checked)} />
              Błędy odczytu (refleks przy stoperze ±0,25 s, odczyt wskazówki, klasa 0,5)
            </label>
            <div className="tol-row">
              <button className="btn small" onClick={drawTolerance}>🎲 Losuj rzeczywiste elementy</button>
              {tol.on && (
                <>
                  <button className="btn ghost small" onClick={() => setTol((t) => ({ ...t, reveal: !t.reveal }))}>
                    {tol.reveal ? 'Ukryj' : 'Pokaż'} wartości
                  </button>
                  <button className="btn ghost small" onClick={() => setTol({ on: false, kR: 1, kC: 1, reveal: false })}>Nominalne</button>
                </>
              )}
            </div>
            {tol.on && (
              <p className="note">
                {tol.reveal
                  ? `Rzeczywiste: R = ${fmt(actual.R / 1e3, 1)} kΩ (${signed((tol.kR - 1) * 100)}%), C = ${fmt(actual.C * 1e6, 2)} µF (${signed((tol.kC - 1) * 100)}%), τ_rz = ${fmt(actual.R * actual.C, 2)} s`
                  : 'Elementy mają ukryte odchyłki od wartości znamionowych (R ±5%, C −10…+20%). Zmierz τ i porównaj!'}
              </p>
            )}
          </div>

          <div className="subsection">
            <h3>Harmonogram odczytów</h3>
            <div className="seg">
              <button className={'chip' + (sched.kind === 'instr' ? ' active' : '')} onClick={() => setSched((s) => ({ ...s, kind: 'instr' }))}>Jak w instrukcji</button>
              <button className={'chip' + (sched.kind === 'uniform' ? ' active' : '')} onClick={() => setSched((s) => ({ ...s, kind: 'uniform' }))}>Równomierny</button>
            </div>
            {sched.kind === 'uniform' && (
              <div className="fields two">
                <NumField label="Krok" unit="s" value={sched.step} onChange={(v) => setSched((s) => ({ ...s, step: v }))} min={1} max={30} step={1} />
                <NumField label="Czas pomiaru" unit="s" value={sched.duration} onChange={(v) => setSched((s) => ({ ...s, duration: v }))} min={20} max={300} step={5} />
              </div>
            )}
            <p className="note">Zmiana parametrów lub harmonogramu kasuje wykonane pomiary.</p>
          </div>

          <div className="model-info">
            <div><span>τ modelu ({MODES[mode].short})</span><b>{fmt(model.tau, 2)} s</b></div>
            <div><span>Prąd początkowy</span><b>{fmt(model.I0 * 1e6, 2)} µA</b></div>
            <div><span>Napięcie ustalone uC</span><b>{fmt(mode === 'discharge' ? 0 : model.uInf, 2)} V</b></div>
          </div>
        </section>

        <section className="card summary-card">
          <div className="card-head">
            <h2>Zestawienie wyników <small>(tabela 5)</small></h2>
            <div className="toggles">
              <button className="btn small" onClick={exportCsv}>⬇ CSV</button>
              <button className="btn ghost small" onClick={resetAll}>Wyczyść wszystko</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data summary">
              <thead>
                <tr>
                  <th>Pomiar</th>
                  <th>τ z wykresu, s</th>
                  <th>τ z regresji, s</th>
                  <th>τ teoret., s</th>
                  <th>Różnica, %</th>
                  <th>Sprawozdanie, s</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((r) => (
                  <tr key={r.m} className={r.m === mode ? 'current' : ''} onClick={() => setMode(r.m)}>
                    <td>{MODES[r.m].label} {r.done ? '✓' : r.n ? `(${r.n} pkt)` : ''}</td>
                    <td className="num">{fmt(r.tau, 1)}</td>
                    <td className="num">{fmt(r.reg, 1)}</td>
                    <td className="num">{fmt(tauTheory, 1)}</td>
                    <td className="num">{r.tau != null ? signed(((r.tau - tauTheory) / tauTheory) * 100) : '–'}</td>
                    <td className="num dim">{fmt(REPORT.tauGraph[r.m], 1)} ({signed(((REPORT.tauGraph[r.m] - REPORT.tauTheory) / REPORT.tauTheory) * 100)}%)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card theory-card">
          <details>
            <summary><h2>Teoria i przyrządy</h2></summary>
            <div className="theory-grid">
              <div>
                <p>Podczas ładowania kondensatora przez rezystor ze źródła o napięciu U:</p>
                <p className="eq">i(t) = U/R · e<sup>−t/τ</sup>, &nbsp; u<sub>C</sub>(t) = U · (1 − e<sup>−t/τ</sup>), &nbsp; τ = R·C</p>
                <p>Podczas rozładowania: u<sub>C</sub>(t) = U · e<sup>−t/τ</sup>, |i(t)| = U/R · e<sup>−t/τ</sup>.</p>
                <p>
                  Po czasie t = τ prąd maleje do <b>0,368</b> wartości początkowej, a napięcie rośnie do <b>0,632</b> wartości ustalonej –
                  to pozwala odczytać τ z wykresu. Po ok. 5τ stan przejściowy praktycznie się kończy.
                </p>
                <p>
                  W układzie 3.2 woltomierz (R<sub>V</sub>) jest dołączony równolegle do C, więc napięcie ustalone wynosi
                  U · R<sub>V</sub>/(R + R<sub>V</sub>), a stała czasowa (R ∥ R<sub>V</sub>)·C – dlatego w sprawozdaniu U<sub>C ust</sub> = 28,35 V jest mniejsze od zasilania.
                </p>
              </div>
              <div>
                <table className="data small">
                  <thead><tr><th>Przyrząd</th><th>Typ</th><th>Nr</th><th>Zakres, klasa</th></tr></thead>
                  <tbody>
                    {REPORT.instruments.map((r) => (
                      <tr key={r[0]}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
                <p className="note">Błąd graniczny mikroamperomierza kl. 0,5 na zakresie 75 µA: Δi = 0,5 · 75 µA / 100 = 0,375 µA.</p>
              </div>
            </div>
          </details>
        </section>
      </div>
    </div>
  )
}
