import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import api from '../lib/api'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/projects', label: 'My sites' },
  { to: '/community', label: 'Community' },
  { to: '/pricing', label: 'Credits' },
]

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (!session) {
      setCredits(null)
      return
    }
    api
      .get('/api/user/credits')
      .then(({ data }) => setCredits(data.credits))
      .catch(() => setCredits(null))
  }, [session])

  const handleSignOut = async () => {
    await authClient.signOut()
    navigate('/')
  }

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between gap-6 border-b border-line bg-paper/90 px-5 py-3 backdrop-blur md:px-10">
        <Link to="/" className="font-display text-2xl leading-none tracking-tight">
          Obed<span className="text-brick">.</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `label transition hover:text-ink ${isActive ? 'text-ink' : ''}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              <Link to="/pricing" className="label hidden hover:text-ink sm:block">
                {credits ?? '--'} credits
              </Link>
              <Link to="/settings" className="label hover:text-ink">
                Account
              </Link>
              <button onClick={handleSignOut} className="label hover:text-ink">
                Sign out
              </button>
            </>
          ) : (
            <button onClick={() => navigate('/auth/sign-in')} className="btn-primary">
              Get started
            </button>
          )}

          <button className="label md:hidden" onClick={() => setMenuOpen(true)}>
            Menu
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-paper md:hidden">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} className="font-display text-3xl">
              {l.label}
            </Link>
          ))}
          {session && (
            <Link to="/settings" onClick={() => setMenuOpen(false)} className="font-display text-3xl">
              Account
            </Link>
          )}
          <button onClick={() => setMenuOpen(false)} className="label mt-6">
            Close
          </button>
        </div>
      )}
    </>
  )
}

export default Navbar
