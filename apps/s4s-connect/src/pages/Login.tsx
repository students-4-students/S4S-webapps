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
    onError(_e) {
      setError("L'email ou le mot de passe est incorrect.")
    },
  })

  return (
    <div className='container'>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, padding: 0, margin: '0 0 10px', color: 'var(--primary-purple-dark)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/s4s-logo.svg" style={{ width: 40, height: 40, marginRight: 10 }} />
          S4S Connect 
        </h1>

        {error && (
          <p style={{ color: 'var(--error)', fontSize: 14, textAlign: 'center', fontWeight: 600 }}>{error}</p>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login.mutate({ email, password })}
        />
        <button
          onClick={() => login.mutate({ email, password })}
          disabled={login.isPending}
          className="btn-primary"
          style={{ width: '100%', marginTop: '0.5rem' }}
        >
          {login.isPending ? 'Connexion en cours...' : 'Se connecter'}
        </button>
      </div>
      <img src="/agep.svg" style={{ width: 200, height: 200, position: 'absolute', bottom: 0, right: 30}} />
    </div>
  )
}