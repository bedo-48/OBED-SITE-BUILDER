import { useState, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '../../lib/auth-client'

export default function AuthPage() {
  const { pathname } = useParams()
  const navigate = useNavigate()

  const isSignUp = pathname === 'sign-up'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({ name, email, password })
        if (error) throw new Error(error.message)
        toast.success('Account created!')
      } else {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) throw new Error(error.message)
        toast.success('Welcome back!')
      }
      navigate('/')
    } catch (err: any) {
      toast.error(err?.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex flex-col justify-center items-center min-h-[85vh] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-gray-900/70 border border-gray-800 rounded-2xl p-8 shadow-xl"
      >
        <div className="flex items-center gap-2 mb-1">
          <img src="/favicon.svg" alt="logo" className="h-6" />
          <span className="text-white font-medium">SiteBuilder</span>
        </div>

        <h1 className="text-2xl font-semibold text-white mt-4">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-gray-400 mt-1 mb-6">
          {isSignUp
            ? 'Start building websites with AI.'
            : 'Sign in to continue building.'}
        </p>

        {isSignUp && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Jane Doe"
              className="w-full p-2.5 rounded-md bg-gray-800 border border-gray-700 text-white text-sm outline-none focus:ring-2 ring-indigo-500"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full p-2.5 rounded-md bg-gray-800 border border-gray-700 text-white text-sm outline-none focus:ring-2 ring-indigo-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            className="w-full p-2.5 rounded-md bg-gray-800 border border-gray-700 text-white text-sm outline-none focus:ring-2 ring-indigo-500"
          />
          {isSignUp && (
            <p className="text-[11px] text-gray-500 mt-1">At least 8 characters.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-md text-sm font-medium transition-colors"
        >
          {loading && <Loader2Icon className="size-4 animate-spin" />}
          {isSignUp ? 'Create account' : 'Sign in'}
        </button>

        <p className="text-sm text-gray-400 text-center mt-6">
          {isSignUp ? (
            <>
              Already have an account?{' '}
              <Link to="/auth/sign-in" className="text-indigo-400 hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              No account yet?{' '}
              <Link to="/auth/sign-up" className="text-indigo-400 hover:underline">
                Create one
              </Link>
            </>
          )}
        </p>
      </form>
    </main>
  )
}
