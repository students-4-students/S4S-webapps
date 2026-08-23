import { useState } from 'react'
import { trpc } from '../trpc'
import { LIKERT_5_OPTIONS } from '@s4s/types'

export default function S4SConnectFeedback() {
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  
  // Answers state map: questionId -> { textAnswer?: string, optionId?: string, optionIds?: string[] }
  const [answers, setAnswers] = useState<Record<string, { textAnswer?: string; optionId?: string; optionIds?: string[] }>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)

  const utils = trpc.useUtils()

  // Queries
  const { data: surveys = [], isLoading } = trpc.feedback.list.useQuery()
  const { data: activeSurvey } = trpc.feedback.getById.useQuery(
    { id: selectedSurveyId! },
    { enabled: Boolean(selectedSurveyId) }
  )

  // Realtime subscription
  trpc.feedback.onUpdated.useSubscription(undefined, {
    onData: () => {
      utils.feedback.list.invalidate()
      if (selectedSurveyId) {
        utils.feedback.getById.invalidate({ id: selectedSurveyId })
      }
    },
  })

  // Submit mutation
  const submitMutation = trpc.feedback.submitResponse.useMutation({
    onSuccess: () => {
      setIsSubmitted(true)
      utils.feedback.list.invalidate()
      if (selectedSurveyId) utils.feedback.getById.invalidate({ id: selectedSurveyId })
    },
  })

  const openSurvey = (surveyId: string) => {
    setSelectedSurveyId(surveyId)
    setCurrentPageIdx(0)
    setAnswers({})
    setIsSubmitted(false)
  }

  const handleLikertSelect = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { textAnswer: value },
    }))
  }

  const handleSingleChoiceSelect = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { optionId },
    }))
  }

  const handleMultipleSelect = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const currentOptIds = prev[questionId]?.optionIds || []
      const exists = currentOptIds.includes(optionId)
      const nextOptIds = exists ? currentOptIds.filter((id) => id !== optionId) : [...currentOptIds, optionId]
      return {
        ...prev,
        [questionId]: { optionIds: nextOptIds },
      }
    })
  }

  const handleTextChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { textAnswer: text },
    }))
  }

  // Handle survey submission
  const handleSubmit = async () => {
    if (!activeSurvey) return

    // Verify required questions across all pages
    for (let pIdx = 0; pIdx < activeSurvey.pages.length; pIdx++) {
      const page = activeSurvey.pages[pIdx]
      for (const q of page.questions) {
        if (q.required) {
          const ans = answers[q.id]
          const isAnswered =
            ans &&
            (ans.textAnswer?.trim() ||
              ans.optionId ||
              (ans.optionIds && ans.optionIds.length > 0))
          if (!isAnswered) {
            alert(`Veuillez répondre à la question obligatoire : "${q.title}" (Page ${pIdx + 1})`)
            setCurrentPageIdx(pIdx)
            return
          }
        }
      }
    }

    const answersPayload = Object.entries(answers).map(([questionId, ansVal]) => ({
      questionId,
      textAnswer: ansVal.textAnswer,
      optionId: ansVal.optionId,
      optionIds: ansVal.optionIds,
    }))

    await submitMutation.mutateAsync({
      surveyId: activeSurvey.id,
      answers: answersPayload,
    })
  }

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
        Chargement des sondages...
      </div>
    )
  }

  // Survey Detail / Answering view
  if (selectedSurveyId && activeSurvey) {
    const pagesCount = activeSurvey.pages.length
    const currentPage = activeSurvey.pages[currentPageIdx]
    const hasAlreadyResponded = activeSurvey.responses && activeSurvey.responses.length > 0

    if (isSubmitted || hasAlreadyResponded) {
      return (
        <div style={{ padding: '1.5rem', maxWidth: '600px', margin: '0 auto', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Merci pour votre feedback !</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Vos réponses au sondage <strong>{activeSurvey.title}</strong> ont bien été enregistrées.
          </p>
          <button
            onClick={() => setSelectedSurveyId(null)}
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retour à la liste des sondages
          </button>
        </div>
      )
    }

    return (
      <div style={{ padding: '1rem 1.25rem', maxWidth: '650px', margin: '0 auto', color: '#fff' }}>
        <button
          onClick={() => setSelectedSurveyId(null)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1rem' }}
        >
          ← Retour aux sondages
        </button>

        {/* Survey Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.4rem 0' }}>
            {activeSurvey.title}
          </h1>
          {activeSurvey.description && (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.92rem', margin: 0 }}>
              {activeSurvey.description}
            </p>
          )}

          {/* Stepper Progress Bar */}
          {pagesCount > 1 && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.35rem' }}>
                <span>Page {currentPageIdx + 1} sur {pagesCount}</span>
                <span>{Math.round(((currentPageIdx + 1) / pagesCount) * 100)}%</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${((currentPageIdx + 1) / pagesCount) * 100}%`,
                    background: 'linear-gradient(90deg, #ec4899, #8b5cf6)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Page Content */}
        {currentPage && (
          <div style={{ background: 'rgba(35, 27, 52, 0.75)', border: '1px solid rgba(238,212,241,0.15)', borderRadius: '16px', padding: '1.25rem', backdropFilter: 'blur(10px)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ec4899', margin: '0 0 0.25rem 0' }}>
              {currentPage.title}
            </h2>
            {currentPage.description && (
              <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.6)', margin: '0 0 1rem 0' }}>
                {currentPage.description}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
              {currentPage.questions.map((q: any, qIdx: number) => {
                const currentAnswer = answers[q.id]

                return (
                  <div key={q.id} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.98rem', marginBottom: '0.25rem' }}>
                      {qIdx + 1}. {q.title} {q.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    {q.description && (
                      <span style={{ display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.75rem' }}>
                        {q.description}
                      </span>
                    )}

                    {/* Question Type 1: LIKERT_5 */}
                    {q.type === 'LIKERT_5' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
                        {LIKERT_5_OPTIONS.map((opt) => {
                          const isSelected = currentAnswer?.textAnswer === opt
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleLikertSelect(q.id, opt)}
                              style={{
                                padding: '0.6rem 0.4rem',
                                borderRadius: '10px',
                                border: isSelected ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.12)',
                                background: isSelected ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' : 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                fontSize: '0.78rem',
                                fontWeight: isSelected ? 700 : 500,
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Question Type 2: OPEN_TEXT */}
                    {q.type === 'OPEN_TEXT' && (
                      <textarea
                        value={currentAnswer?.textAnswer || ''}
                        onChange={(e) => handleTextChange(q.id, e.target.value)}
                        placeholder="Écrivez votre réponse ici..."
                        rows={3}
                        style={{
                          width: '100%',
                          marginTop: '0.5rem',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '8px',
                          color: '#fff',
                          padding: '0.6rem 0.8rem',
                          boxSizing: 'border-box',
                          fontSize: '0.9rem',
                        }}
                      />
                    )}

                    {/* Question Type 3: SINGLE_CHOICE */}
                    {q.type === 'SINGLE_CHOICE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {q.options.map((opt: any) => {
                          const isSelected = currentAnswer?.optionId === opt.id
                          return (
                            <label
                              key={opt.id}
                              onClick={() => handleSingleChoiceSelect(q.id, opt.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.65rem',
                                padding: '0.65rem 0.85rem',
                                borderRadius: '8px',
                                background: isSelected ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.04)',
                                border: isSelected ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.08)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                              }}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                checked={isSelected}
                                onChange={() => handleSingleChoiceSelect(q.id, opt.id)}
                                style={{ accentColor: '#ec4899' }}
                              />
                              <span>{opt.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {/* Question Type 4: MULTIPLE */}
                    {q.type === 'MULTIPLE' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {q.options.map((opt: any) => {
                          const isSelected = currentAnswer?.optionIds?.includes(opt.id)
                          return (
                            <label
                              key={opt.id}
                              onClick={() => handleMultipleSelect(q.id, opt.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.65rem',
                                padding: '0.65rem 0.85rem',
                                borderRadius: '8px',
                                background: isSelected ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.04)',
                                border: isSelected ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.08)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected || false}
                                onChange={() => handleMultipleSelect(q.id, opt.id)}
                                style={{ accentColor: '#ec4899' }}
                              />
                              <span>{opt.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Navigation buttons between pages */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {currentPageIdx > 0 ? (
                <button
                  type="button"
                  onClick={() => setCurrentPageIdx((p) => p - 1)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.25rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  ← Page précédente
                </button>
              ) : <div />}

              {currentPageIdx < pagesCount - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentPageIdx((p) => p + 1)}
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.25rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Page suivante →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.5rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                  }}
                >
                  {submitMutation.isPending ? 'Envoi...' : 'Envoyer mes réponses ✓'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Survey List View
  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: '650px', margin: '0 auto', color: '#fff' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
        Sondages & Feedback 💬
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', margin: '0 0 1.25rem 0' }}>
        Donnez votre avis sur l'événement et aidez-nous à l'améliorer !
      </p>

      {surveys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.15)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Aucun sondage actif pour le moment</h3>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Revenez un peu plus tard !</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {surveys.map((survey: any) => {
            const hasResponded = survey.responses && survey.responses.length > 0

            return (
              <div
                key={survey.id}
                style={{
                  background: 'rgba(35, 27, 52, 0.75)',
                  border: '1px solid rgba(238,212,241,0.15)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{survey.title}</h3>
                    {hasResponded && (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                        ✓ Répondu
                      </span>
                    )}
                  </div>
                  {survey.description && (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                      {survey.description}
                    </p>
                  )}
                  <span style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                    {survey.pages.length} page(s)
                  </span>
                </div>

                <button
                  onClick={() => openSurvey(survey.id)}
                  style={{
                    background: hasResponded
                      ? 'rgba(255,255,255,0.1)'
                      : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.65rem 1.1rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {hasResponded ? 'Revoir' : 'Répondre →'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
