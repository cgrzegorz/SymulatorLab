/** Liczba w zapisie polskim (przecinek dziesiętny). */
export function fmt(v, digits = 2) {
  if (v == null || Number.isNaN(v)) return '–'
  if (!isFinite(v)) return '∞'
  return v.toFixed(digits).replace('.', ',').replace('-', '−')
}

export function signed(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return '–'
  return (v > 0 ? '+' : '') + fmt(v, digits)
}
