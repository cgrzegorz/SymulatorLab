// Wyniki pomiarów z pliku Z3_sprawozdanie_ver4.pdf (24.10.2026, grupa 1, sekcja 2).

const rows = (keys, cols) => cols[0].map((_, k) => Object.fromEntries(keys.map((key, j) => [key, cols[j][k]])))

export const REPORT = {
  R: 30,
  series: rows(
    ['U', 'I', 'UR', 'UB'],
    [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [0, 25, 40, 50, 65, 75, 85, 90, 105, 115],
      [0, 0.8, 1.2, 1.6, 2, 2.3, 2.6, 2.8, 3.2, 3.5],
      [0, 0.3, 0.8, 1.4, 2, 2.7, 3.4, 4.1, 4.8, 5.6],
    ],
  ),
  parallel: rows(
    ['U', 'I', 'IR', 'IB'],
    [
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5],
      [0, 45, 75, 100, 125, 150, 176, 200, 222, 245],
      [0, 20, 36, 52, 70, 85, 103, 120, 132, 150],
      [0, 25, 39, 50, 60, 67, 76, 85, 90, 100],
    ],
  ),
  mixed: rows(
    ['U', 'I', 'Ith'],
    [
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9],
      [0, 30, 53, 75, 85, 92, 100, 110, 116, 125, 132, 145, 160, 175, 190],
      [0, 22, 35, 44, 50, 59, 67, 73, 78, 84, 88, 100, 112, null, null],
    ],
  ),
  // Tabela 5 i 6 – metoda przecięcia charakterystyk
  opSeries: { U: 6, I: 85, UB: 3.45, UR: 2.55, meas: { I: 85, UB: 3.4, UR: 2.6 }, Rstat: 40.6, Rd: 93 },
  opParallel: { I: 150, U: 2.5, IB: 67, IR: 83, meas: { U: 2.5, IB: 67, IR: 85 } },
  instruments: [
    ['Woltomierz analogowy', 'LM-3', '1602046.83', 'kl. 0,5; 0–7,5 V i 0–15 V'],
    ['Woltomierz analogowy', 'LM-3', '3805010.81', 'kl. 0,5; 0–7,5 V; działka 0,1 V'],
    ['Woltomierz analogowy', 'LM-3', '1602022.83', 'kl. 0,5; 0–7,5 V; działka 0,1 V'],
    ['Amperomierz analogowy', 'LM-1', '2305553', 'kl. 0,5; 0–300 mA; działka 5 mA'],
    ['Amperomierz analogowy', 'LM-1', '2310221', 'kl. 0,5; 0–300 mA; działka 5 mA'],
    ['Amperomierz analogowy', 'LM-1', '2311329', 'kl. 0,5; 0–300 mA; działka 5 mA'],
    ['Rezystor', '–', '–', 'R = 30 Ω'],
    ['Żarówki Ż, Ż1, Ż2', '–', '–', '–'],
  ],
}
