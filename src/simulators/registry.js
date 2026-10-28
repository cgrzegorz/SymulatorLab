import Z2Simulator from './z2/Z2Simulator.jsx'
import Z3Simulator from './z3/Z3Simulator.jsx'

// Kategorie i symulatory widoczne w menu bocznym.
// Aby dodać nowy symulator: utwórz komponent i dopisz wpis do `items` odpowiedniej kategorii.
export const CATEGORIES = [
  {
    id: 'elektrotechnika',
    name: 'Elektrotechnika',
    icon: '⚡',
    items: [
      {
        id: 'z2',
        name: 'Z2_sprawozdanie_V2',
        subtitle: 'Stany nieustalone w obwodach RC',
        component: Z2Simulator,
      },
      {
        id: 'z3',
        name: 'Z3_sprawozdanie_ver4',
        subtitle: 'Nieliniowe obwody prądu stałego',
        component: Z3Simulator,
      },
    ],
  },
  { id: 'elektronika', name: 'Elektronika', icon: '🔌', items: [] },
  { id: 'miernictwo', name: 'Miernictwo', icon: '📏', items: [] },
  { id: 'maszyny', name: 'Maszyny elektryczne', icon: '⚙️', items: [] },
]

export function findSimulator(catId, simId) {
  const cat = CATEGORIES.find((c) => c.id === catId)
  return cat?.items.find((s) => s.id === simId) ?? null
}
