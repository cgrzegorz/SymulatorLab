// Model obwodów nieliniowych prądu stałego dla ćwiczenia Z3.
// Prądy w mA, napięcia w V, rezystancje w Ω.
//
// Żarówka: model potęgowy I = a · U^n dopasowany (regresja w skali log-log) do charakterystyki
// żarówki z tabel 2 i 3 sprawozdania: a ≈ 42,2 mA, n ≈ 0,556. Model odtwarza punkt pracy
// U = 6 V (84,3 mA, UŻ = 3,47 V) i teorię połączenia mieszanego z tabeli 4.

import { gauss } from '../z2/physics.js'

export const MODES = {
  series: { label: '1. Szeregowe R + Ż', fig: 'rys. 1', uMax: 9, steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  parallel: { label: '2. Równoległe R ‖ Ż', fig: 'rys. 2', uMax: 4.5, steps: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5] },
  mixed: { label: '3. Mieszane Ż1 + (R ‖ Ż2)', fig: 'rys. 3', uMax: 9, steps: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9] },
  op: { label: '4. Punkt pracy (przecięcie)', fig: 'rys. 7, 8', uMax: 9, steps: [] },
}

export const DEFAULT_BULB = { a: 42.17, n: 0.556 }

export const bulbI = (b, U) => (U <= 0 ? 0 : b.a * Math.pow(U, b.n))
export const bulbU = (b, I) => (I <= 0 ? 0 : Math.pow(I / b.a, 1 / b.n))
/** Rezystancja dynamiczna dU/dI = U / (n·I) dla modelu potęgowego. */
export const bulbRd = (b, U) => (U <= 0 ? Infinity : (U / (b.n * bulbI(b, U))) * 1000)

function bisect(f, lo, hi) {
  for (let k = 0; k < 70; k++) {
    const m = (lo + hi) / 2
    if (f(m) > 0) hi = m
    else lo = m
  }
  return (lo + hi) / 2
}

/** Połączenie szeregowe: U = UR + UŻ przy tym samym prądzie. */
export function solveSeries(U, R, b) {
  if (U <= 0) return { U: 0, I: 0, UR: 0, UB: 0 }
  const UB = bisect((x) => x + (bulbI(b, x) * R) / 1000 - U, 0, U)
  const I = bulbI(b, UB)
  return { U, I, UR: (I * R) / 1000, UB }
}

/** Połączenie równoległe: I = IR + IŻ przy tym samym napięciu. */
export function solveParallel(U, R, b) {
  const IR = U > 0 ? (U / R) * 1000 : 0
  const IB = bulbI(b, U)
  return { U, I: IR + IB, IR, IB }
}

/** Równoległe przy zadanym prądzie całkowitym (punkt pracy rys. 8). */
export function solveParallelForI(I, R, b) {
  if (I <= 0) return solveParallel(0, R, b)
  const U = bisect((x) => (x / R) * 1000 + bulbI(b, x) - I, 0, (I * R) / 1000)
  return solveParallel(U, R, b)
}

/** Połączenie mieszane Ż1 + (R ‖ Ż2). */
export function solveMixed(U, R, b1, b2) {
  if (U <= 0) return { U: 0, I: 0, U1: 0, Up: 0, IR: 0, I2: 0 }
  const Up = bisect((x) => x + bulbU(b1, (x / R) * 1000 + bulbI(b2, x)) - U, 0, U)
  const IR = (Up / R) * 1000
  const I2 = bulbI(b2, Up)
  const I = IR + I2
  return { U, I, U1: U - Up, Up, IR, I2 }
}

/** Odczyt miernika analogowego kl. 0,5: szum ~ klasa, zaokrąglenie do ułamka działki. */
export function readAnalog(value, range, resolution, realism) {
  if (value <= 0) return 0
  if (!realism) return Math.round(value * 100) / 100
  const v = value + (gauss() * 0.005 * range) / 2
  return Math.max(0, Math.round(v / resolution) * resolution)
}

/** Zakresy przyrządów z tabeli 1. */
export const voltRange = (U) => (U <= 7.5 ? 7.5 : 15)
export const readV = (U, realism) => readAnalog(U, voltRange(U), voltRange(U) === 7.5 ? 0.1 : 0.2, realism)
export const readI = (I, realism) => readAnalog(I, 300, 1, realism)
