import React, { useEffect, useState } from 'react'
import { assets } from '../assets/assets'
import { Link, useNavigate } from 'react-router-dom'
import { CoinsIcon, SettingsIcon } from 'lucide-react'
import { authClient } from '../lib/auth-client'
import api from '../lib/api'

const Navbar = () => {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (!session) {
      setCredits(null)
      return
    }
    api.get('/api/user/credits')
      .then(({ data }) => setCredits(data.credits))
      .catch(() => setCredits(null))
  }, [session])

  const handleSignOut = async () => {
    await authClient.signOut()
    navigate('/')
  }

  return (
    <>
      <nav className="relative z-50 flex items-center justify-between w-full py-4 px-4 md:px-16 lg:px-24 xl:px-32 backdrop-blur border-b border-slate-800 text-white">

        <Link to="/">
          <img src={assets.logo} alt="logo" className="h-5 sm:h-7" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <Link to="/">Home</Link>
          <Link to="/projects">My Projects</Link>
          <Link to="/community">Community</Link>
          <Link to="/pricing">Pricing</Link>
        </div>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <Link to="/pricing" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/15 transition">
                <CoinsIcon size={16} className="text-yellow-400" />
                {credits ?? '—'} credits
              </Link>
              <Link to="/settings" title="Settings" className="flex items-center justify-center p-1.5 rounded bg-white/10 hover:bg-white/15 transition">
                <SettingsIcon size={18} />
              </Link>
              <button
                onClick={handleSignOut}
                className="px-6 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition rounded"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/auth/sign-in')}
              className="px-6 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition rounded"
            >
              Get started
            </button>
          )}

          <button
            className="md:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 5h16" />
              <path d="M4 12h16" />
              <path d="M4 19h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur flex flex-col items-center justify-center gap-8 text-white md:hidden">
          <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to="/projects" onClick={() => setMenuOpen(false)}>My Projects</Link>
          <Link to="/community" onClick={() => setMenuOpen(false)}>Community</Link>
          <Link to="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
          {session && <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>}

          <button
            onClick={() => setMenuOpen(false)}
            className="w-10 h-10 flex items-center justify-center bg-white text-black rounded"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}

export default Navbar
