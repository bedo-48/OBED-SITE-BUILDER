import type { PropsWithChildren } from 'react'
import { AuthUIProvider } from '@daveyplate/better-auth-ui'
import { authClient } from './lib/auth-client'

export default function Providers({ children }: PropsWithChildren) {
  return (
    <AuthUIProvider
      authClient={authClient}
      basePath="/auth"
      social={{
        providers: ['google', 'github'],
      }}
    >
      {children}
    </AuthUIProvider>
  )
}
