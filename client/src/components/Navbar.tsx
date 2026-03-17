

import React from 'react'
import { assets } from '../assets/assets'
import { Link, useNavigate } from 'react-router-dom'

const Navbar = () => {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const navigate = useNavigate()

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
          <button
            onClick={() => navigate('/auth/signin')}
            className="px-6 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition rounded"
          >
            Get started
          </button>

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
