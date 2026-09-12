import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api from '../lib/api'
import { authClient } from '../lib/auth-client'
import Footer from '../components/Footer'

const rotating = ['a portfolio', 'a landing page', 'a restaurant site', 'a store front']

const examples = [
  'Landing page for a coffee shop in Kinshasa, with menu and opening hours',
  'Photographer portfolio, grid gallery and a contact page',
  'Launch page for a ride-sharing mobile app',
]

const Home = () => {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [word, setWord] = useState(0)
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()

  // Le mot tourne toutes les 2,2 secondes. C'est le seul mouvement de la page.
  useEffect(() => {
    const id = setInterval(() => setWord((w) => (w + 1) % rotating.length), 2200)
    return () => clearInterval(id)
  }, [])

  const onSubmitHandler = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    if (!session) {
      toast.error('Sign in to create a site')
      return navigate('/auth/sign-in')
    }

    try {
      setLoading(true)
      const { data } = await api.post('/api/user/project', { initial_prompt: input })
      navigate(`/projects/${data.projectId}`)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="glow pointer-events-none absolute -top-40 left-1/4 -z-10 h-[420px] w-[620px]" />

        <div className="mx-auto max-w-5xl px-5 pt-20 pb-14 md:px-10 md:pt-28">
          <div className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-brick" />
            <p className="label">Generation engine online</p>
          </div>

          <h1 className="tight mt-6 max-w-4xl font-display text-5xl font-semibold leading-[0.98] md:text-[86px]">
            Write one sentence.
            <br />
            Walk away with a <span className="text-brick">site</span>.
          </h1>

          <p className="mt-7 flex flex-wrap items-baseline gap-x-2 font-mono text-[13px] text-muted">
            <span>Right now, someone is generating</span>
            <span key={word} className="animate-rise text-ink">{rotating[word]}</span>
          </p>

          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
            The code streams in as it is written. A complete Tailwind page,
            in a single file, yours to keep.
          </p>

          <form onSubmit={onSubmitHandler} className="ticks card relative mt-12 max-w-3xl p-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              required
              placeholder="A site for..."
              className="w-full resize-none bg-transparent font-mono text-[14px] outline-none placeholder:text-muted/50"
            />
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-line pt-3">
              <span className="label">5 credits per generation</span>
              <button disabled={loading} className="btn-primary">
                {loading ? 'Sending...' : 'Generate'}
              </button>
            </div>
          </form>

          <div className="mt-5 flex max-w-3xl flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInput(ex)}
                className="rounded-sm border border-line px-3 py-1.5 text-left font-mono text-[12px] text-muted transition hover:border-brick hover:text-ink"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl border-t border-line px-5 py-14 md:px-10">
        <div className="grid gap-px overflow-hidden border border-line bg-line md:grid-cols-3">
          {[
            { k: '01', t: 'Streaming', d: 'The HTML shows up while the model writes it. No blind waiting.' },
            { k: '02', t: 'Versions', d: 'Every revision creates a version. Roll back whenever you want.' },
            { k: '03', t: 'Export', d: 'A standalone index.html you can download and host anywhere.' },
          ].map((f) => (
            <div key={f.k} className="bg-panel p-6">
              <p className="label">{f.k}</p>
              <p className="mt-4 font-display text-xl font-medium tracking-tight">{f.t}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </>
  )
}

export default Home
