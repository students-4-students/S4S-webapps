import { useState } from 'react'
import { trpc } from '../trpc'
import { useAuthStore } from '../store/auth'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const setAuth = useAuthStore((s) => s.setAuth)

  const login = trpc.auth.login.useMutation({
    onSuccess(data) {
      setAuth(data.token, data.user)
    },
    onError(e) {
      setError(e.message)
    },
  })

  return (
    <div className='container'>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, padding:0, margin:0}}>Gest4S</h1>

        {error && (
          <p style={{ color: 'red', fontSize: 14 }}>{error}</p>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login.mutate({ email, password })}
        />
        <button
          onClick={() => login.mutate({ email, password })}
          disabled={login.isPending}
        >
          {login.isPending ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </div>
  )
}