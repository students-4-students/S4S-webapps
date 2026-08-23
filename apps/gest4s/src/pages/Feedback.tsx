import { useState } from 'react'
import { trpc } from '../trpc'
import {
  Modal,
  Button,
  Input,
  PageHeader,
  EmptyState,
  LoadingSpinner,
} from '@s4s/ui'
import '../../styles/feedback.css'

export const LIKERT_5_OPTIONS = [
  "Tout à fait d'accord",
  "D'accord",
  "Pas d'accord",
  "Pas du tout d'accord",
  "Sans avis",
]

type QuestionType = 'LIKERT_5' | 'OPEN_TEXT' | 'SINGLE_CHOICE' | 'MULTIPLE'

interface QuestionForm {
  id?: string
  title: string
  description?: string
  type: QuestionType
  required: boolean
  options: { id?: string; label: string }[]
}

interface PageForm {
  id?: string
  title: string
  description?: string
  questions: QuestionForm[]
}

export default function Gest4SFeedback() {
  const [activeTab, setActiveTab] = useState<'surveys' | 'analytics'>('surveys')
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [showBuilderModal, setShowBuilderModal] = useState(false)
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null)

  // Survey Builder state
  const [surveyTitle, setSurveyTitle] = useState('')
  const [surveyDescription, setSurveyDescription] = useState('')
  const [surveyActive, setSurveyActive] = useState(true)
  const [pages, setPages] = useState<PageForm[]>([
    {
      title: 'Page 1',
      description: '',
      questions: [
        {
          title: '',
          description: '',
          type: 'LIKERT_5',
          required: true,
          options: [],
        },
      ],
    },
  ])

  const utils = trpc.useUtils()

  // Queries
  const { data: surveys = [], isLoading } = trpc.feedback.list.useQuery()
  const { data: analyticsSurvey, isLoading: loadingAnalytics } = trpc.feedback.getAnalytics.useQuery(
    { id: selectedSurveyId! },
    { enabled: Boolean(selectedSurveyId && activeTab === 'analytics') }
  )

  // Live real-time updates
  trpc.feedback.onUpdated.useSubscription(undefined, {
    onData: () => {
      utils.feedback.list.invalidate()
      if (selectedSurveyId) {
        utils.feedback.getAnalytics.invalidate({ id: selectedSurveyId })
      }
    },
  })

  // Mutations
  const createMutation = trpc.feedback.create.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate()
      closeBuilderModal()
    },
  })

  const updateMutation = trpc.feedback.update.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate()
      closeBuilderModal()
    },
  })

  const toggleActiveMutation = trpc.feedback.toggleActive.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate()
    },
  })

  const deleteMutation = trpc.feedback.delete.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate()
      if (selectedSurveyId) setSelectedSurveyId(null)
    },
  })

  const openCreateModal = () => {
    setEditingSurveyId(null)
    setSurveyTitle('')
    setSurveyDescription('')
    setSurveyActive(true)
    setPages([
      {
        title: 'Page 1',
        description: '',
        questions: [
          {
            title: '',
            description: '',
            type: 'LIKERT_5',
            required: true,
            options: [],
          },
        ],
      },
    ])
    setShowBuilderModal(true)
  }

  const openEditModal = (survey: any) => {
    setEditingSurveyId(survey.id)
    setSurveyTitle(survey.title)
    setSurveyDescription(survey.description || '')
    setSurveyActive(survey.active)
    setPages(
      survey.pages.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        questions: p.questions.map((q: any) => ({
          id: q.id,
          title: q.title,
          description: q.description || '',
          type: q.type,
          required: q.required,
          options: q.options ? q.options.map((o: any) => ({ id: o.id, label: o.label })) : [],
        })),
      }))
    )
    setShowBuilderModal(true)
  }

  const closeBuilderModal = () => {
    setShowBuilderModal(false)
    setEditingSurveyId(null)
  }

  // Page manipulation helpers
  const addPage = () => {
    setPages((prev) => [
      ...prev,
      {
        title: `Page ${prev.length + 1}`,
        description: '',
        questions: [
          {
            title: '',
            description: '',
            type: 'LIKERT_5',
            required: true,
            options: [],
          },
        ],
      },
    ])
  }

  const removePage = (pageIdx: number) => {
    if (pages.length <= 1) {
      alert('Un sondage doit comporter au moins une page.')
      return
    }
    setPages((prev) => prev.filter((_, idx) => idx !== pageIdx))
  }

  const addQuestion = (pageIdx: number) => {
    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== pageIdx) return p
        return {
          ...p,
          questions: [
            ...p.questions,
            {
              title: '',
              description: '',
              type: 'LIKERT_5',
              required: true,
              options: [],
            },
          ],
        }
      })
    )
  }

  const removeQuestion = (pageIdx: number, qIdx: number) => {
    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== pageIdx) return p
        if (p.questions.length <= 1) {
          alert('Chaque page doit comporter au moins une question.')
          return p
        }
        return {
          ...p,
          questions: p.questions.filter((_, idx) => idx !== qIdx),
        }
      })
    )
  }

  const updateQuestionType = (pageIdx: number, qIdx: number, newType: QuestionType) => {
    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== pageIdx) return p
        return {
          ...p,
          questions: p.questions.map((q, idx) => {
            if (idx !== qIdx) return q
            let options = q.options
            if ((newType === 'SINGLE_CHOICE' || newType === 'MULTIPLE') && options.length === 0) {
              options = [{ label: 'Option 1' }, { label: 'Option 2' }]
            }
            return { ...q, type: newType, options }
          }),
        }
      })
    )
  }

  const addOption = (pageIdx: number, qIdx: number) => {
    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== pageIdx) return p
        return {
          ...p,
          questions: p.questions.map((q, idx) => {
            if (idx !== qIdx) return q
            return {
              ...q,
              options: [...q.options, { label: `Option ${q.options.length + 1}` }],
            }
          }),
        }
      })
    )
  }

  const removeOption = (pageIdx: number, qIdx: number, optIdx: number) => {
    setPages((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== pageIdx) return p
        return {
          ...p,
          questions: p.questions.map((q, idx) => {
            if (idx !== qIdx) return q
            return {
              ...q,
              options: q.options.filter((_, oIdx) => oIdx !== optIdx),
            }
          }),
        }
      })
    )
  }

  const handleSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!surveyTitle.trim()) {
      alert('Veuillez spécifier le titre du sondage.')
      return
    }

    // Validation
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const p = pages[pIdx]
      if (!p.title.trim()) {
        alert(`Page #${pIdx + 1}: Le titre de la page ne peut pas être vide.`)
        return
      }
      for (let qIdx = 0; qIdx < p.questions.length; qIdx++) {
        const q = p.questions[qIdx]
        if (!q.title.trim()) {
          alert(`Page ${pIdx + 1}, Question ${qIdx + 1}: Veuillez saisir l'intitulé de la question.`)
          return
        }
        if ((q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE') && q.options.length < 2) {
          alert(`Page ${pIdx + 1}, Question ${qIdx + 1}: Veuillez ajouter au moins 2 options.`)
          return
        }
      }
    }

    const payload = {
      title: surveyTitle.trim(),
      description: surveyDescription.trim() || undefined,
      active: surveyActive,
      pages: pages.map((p) => ({
        title: p.title.trim(),
        description: p.description?.trim() || undefined,
        questions: p.questions.map((q) => ({
          title: q.title.trim(),
          description: q.description?.trim() || undefined,
          type: q.type,
          required: q.required,
          options:
            q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE'
              ? q.options.map((opt) => ({ label: opt.label.trim() }))
              : undefined,
        })),
      })),
    }

    if (editingSurveyId) {
      await updateMutation.mutateAsync({ id: editingSurveyId, ...payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
  }

  return (
    <div className="feedback-page">
      <PageHeader
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)' }}>
              <button
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.88rem',
                  background: activeTab === 'surveys' ? 'linear-gradient(135deg, #ff66b3 0%, #ec4899 100%)' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '7px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'surveys' ? '0 2px 8px rgba(255, 102, 179, 0.4)' : 'none',
                }}
                onClick={() => setActiveTab('surveys')}
              >
                📋 Sondages Étudiants ({surveys.length})
              </button>
              <button
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.88rem',
                  background: activeTab === 'analytics' ? 'linear-gradient(135deg, #ff66b3 0%, #ec4899 100%)' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '7px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: activeTab === 'analytics' ? '0 2px 8px rgba(255, 102, 179, 0.4)' : 'none',
                }}
                onClick={() => {
                  if (surveys.length > 0 && !selectedSurveyId) {
                    setSelectedSurveyId(surveys[0].id)
                  }
                  setActiveTab('analytics')
                }}
              >
                📊 Résultats & Réponses
              </button>
            </div>
            {activeTab === 'surveys' && (
              <button
                onClick={openCreateModal}
                style={{
                  background: 'linear-gradient(135deg, #ff66b3 0%, #ec4899 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.55rem 1.1rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255, 102, 179, 0.35)',
                }}
              >
                + Nouveau Sondage Multi-pages
              </button>
            )}
          </div>
        }
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, #ffffff 0%, #eed4f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Sondages & Feedback (Étudiants)
        </h1>
        <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
          Créez des questionnaires multi-pages pour les étudiants et consultez leurs réponses en temps réel.
        </p>
      </PageHeader>

      {/* Main Content Area */}
      {activeTab === 'surveys' ? (
        isLoading ? (
          <LoadingSpinner />
        ) : surveys.length === 0 ? (
          <EmptyState
            title="Aucun sondage créé"
            description="Cliquez sur le bouton ci-dessus pour créer votre premier sondage étudiant."
            actionLabel="+ Créer un sondage"
            onAction={openCreateModal}
          />
        ) : (
          <div className="feedback-grid">
            {surveys.map((survey: any) => {
              const totalQuestions = survey.pages.reduce(
                (acc: number, p: any) => acc + p.questions.length,
                0
              )
              const responseCount = survey._count?.responses || 0

              return (
                <div key={survey.id} className="survey-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <span className={`survey-badge ${survey.active ? 'active' : 'inactive'}`}>
                        {survey.active ? '🟢 Actif' : '⚪ Inactif'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: '6px', fontWeight: 600 }}>
                        🎓 Étudiants
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontSize: '1.25rem', fontWeight: 700 }}>
                      {survey.title}
                    </h3>
                    {survey.description && (
                      <p style={{ margin: '0 0 1rem 0', color: 'rgba(255,255,255,0.75)', fontSize: '0.88rem', lineHeight: 1.4 }}>
                        {survey.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', margin: '1rem 0' }}>
                      <div>📄 <strong>{survey.pages.length}</strong> pages</div>
                      <div>❓ <strong>{totalQuestions}</strong> questions</div>
                      <div>💬 <strong>{responseCount}</strong> réponses</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '0.85rem' }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedSurveyId(survey.id)
                        setActiveTab('analytics')
                      }}
                      style={{ flex: 1, fontSize: '0.82rem' }}
                    >
                      📊 Voir résultats
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => openEditModal(survey)}
                      style={{ fontSize: '0.82rem', color: '#ffffff' }}
                    >
                      ✏️ Éditer
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => toggleActiveMutation.mutate({ id: survey.id, active: !survey.active })}
                      style={{ fontSize: '0.82rem', color: '#ffffff' }}
                    >
                      {survey.active ? '⏸️ Désactiver' : '▶️ Activer'}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (confirm(`Supprimer le sondage "${survey.title}" ?`)) {
                          deleteMutation.mutate({ id: survey.id })
                        }
                      }}
                      style={{ fontSize: '0.82rem' }}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        /* Analytics View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(35, 27, 52, 0.85)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(238, 212, 241, 0.2)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <label style={{ fontWeight: 600, color: '#ffffff' }}>Sélectionner un sondage :</label>
            <select
              value={selectedSurveyId || ''}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
              style={{
                background: '#1a1426',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.95rem',
                flex: 1,
                maxWidth: '400px',
              }}
            >
              {surveys.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s._count?.responses || 0} réponses)
                </option>
              ))}
            </select>
          </div>

          {!selectedSurveyId ? (
            <EmptyState title="Veuillez sélectionner un sondage" description="Sélectionnez un sondage dans la liste pour consulter les résultats." />
          ) : loadingAnalytics ? (
            <LoadingSpinner />
          ) : !analyticsSurvey ? (
            <EmptyState title="Données introuvables" description="Impossible de charger les données du sondage." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(35, 27, 52, 0.85)', border: '1px solid rgba(238, 212, 241, 0.2)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                <h2 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontSize: '1.5rem', fontWeight: 800 }}>
                  {analyticsSurvey.title}
                </h2>
                {analyticsSurvey.description && (
                  <p style={{ margin: '0 0 1rem 0', color: 'rgba(255,255,255,0.75)' }}>{analyticsSurvey.description}</p>
                )}
                <div style={{ display: 'flex', gap: '2rem', fontSize: '1rem', color: 'rgba(255,255,255,0.85)' }}>
                  <div>Total étudiants participants: <strong style={{ color: '#ff66b3' }}>{analyticsSurvey._count?.responses || 0}</strong></div>
                  <div>Statut: <strong>{analyticsSurvey.active ? 'Actif 🟢' : 'Inactif ⚪'}</strong></div>
                </div>
              </div>

              {analyticsSurvey.pages.map((page: any, pIdx: number) => (
                <div key={page.id} style={{ background: 'rgba(35, 27, 52, 0.85)', border: '1px solid rgba(238, 212, 241, 0.2)', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                  <h3 style={{ margin: '0 0 0.25rem 0', color: '#ff66b3', fontSize: '1.2rem', fontWeight: 700 }}>
                    Page {pIdx + 1}: {page.title}
                  </h3>
                  {page.description && <p style={{ margin: '0 0 1rem 0', color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem' }}>{page.description}</p>}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
                    {page.questions.map((q: any, qIdx: number) => {
                      const totalAnswers = q.answers.length

                      return (
                        <div key={q.id} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '1.1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1rem', fontWeight: 600 }}>
                              Q{qIdx + 1}. {q.title}
                            </h4>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.12)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                              Type: {q.type}
                            </span>
                          </div>

                          {/* Likert 5 Scale Results */}
                          {q.type === 'LIKERT_5' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
                              {LIKERT_5_OPTIONS.map((optLabel) => {
                                const count = q.answers.filter((a: any) => a.textAnswer === optLabel).length
                                const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
                                return (
                                  <div key={optLabel} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)' }}>
                                      <span>{optLabel}</span>
                                      <span><strong>{count}</strong> ({pct}%)</span>
                                    </div>
                                    <div className="analytics-bar-bg">
                                      <div className="analytics-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Single Choice or Multiple Choice Results */}
                          {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
                              {q.options.map((opt: any) => {
                                const count = q.answers.filter((a: any) => a.optionId === opt.id).length
                                const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
                                return (
                                  <div key={opt.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)' }}>
                                      <span>{opt.label}</span>
                                      <span><strong>{count}</strong> ({pct}%)</span>
                                    </div>
                                    <div className="analytics-bar-bg">
                                      <div className="analytics-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Open Text Answers */}
                          {q.type === 'OPEN_TEXT' && (
                            <div style={{ marginTop: '0.75rem' }}>
                              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', marginBottom: '0.5rem' }}>
                                Réponses écrites ({totalAnswers}) :
                              </div>
                              {totalAnswers === 0 ? (
                                <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem' }}>Aucune réponse pour le moment.</p>
                              ) : (
                                <div className="analytics-text-list">
                                  {q.answers.map((ans: any) => (
                                    <div key={ans.id} className="analytics-text-item">
                                      <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>
                                        {ans.response?.user?.firstName} {ans.response?.user?.lastName} ({ans.response?.user?.email})
                                      </div>
                                      <div style={{ color: '#ffffff' }}>{ans.textAnswer || 'Sans réponse'}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Multi-page Survey Builder Modal */}
      {showBuilderModal && (
        <Modal
          isOpen={showBuilderModal}
          onClose={closeBuilderModal}
          title={editingSurveyId ? 'Éditer le sondage étudiant' : 'Créer un sondage étudiant'}
          size="lg"
        >
          <form onSubmit={handleSaveSurvey} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '80vh', overflowY: 'auto', paddingRight: '4px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#ffffff', fontWeight: 600, marginBottom: '4px' }}>
                Titre du sondage *
              </label>
              <Input
                value={surveyTitle}
                onChange={(e) => setSurveyTitle(e.target.value)}
                placeholder="ex: Sondage de satisfaction S4S 2026"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#ffffff', fontWeight: 600, marginBottom: '4px' }}>
                Description globale (optionnel)
              </label>
              <textarea
                value={surveyDescription}
                onChange={(e) => setSurveyDescription(e.target.value)}
                placeholder="Consignes ou introduction générale pour les étudiants..."
                rows={2}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '0.6rem 0.8rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Pages Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#ff66b3', fontSize: '1.1rem', fontWeight: 700 }}>
                  Pages & Questions ({pages.length} pages)
                </h3>
                <Button type="button" variant="secondary" onClick={addPage} style={{ fontSize: '0.82rem' }}>
                  + Ajouter une page
                </Button>
              </div>

              {pages.map((page, pageIdx) => (
                <div key={pageIdx} className="builder-page-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                      <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.95rem' }}>Page #{pageIdx + 1}</span>
                      <input
                        type="text"
                        value={page.title}
                        onChange={(e) => {
                          const val = e.target.value
                          setPages((prev) =>
                            prev.map((p, idx) => (idx === pageIdx ? { ...p, title: val } : p))
                          )
                        }}
                        placeholder="Titre de la page (ex: Organisation générale)"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.9rem',
                          flex: 1,
                        }}
                      />
                    </div>
                    {pages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePage(pageIdx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem', marginLeft: '0.5rem' }}
                        title="Supprimer la page"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Questions inside Page */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {page.questions.map((q, qIdx) => (
                      <div key={qIdx} className="builder-question-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div style={{ flex: 2 }}>
                            <input
                              type="text"
                              value={q.title}
                              onChange={(e) => {
                                const val = e.target.value
                                setPages((prev) =>
                                  prev.map((p, pI) => {
                                    if (pI !== pageIdx) return p
                                    return {
                                      ...p,
                                      questions: p.questions.map((quest, qI) =>
                                        qI === qIdx ? { ...quest, title: val } : quest
                                      ),
                                    }
                                  })
                                )
                              }}
                              placeholder={`Intitulé question ${qIdx + 1} *`}
                              style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                              }}
                            />
                          </div>

                          <div style={{ flex: 1 }}>
                            <select
                              value={q.type}
                              onChange={(e) => updateQuestionType(pageIdx, qIdx, e.target.value as QuestionType)}
                              style={{
                                width: '100%',
                                background: '#1e192c',
                                border: '1px solid rgba(255,255,255,0.25)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.85rem',
                              }}
                            >
                              <option value="LIKERT_5">Échelle Likert (5 niveaux)</option>
                              <option value="OPEN_TEXT">Réponse texte ouverte</option>
                              <option value="SINGLE_CHOICE">Choix unique (Radio)</option>
                              <option value="MULTIPLE">Choix multiples (Cocher)</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeQuestion(pageIdx, qIdx)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Options editor for SINGLE_CHOICE or MULTIPLE */}
                        {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE') && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '0.5rem' }}>
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>Options de réponse :</span>
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>•</span>
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setPages((prev) =>
                                      prev.map((p, pI) => {
                                        if (pI !== pageIdx) return p
                                        return {
                                          ...p,
                                          questions: p.questions.map((quest, qI) => {
                                            if (qI !== qIdx) return quest
                                            return {
                                              ...quest,
                                              options: quest.options.map((o, oI) =>
                                                oI === optIdx ? { ...o, label: val } : o
                                              ),
                                            }
                                          }),
                                        }
                                      })
                                    )
                                  }}
                                  placeholder={`Option ${optIdx + 1}`}
                                  style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '4px',
                                    color: '#ffffff',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.82rem',
                                  }}
                                />
                                {q.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => removeOption(pageIdx, qIdx, optIdx)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addOption(pageIdx, qIdx)}
                              style={{ background: 'none', border: 'none', color: '#ff66b3', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline', alignSelf: 'flex-start' }}
                            >
                              + Ajouter option
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => addQuestion(pageIdx)}
                      style={{ fontSize: '0.82rem', marginTop: '0.25rem', color: '#ffffff' }}
                    >
                      + Ajouter une question à la page #{pageIdx + 1}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <Button type="button" variant="ghost" onClick={closeBuilderModal} style={{ color: '#ffffff' }}>
                Annuler
              </Button>
              <Button type="submit" variant="primary">
                {editingSurveyId ? 'Enregistrer les modifications' : 'Créer le sondage'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
