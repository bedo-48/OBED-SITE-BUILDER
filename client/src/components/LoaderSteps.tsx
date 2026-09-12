import { useEffect, useState } from 'react'

interface Props {
  /** Message envoye par le serveur via SSE (event: status) */
  status: string
  /** Nombre de caracteres de code deja recus */
  chars: number
}

/**
 * Panneau affiche pendant la generation. Les anciennes etapes tournaient sur
 * un minuteur factice et ne disaient rien de vrai. Ici tout vient du serveur :
 * le message SSE, le compteur de caracteres, le temps ecoule.
 */
const GenerationStatus = ({ status, chars }: Props) => {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-full w-full flex-col items-start justify-center gap-6 bg-panel px-10">
      <div className="flex items-center gap-3">
        <span className="size-2 animate-pulse rounded-full bg-brick" />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          {status || 'Connecting to the model'}
        </p>
      </div>

      <p className="max-w-md font-display text-4xl leading-tight text-ink">
        {chars > 0 ? 'Code incoming.' : 'The model is thinking.'}
      </p>

      <div className="w-full max-w-md">
        <div className="h-px w-full bg-line">
          <div
            className="h-px bg-brick transition-all duration-300"
            style={{ width: `${Math.min(100, (chars / 9000) * 100)}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between font-mono text-[11px] text-muted">
          <span>{chars.toLocaleString('en-US')} characters</span>
          <span>{seconds}s</span>
        </div>
      </div>

      <p className="max-w-sm text-[13px] leading-relaxed text-muted">
        A full page takes one to two minutes. Do not reload, it would cut the
        stream and burn the credits.
      </p>
    </div>
  )
}

export default GenerationStatus
