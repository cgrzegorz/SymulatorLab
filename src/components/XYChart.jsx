import { fmt } from '../utils.js'
import { niceMax } from './Chart.jsx'

function niceStep(range, target) {
  const raw = range / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / mag
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag
}

const W = 680
const H = 420
const M = { l: 58, r: 18, t: 18, b: 48 }
const PW = W - M.l - M.r
const PH = H - M.t - M.b

function Marker({ kind, x, y, cls }) {
  const s = 4.5
  if (kind === 'square') return <rect x={x - s} y={y - s} width={2 * s} height={2 * s} className={'mk ' + cls} />
  if (kind === 'cross') return <path d={`M${x - s} ${y - s}L${x + s} ${y + s}M${x - s} ${y + s}L${x + s} ${y - s}`} className={'mk cross ' + cls} />
  if (kind === 'tri') return <path d={`M${x} ${y - s - 1}L${x + s} ${y + s - 1}L${x - s} ${y + s - 1}Z`} className={'mk ' + cls} />
  if (kind === 'ring') return <circle cx={x} cy={y} r={7} className={'mk ring ' + cls} />
  return <circle cx={x} cy={y} r={s} className={'mk ' + cls} />
}

/**
 * Ogólny wykres XY.
 * series: { kind: 'curve', fn(x) → y, x0, x1 } | { kind: 'param', fn(s) → [x, y], s0, s1 }
 *       | { kind: 'points', data: [[x, y]], marker } | { kind: 'line', data: [[x, y]] }
 * annotations: { x1, y1, x2, y2, cls, label, lx, ly, anchor }
 */
export default function XYChart({ xMax, yMax, xLabel, yLabel, series = [], annotations = [], ariaLabel }) {
  const xm = niceMax(xMax)
  const ym = niceMax(yMax)
  const x = (v) => M.l + (v / xm) * PW
  const y = (v) => M.t + PH - (v / ym) * PH
  const xs = niceStep(xm, 9)
  const ys = niceStep(ym, 7)
  const xt = []
  for (let v = 0; v <= xm + 1e-9; v += xs) xt.push(v)
  const yt = []
  for (let v = 0; v <= ym + 1e-9; v += ys) yt.push(v)
  const xd = xs < 1 ? 1 : 0

  const path = (pts) =>
    pts
      .filter(([px, py]) => isFinite(px) && isFinite(py))
      .map(([px, py], k) => `${k ? 'L' : 'M'}${x(Math.min(px, xm * 1.05)).toFixed(1)} ${y(Math.min(py, ym * 1.05)).toFixed(1)}`)
      .join('')

  const sample = (s) => {
    const n = 160
    const out = []
    for (let k = 0; k <= n; k++) {
      if (s.kind === 'curve') {
        const v = s.x0 + ((s.x1 - s.x0) * k) / n
        out.push([v, s.fn(v)])
      } else {
        out.push(s.fn(s.s0 + ((s.s1 - s.s0) * k) / n))
      }
    }
    return out
  }

  return (
    <svg className="chart xy" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <defs>
        <clipPath id="plot-clip">
          <rect x={M.l} y={M.t - 4} width={PW + 4} height={PH + 4} />
        </clipPath>
      </defs>
      <rect x={M.l} y={M.t} width={PW} height={PH} className="chart-bg" />
      {xt.map((v) => (
        <g key={'x' + v}>
          <line x1={x(v)} x2={x(v)} y1={M.t} y2={M.t + PH} className="grid" />
          <text x={x(v)} y={M.t + PH + 18} className="tick" textAnchor="middle">{fmt(v, xd)}</text>
        </g>
      ))}
      {yt.map((v) => (
        <g key={'y' + v}>
          <line x1={M.l} x2={M.l + PW} y1={y(v)} y2={y(v)} className="grid" />
          <text x={M.l - 8} y={y(v) + 4} className="tick" textAnchor="end">{fmt(v, 0)}</text>
        </g>
      ))}
      <text x={M.l + PW / 2} y={H - 8} className="axis-label" textAnchor="middle">{xLabel}</text>
      <text x={16} y={M.t + PH / 2} className="axis-label" textAnchor="middle" transform={`rotate(-90 16 ${M.t + PH / 2})`}>{yLabel}</text>

      <g clipPath="url(#plot-clip)">
        {series.map((s, k) => {
          if (s.kind === 'curve' || s.kind === 'param') return <path key={k} d={path(sample(s))} className={'ser ' + s.cls} />
          if (s.kind === 'line') return <path key={k} d={path(s.data)} className={'ser ' + s.cls} />
          return null
        })}
        {annotations.map((a, k) => (
          <g key={'a' + k}>
            <line x1={x(a.x1)} y1={y(a.y1)} x2={x(a.x2)} y2={y(a.y2)} className={'ann ' + (a.cls || '')} />
            {a.label && (
              <text x={x(a.lx ?? (a.x1 + a.x2) / 2)} y={y(a.ly ?? (a.y1 + a.y2) / 2) - 6} textAnchor={a.anchor || 'middle'} className={'ann-text ' + (a.cls || '')}>
                {a.label}
              </text>
            )}
          </g>
        ))}
        {series.map((s, k) =>
          s.kind === 'points'
            ? s.data.filter((p) => p[1] != null).map(([px, py], j) => <Marker key={k + '-' + j} kind={s.marker} x={x(px)} y={y(py)} cls={s.cls} />)
            : null,
        )}
      </g>
    </svg>
  )
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <svg width="22" height="12" className="lg-svg">
            {it.line && <line x1="1" y1="6" x2="21" y2="6" className={'ser ' + it.cls} />}
            {it.marker && <Marker kind={it.marker} x={11} y={6} cls={it.cls} />}
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  )
}
