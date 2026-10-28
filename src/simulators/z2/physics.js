// Model obwodu RC dla ćwiczenia Z2 – stany nieustalone.
// Jednostki SI: V, Ω, F, s, A.

export const MODES = {
  'charge-i': { label: '3.1 Prąd ładowania', short: 'Prąd ładowania', quantity: 'i', unit: 'µA', fig: 'rys. 6' },
  'charge-u': { label: '3.2 Napięcie (ładowanie)', short: 'Napięcie uC', quantity: 'uC', unit: 'V', fig: 'rys. 7' },
  discharge: { label: '3.3 Prąd rozładowania', short: 'Prąd rozładowania', quantity: '|i|', unit: 'µA', fig: 'rys. 8' },
}

const parallel = (a, b) => (!isFinite(a) ? b : !isFinite(b) ? a : (a * b) / (a + b))

/**
 * Buduje model obwodu dla danego układu pomiarowego.
 * p: { U, R, C, Ra, Rv, Rleak } – wartości rzeczywiste elementów (SI).
 */
export function buildModel(mode, p) {
  const { U, R, C, Ra, Rv, Rleak } = p

  if (mode === 'discharge') {
    // Przed t=0: kondensator naładowany do U, przez R i µA płynie U/(R+Ra).
    // Po otwarciu W: C rozładowuje się przez R + Ra (i ewentualny upływ).
    const Rd = R + Ra
    const tau = parallel(Rd, Rleak) * C
    return {
      tau,
      I0: U / Rd,
      uInf: 0,
      at(t) {
        if (t === null || t < 0) return { uC: U, i: U / Rd }
        const uC = U * Math.exp(-t / tau)
        return { uC, i: uC / Rd }
      },
    }
  }

  // Ładowanie: rezystancja szeregowa i rezystancja bocznikująca C
  // (woltomierz tylko w układzie 3.2, upływ kondensatora w obu).
  const Rser = mode === 'charge-i' ? R + Ra : R
  const Rp = mode === 'charge-u' ? parallel(Rv, Rleak) : Rleak
  const uInf = isFinite(Rp) ? (U * Rp) / (Rser + Rp) : U
  const tau = parallel(Rser, Rp) * C
  return {
    tau,
    I0: U / Rser,
    uInf,
    at(t) {
      // Przed t=0 łącznik W zwiera kondensator: uC = 0, prąd płynie przez W.
      if (t === null || t < 0) return { uC: 0, i: U / Rser }
      const uC = uInf * (1 - Math.exp(-t / tau))
      return { uC, i: (U - uC) / Rser }
    },
  }
}

/** Wartość mierzona w danym układzie (µA lub V). */
export function measured(mode, state) {
  return mode === 'charge-u' ? state.uC : state.i * 1e6
}

export function gauss() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Odczyt przyrządu – z błędem odczytu (realism) lub idealny. */
export function readInstrument(mode, value, realism) {
  if (mode === 'charge-u') {
    // Woltomierz cyfrowy, rozdzielczość 0,01 V
    const v = realism ? value + gauss() * 0.01 : value
    return Math.max(0, Math.round(v * 100) / 100)
  }
  // Mikroamperomierz analogowy kl. 0,5, zakres 75 µA (Δ = 0,375 µA)
  if (!realism) return Math.max(0, Math.round(value * 100) / 100)
  const v = value + gauss() * 0.375 / 3
  const step = v >= 2 ? 1 : 0.2
  return Math.max(0, Math.round(v / step) * step)
}

/** Stała czasowa z wykresu – odczyt czasu, przy którym przebieg przecina poziom 0,368 / 0,632. */
export function tauFromGraph(mode, points, uSteady) {
  if (points.length < 2) return null
  const pts = [...points].sort((a, b) => a.t - b.t)
  const rising = mode === 'charge-u'
  const level = rising ? 0.632 * uSteady : 0.368 * pts[0].v
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k]
    const b = pts[k + 1]
    const crosses = rising ? a.v <= level && b.v >= level : a.v >= level && b.v <= level
    if (crosses && b.v !== a.v) {
      return { tau: a.t + ((level - a.v) * (b.t - a.t)) / (b.v - a.v), level }
    }
  }
  return { tau: null, level }
}

/** Stała czasowa z regresji liniowej ln(y) = a − t/τ. */
export function tauFromRegression(mode, points, uSteady) {
  const pts = [...points].sort((a, b) => a.t - b.t)
  if (pts.length < 3) return null
  const rising = mode === 'charge-u'
  const y0 = rising ? uSteady : pts[0].v
  const data = pts
    .map((p) => ({ t: p.t, y: rising ? 1 - p.v / uSteady : p.v / y0 }))
    .filter((p) => p.y > 0.03 && p.y <= 1.0001)
    .map((p) => ({ t: p.t, y: Math.log(p.y) }))
  if (data.length < 3) return null
  const n = data.length
  const st = data.reduce((s, p) => s + p.t, 0)
  const sy = data.reduce((s, p) => s + p.y, 0)
  const stt = data.reduce((s, p) => s + p.t * p.t, 0)
  const sty = data.reduce((s, p) => s + p.t * p.y, 0)
  const slope = (n * sty - st * sy) / (n * stt - st * st)
  return slope < 0 ? -1 / slope : null
}

export function buildSchedule(kind, step, duration) {
  if (kind === 'instr') return [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90]
  const out = []
  for (let t = 0; t <= duration + 1e-9; t += step) out.push(Math.round(t * 100) / 100)
  return out
}
