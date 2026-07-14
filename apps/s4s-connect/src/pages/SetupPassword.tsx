import { useState } from 'react'
import { trpc } from '../trpc'

export default function SetupPassword() {
  // Get token from URL query parameters
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const setupPasswordMutation = trpc.students.setupPassword.useMutation({
    onSuccess() {
      setSuccess(true)
      setError('')
    },
    onError(err) {
      setError(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError("Le jeton d'invitation est manquant dans l'adresse URL.")
      return
    }
    if (password.length < 4) {
      setError('Le mot de passe doit contenir au moins 4 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setupPasswordMutation.mutate({ token, password })
  }

  if (success) {
    return (
      <div className="container" style={{ width: 340 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary-purple-dark)', textAlign: 'center', marginBottom: 12 }}>
          🎉 Mot de passe créé !
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.4', marginBottom: 16 }}>
          Ton mot de passe a été enregistré avec succès. Tu peux maintenant te connecter à l'application S4S Connect.
        </p>
        <button
          onClick={() => { window.location.href = '/' }}
          className="btn-primary"
          style={{ width: '100%' }}
        >
          Aller à la page de connexion
        </button>
      </div>
    )
  }

  return (
    <div className="container" style={{ width: 340 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary-purple-dark)', textAlign: 'center', margin: '0 0 8px' }}>
          🔑 Choisir ton mot de passe
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.3', marginBottom: 8 }}>
          Configure ton mot de passe pour ton compte étudiant S4S.
        </p>

        {error && (
          <p style={{ color: 'var(--error)', fontSize: 14, textAlign: 'center', fontWeight: 600 }}>{error}</p>
        )}

        {!token ? (
          <p style={{ color: 'var(--error)', fontSize: 14, textAlign: 'center', fontWeight: 600 }}>
            Lien invalide : Jeton d'invitation manquant.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Nouveau mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Confirmer le mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={setupPasswordMutation.isPending}
              className="btn-primary"
              style={{ width: '100%', marginTop: 8 }}
            >
              {setupPasswordMutation.isPending ? 'Enregistrement...' : 'Valider le mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
