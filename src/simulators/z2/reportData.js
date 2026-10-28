// Wyniki pomiarów z pliku Z2_sprawozdanie_V2.pdf (17.10.2026, grupa 1, sekcja 2).

const T = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90]
const zip = (vals) => T.map((t, k) => ({ t, v: vals[k] }))

export const REPORT = {
  meta: {
    title: 'Stany nieustalone w obwodach RC',
    exercise: 'Z2',
    lab: 'Laboratorium Elektrotechniki',
    university: 'Politechnika Częstochowska, Wydział Elektryczny',
    date: '17.10.2026',
  },
  nominal: { R: 510e3, C: 30e-6, U: 30 },
  tauTheory: 15.3,
  points: {
    'charge-i': zip([58, 44, 31, 23, 16, 12, 9, 6, 4, 3, 2, 1, 0.8, 0.4, 0.2, 0]),
    'charge-u': zip([0.01, 7.48, 13.33, 17.97, 20.88, 22.94, 24.47, 25.68, 26.42, 27.02, 27.39, 27.66, 27.87, 28.1, 28.23, 28.28]),
    discharge: zip([57, 42, 30, 22, 16, 11, 8, 6, 4, 3, 2, 1, 0.9, 0.6, 0.3, 0]),
  },
  uSteady: 28.35,
  tauGraph: { 'charge-i': 16.2, 'charge-u': 15.0, discharge: 15.9 },
  instruments: [
    ['Mikroamperomierz analogowy', 'LM-3', '02053', '0–75 µA, kl. 0,5'],
    ['Zasilacz DC', '–', 'DF1730SB5A', '0–30 V, 0–0,5 A'],
    ['Woltomierz cyfrowy', 'MXD-4660A', '943075', '0–250 V, 0,01 V, kat. II'],
    ['Rezystor 510 kΩ', 'MAT-2', '–', 'tolerancja 5%'],
    ['Kondensator elektrolityczny 30 µF', '–', '–', '–'],
  ],
}
