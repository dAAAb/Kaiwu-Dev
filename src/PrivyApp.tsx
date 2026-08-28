/**
 * Privy auth provider, loaded lazily so the public pages never download the
 * wallet/auth SDK (~2 MB). Only /dashboard/* mounts this.
 */
import type { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'

export default function PrivyApp({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId="cmnj7653v00400cky42ae3biw"
      config={{
        appearance: { theme: 'dark', accentColor: '#f59e0b' },
        loginMethods: ['email', 'wallet', 'google', 'github'],
      }}
    >
      {children}
    </PrivyProvider>
  )
}
