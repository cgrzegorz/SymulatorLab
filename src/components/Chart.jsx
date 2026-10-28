import { fmt } from '../utils.js'

function niceStep(range, target = 6) {
  const raw = range / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / mag
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag
}

export function niceMax(v) {
  if (v <= 0) return 1
  const s = niceStep(v)
  return Math.ceil(v / s) * s
}

const W = 680
const H = 380
const M = { l: 58, r: 18, t: 18, b: 48 }
const PW = W - M.l - M.r
const PH = H - M.t - M.b

/**
 * Wykres przebiegu czasowego: krzywa teoretyczna, przebieg modelu (do chwili t),
 * punkty pomiarowe, punkty ze sprawozdania oraz odczyt stałej czasowej.
 */
export default function Chart({ xMax, yMax, yLabel, theory, live, liveT, points, refPoints, level, tauRead, levelLabel }) {
  const x = (t) => M.l + (t / xMax) * PW
  const y = (v) => M.t + PH - (Math.min(v, yMax * 1.02) / yMax) * PH
  const xs = niceStep(xMax, 9)
  const ys = niceStep(yMax, 6)
  const xticks = []
  for (let t = 0; t <= xMax + 1e-9; t += xs) xticks.push(t)
  const yticks = []
  for (let v = 0; v <= yMax + 1e-9; v += ys) yticks.push(v)

  const curve = (fn, t1) => {
    const n = 240
    let d = ''
    for (let k = 0; k <= n; k++) {
      const t = (k / n) * t1
      d += `${k ? 'L' : 'M'}${x(t).toFixed(1)} ${y(fn(t)).toFixed(1)}`
    }
    return d
  }

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Wykres ${yLabel} w funkcji czasu`}>
      <rect x={M.l} y={M.t} width={PW} height={PH} className="chart-bg" />
      {xticks.map((t) => (
        <g key={'x' + t}>
          <line x1={x(t)} x2={x(t)} y1={M.t} y2={M.t + PH} className="grid" />
          <text x={x(t)} y={M.t + PH + 18} className="tick" textAnchor="middle">{fmt(t, 0)}</text>
        </g>
      ))}
      {yticks.map((v) => (
        <g key={'y' + v}>
          <line x1={M.l} x2={M.l + PW} y1={y(v)} y2={y(v)} className="grid" />
          <text x={M.l - 8} y={y(v) + 4} className="tick" textAnchor="end">{fmt(v, ys < 1 ? 1 : 0)}</text>
        </g>
      ))}
      <text x={M.l + PW / 2} y={H - 8} className="axis-label" textAnchor="middle">t [s]</text>
      <text x={16} y={M.t + PH / 2} className="axis-label" textAnchor="middle" transform={`rotate(-90 16 ${M.t + PH / 2})`}>{yLabel}</text>

      {theory && <path d={curve(theory, xMax)} className="theory" />}
      {live && liveT > 0 && <path d={curve(live, Math.min(liveT, xMax))} className="live" />}

      {level != null && (
        <g>
          <line x1={M.l} x2={M.l + PW} y1={y(level)} y2={y(level)} className="level" />
          <text x={M.l + PW - 4} y={y(level) - 6} className="level-text" textAnchor="end">{levelLabel}</text>
        </g>
      )}
      {tauRead != null && level != null && (
        <g>
          <line x1={x(tauRead)} x2={x(tauRead)} y1={y(level)} y2={M.t + PH} className="tau-line" />
          <circle cx={x(tauRead)} cy={y(level)} r={4.5} className="tau-dot" />
          <text x={x(tauRead) + 6} y={M.t + PH - 8} className="tau-text">τ ≈ {fmt(tauRead, 1)} s</text>
        </g>
      )}

      {refPoints?.map((p) => (
        <rect key={'r' + p.t} x={x(p.t) - 3.5} y={y(p.v) - 3.5} width={7} height={7} className="ref-pt" />
      ))}
      {points.map((p, k) => (
        <circle key={'p' + k} cx={x(p.t)} cy={y(p.v)} r={4.5} className="meas-pt" />
      ))}
      {live && liveT > 0 && liveT <= xMax && <circle cx={x(liveT)} cy={y(live(liveT))} r={5} className="live-dot" />}
    </svg>
  )
}
