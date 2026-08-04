import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { trpc } from '../trpc'
import '../../styles/scan.css'

type Entrance = 'A' | 'B'

type ScanResult =
  | { status: 'OK'; name: string; section: string; group: string; time: Date }
  | { status: 'ALREADY_SCANNED'; name: string; section: string; scannedAt: Date }
  | { status: 'WRONG_ENTRANCE'; name: string; section: string; expected: string; time: Date }
  | { status: 'ERROR'; message: string }

type FeedbackState = ScanResult & { key: number }

export default function Scan() {
  const [entrance, setEntrance] = useState<Entrance | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackKey = useRef(0)

  // Keep mutable refs so the scanner callback never goes stale
  const entranceRef = useRef<Entrance | null>(null)
  const isProcessingRef = useRef(false)

  const { data: stats, refetch: refetchStats } = trpc.scan.stats.useQuery(undefined, {
    refetchInterval: 10_000,
  })
  const scanMutation = trpc.scan.scanStudent.useMutation()

  // Keep entranceRef in sync
  useEffect(() => { entranceRef.current = entrance }, [entrance])

  const showFeedback = useCallback((result: ScanResult) => {
    feedbackKey.current += 1
    setFeedback({ ...result, key: feedbackKey.current })
    setLastResult(result)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2500)
  }, [])

  // Stable scan handler — reads from refs, never captured as a stale closure
  const handleScanRef = useRef(async (decodedText: string) => {
    if (isProcessingRef.current || !entranceRef.current) return
    isProcessingRef.current = true
    try {
      const result = await scanMutation.mutateAsync({
        qrContent: decodedText,
        entrance: entranceRef.current,
      })

      const student = result.student
      const name = `${student.firstName} ${student.lastName}`
      const section = student.section?.name ?? '—'

      if (result.status === 'OK') {
        showFeedback({ status: 'OK', name, section, group: entranceRef.current!, time: new Date() })
        refetchStats()
      } else if (result.status === 'ALREADY_SCANNED') {
        const r = result as { status: 'ALREADY_SCANNED'; scannedAt: string | Date }
        showFeedback({ status: 'ALREADY_SCANNED', name, section, scannedAt: new Date(r.scannedAt) })
      } else if (result.status === 'WRONG_ENTRANCE') {
        const r = result as { status: 'WRONG_ENTRANCE'; expectedEntrance: string }
        showFeedback({ status: 'WRONG_ENTRANCE', name, section, expected: r.expectedEntrance, time: new Date() })
      }
    } catch (err: any) {
      showFeedback({ status: 'ERROR', message: err?.message ?? 'Erreur inconnue' })
    } finally {
      setTimeout(() => { isProcessingRef.current = false }, 1500)
    }
  })

  // Keep handleScanRef up to date with latest showFeedback / scanMutation / refetchStats
  useEffect(() => {
    handleScanRef.current = async (decodedText: string) => {
      if (isProcessingRef.current || !entranceRef.current) return
      isProcessingRef.current = true
      try {
        const result = await scanMutation.mutateAsync({
          qrContent: decodedText,
          entrance: entranceRef.current,
        })
        const student = result.student
        const name = `${student.firstName} ${student.lastName}`
        const section = student.section?.name ?? '—'

        if (result.status === 'OK') {
          showFeedback({ status: 'OK', name, section, group: entranceRef.current!, time: new Date() })
          refetchStats()
        } else if (result.status === 'ALREADY_SCANNED') {
          const r = result as { status: 'ALREADY_SCANNED'; scannedAt: string | Date }
          showFeedback({ status: 'ALREADY_SCANNED', name, section, scannedAt: new Date(r.scannedAt) })
        } else if (result.status === 'WRONG_ENTRANCE') {
          const r = result as { status: 'WRONG_ENTRANCE'; expectedEntrance: string }
          showFeedback({ status: 'WRONG_ENTRANCE', name, section, expected: r.expectedEntrance, time: new Date() })
        }
      } catch (err: any) {
        showFeedback({ status: 'ERROR', message: err?.message ?? 'Erreur inconnue' })
      } finally {
        setTimeout(() => { isProcessingRef.current = false }, 1500)
      }
    }
  }, [scanMutation, showFeedback, refetchStats])

  // Mount scanner once — clear container first to survive React StrictMode double-mount
  useEffect(() => {
    const elementId = 'qr-reader'

    // ⚠️ Clear any stale html5-qrcode markup left by a previous mount (StrictMode)
    const container = document.getElementById(elementId)
    if (container) container.innerHTML = ''

    const scanner = new Html5Qrcode(elementId)
    let started = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => handleScanRef.current(text),
        undefined
      )
      .then(() => { started = true })
      .catch(() => { /* camera unavailable — scanner shows its own file-upload fallback */ })

    return () => {
      if (started) {
        scanner.stop().catch(() => {}).finally(() => {
          try { scanner.clear() } catch { }
        })
      } else {
        try { scanner.clear() } catch { }
      }
    }
  }, []) // intentionally empty — camera starts once and stays on

  const scannedPercent = stats ? Math.round((stats.scanned / Math.max(stats.total, 1)) * 100) : 0

  return (
    <div className="scan-page">

      {/* ── Stats bar ── */}
      {stats && (
        <div className="scan-stats-bar">
          <div className="scan-stat-pill">
            <div className="stat-value">{stats.scanned}/{stats.total}</div>
            <div className="stat-label">Scannés ({scannedPercent}%)</div>
          </div>
          <div className="scan-stat-pill pill-a">
            <div className="stat-value">{stats.scannedA}</div>
            <div className="stat-label">Entrée A</div>
          </div>
          <div className="scan-stat-pill pill-b">
            <div className="stat-value">{stats.scannedB}</div>
            <div className="stat-label">Entrée B</div>
          </div>
        </div>
      )}

      {/* ── Entrance selector ── */}
      <div className="entrance-selector">
        <h2>Entrée active</h2>
        <div className="entrance-buttons">
          {(['A', 'B'] as const).map((grp) => (
            <button
              key={grp}
              className={`entrance-btn entrance-btn-${grp.toLowerCase()} ${entrance === grp ? 'active' : ''}`}
              onClick={() => setEntrance(grp)}
            >
              <span className="btn-group-label">{grp}</span>
              <span className="btn-sub">Sélectionner</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Scanner ── */}
      <div className="scanner-wrapper">
        <div className="scanner-card">
          <div className="scanner-header">
            <span className="scanner-dot" />
            <span>Caméra active</span>
            {entrance && (
              <span className={`scanner-entrance-badge badge-${entrance.toLowerCase()}`}>
                Entrée {entrance}
              </span>
            )}
          </div>
          <div className="scanner-inner">
            <div id="qr-reader" style={{ width: '100%' }} />
            {!entrance && (
              <div className="scanner-no-entrance">
                <span className="arrow-up">☝️</span>
                <p>Sélectionnez une entrée<br />avant de scanner</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Last scan result ── */}
      {lastResult && (
        <div className={`last-scan result-${lastResult.status === 'OK' ? 'ok' : lastResult.status === 'WRONG_ENTRANCE' ? 'warning' : 'error'}`}>
          <span className="last-scan-icon">
            {lastResult.status === 'OK' ? '✅' : lastResult.status === 'WRONG_ENTRANCE' ? '⚠️' : lastResult.status === 'ALREADY_SCANNED' ? '🔄' : '❌'}
          </span>
          <div className="last-scan-info">
            <div className="last-scan-name">
              {'name' in lastResult ? lastResult.name : 'Erreur'}
            </div>
            <div className="last-scan-detail">
              {lastResult.status === 'OK' && `✓ Validé · ${lastResult.section}`}
              {lastResult.status === 'ALREADY_SCANNED' && `Déjà scanné · ${lastResult.section}`}
              {lastResult.status === 'WRONG_ENTRANCE' && `Devrait être à l'entrée ${lastResult.expected} · ${lastResult.section}`}
              {lastResult.status === 'ERROR' && lastResult.message}
            </div>
          </div>
          <div className="last-scan-time">
            {'time' in lastResult && lastResult.time instanceof Date
              ? lastResult.time.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : 'scannedAt' in lastResult && lastResult.scannedAt instanceof Date
              ? lastResult.scannedAt.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
              : ''}
          </div>
        </div>
      )}

      {/* ── Full-screen feedback overlay ── */}
      {feedback && (
        <div
          key={feedback.key}
          className={`scan-feedback feedback-${
            feedback.status === 'OK' ? 'ok' :
            feedback.status === 'WRONG_ENTRANCE' ? 'warning' : 'error'
          }`}
          onClick={() => setFeedback(null)}
        >
          <div className="feedback-content">
            <span className="feedback-icon">
              {feedback.status === 'OK' ? '✅' :
               feedback.status === 'ALREADY_SCANNED' ? '🔄' :
               feedback.status === 'WRONG_ENTRANCE' ? '⚠️' : '❌'}
            </span>
            <p className="feedback-title">
              {feedback.status === 'OK' ? 'Bienvenue !' :
               feedback.status === 'ALREADY_SCANNED' ? 'Déjà scanné' :
               feedback.status === 'WRONG_ENTRANCE' ? 'Mauvaise entrée' : 'Erreur'}
            </p>
            {'name' in feedback && (
              <p className="feedback-name">{feedback.name}</p>
            )}
            <p className="feedback-detail">
              {feedback.status === 'OK' && `Entrée ${feedback.group} · ${feedback.section}`}
              {feedback.status === 'ALREADY_SCANNED' && (
                <>Scanné à {(feedback.scannedAt as Date).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}</>
              )}
              {feedback.status === 'WRONG_ENTRANCE' && (
                <span className="feedback-badge">→ Entrée {feedback.expected}</span>
              )}
              {feedback.status === 'ERROR' && feedback.message}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
