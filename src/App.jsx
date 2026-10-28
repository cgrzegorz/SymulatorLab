import { useEffect, useState } from 'react'
import { CATEGORIES, findSimulator } from './simulators/registry.js'

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('labsim-theme') || 'dark'
    } catch {
      return 'dark'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('labsim-theme', theme)
    } catch {
      /* brak dostępu do localStorage */
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

function Home() {
  return (
    <div className="home">
      <h1>Wirtualne laboratorium</h1>
      <p className="lead">Interaktywne symulatory ćwiczeń laboratoryjnych. Wybierz ćwiczenie z menu po lewej stronie.</p>
      <div className="home-grid">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="card home-cat">
            <h2>{c.icon} {c.name}</h2>
            {c.items.length ? (
              c.items.map((s) => (
                <a key={s.id} className="home-item" href={`#/${c.id}/${s.id}`}>
                  <b>{s.name}</b>
                  <span>{s.subtitle}</span>
                </a>
              ))
            ) : (
              <p className="muted-text">Wkrótce</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [catId, simId] = useHashRoute()
  const [theme, toggleTheme] = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState({})
  const sim = findSimulator(catId, simId)
  const Sim = sim?.component

  useEffect(() => setMenuOpen(false), [catId, simId])

  return (
    <div className={'app' + (menuOpen ? ' menu-open' : '')}>
      <aside className="sidebar">
        <a className="brand" href="#/">
          <span className="brand-logo">⚡</span>
          <span>
            <b>LabSim</b>
            <small>laboratorium wirtualne</small>
          </span>
        </a>
        <nav className="menu">
          {CATEGORIES.map((c) => {
            const isCollapsed = collapsed[c.id] ?? c.items.length === 0
            return (
              <div key={c.id} className="menu-cat">
                <button className="menu-cat-head" onClick={() => setCollapsed((s) => ({ ...s, [c.id]: !isCollapsed }))} aria-expanded={!isCollapsed}>
                  <span className="menu-icon">{c.icon}</span>
                  <span className="menu-cat-name">{c.name}</span>
                  <span className="menu-count">{c.items.length}</span>
                  <span className={'chev' + (isCollapsed ? '' : ' open')}>›</span>
                </button>
                {!isCollapsed && (
                  <div className="menu-items">
                    {c.items.length === 0 && <span className="menu-empty">brak ćwiczeń – wkrótce</span>}
                    {c.items.map((s) => (
                      <a key={s.id} href={`#/${c.id}/${s.id}`} className={'menu-item' + (catId === c.id && simId === s.id ? ' active' : '')}>
                        <span className="mi-name">{s.name}</span>
                        <span className="mi-sub">{s.subtitle}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-foot">
          <button className="btn ghost small" onClick={toggleTheme}>{theme === 'dark' ? '☀ Jasny motyw' : '☾ Ciemny motyw'}</button>
        </div>
      </aside>
      <div className="backdrop" onClick={() => setMenuOpen(false)} />
      <main className="content">
        <div className="topbar">
          <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu">☰</button>
          <span>LabSim</span>
        </div>
        {Sim ? <Sim key={`${catId}/${simId}`} /> : <Home />}
      </main>
    </div>
  )
}
