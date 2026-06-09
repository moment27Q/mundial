import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import './MatchModal.css';

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s/60)}m`;
  if (s < 86400) return `hace ${Math.floor(s/3600)}h`;
  return `hace ${Math.floor(s/86400)}d`;
}

function formatDate(d) {
  return new Date(d).toLocaleString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function ptsBadge(pred) {
  if (!pred?.scored) return { cls: 'pending', label: '⏳ Pendiente' };
  const p = pred.total_points ?? 0;
  if (p >= 5) return { cls: 'exact',  label: '🎯 ¡Exacto! +5' };
  if (p >= 3) return { cls: 'winner', label: '✅ Ganador +3' };
  if (p >= 2) return { cls: 'diff',   label: '〰 Diferencia +2' };
  return { cls: 'none', label: '❌ Sin puntos' };
}

function liveLabel(statusShort, elapsed) {
  if (!statusShort) return { text: 'EN VIVO', sub: null };
  if (statusShort === 'HT')  return { text: 'ET', sub: 'Descanso' };
  if (statusShort === 'ET')  return { text: 'PRÓRROGA', sub: elapsed ? `${elapsed}'` : null };
  if (statusShort === 'P')   return { text: 'PENALES', sub: null };
  if (statusShort === 'BT')  return { text: 'DESC. EXTRA', sub: null };
  if (statusShort === '1H')  return { text: `${elapsed}'`, sub: '1er Tiempo' };
  if (statusShort === '2H')  return { text: `${elapsed}'`, sub: '2do Tiempo' };
  if (elapsed != null)       return { text: `${elapsed}'`, sub: null };
  return { text: 'EN VIVO', sub: null };
}

export default function MatchModal({ match: initMatch, prediction: initPred, onClose, onPredicted }) {
  const [match, setMatch]       = useState(initMatch);
  const [predHome, setPredHome] = useState(initPred?.home_score ?? '');
  const [predAway, setPredAway] = useState(initPred?.away_score ?? '');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [trends, setTrends]     = useState(null);
  const refreshRef              = useRef(null);

  const now        = new Date();
  const matchDate  = new Date(match.match_date);
  const canPredict = match.status === 'upcoming' && (matchDate - now) / 60000 > 10;

  async function loadTrends() {
    try {
      const r = await api.get(`/matches/${match.id}/trends`);
      setTrends(r.data);
    } catch {}
  }

  async function refreshMatch() {
    try {
      const r = await api.get(`/matches/${match.id}`);
      setMatch(r.data);
    } catch {}
  }

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      clearInterval(refreshRef.current);
    };
  }, [onClose]);

  useEffect(() => {
    loadTrends();
    if (match.status === 'live') {
      refreshRef.current = setInterval(() => {
        refreshMatch();
        loadTrends();
      }, 30_000);
    }
    return () => clearInterval(refreshRef.current);
  }, [match.id, match.status]);

  async function handlePredict(e) {
    e.preventDefault();
    if (predHome === '' || predAway === '') return setError('Ingresá ambos marcadores');
    setSaving(true); setError('');
    try {
      await api.post('/predictions', {
        match_id: match.id,
        home_score: Number(predHome),
        away_score: Number(predAway),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); if (onPredicted) onPredicted(); }, 900);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function pickScore(score) {
    if (!canPredict) return;
    const [h, a] = score.split('-');
    setPredHome(h); setPredAway(a);
  }

  const maxTrendPct = trends?.trends?.[0]?.pct || 1;
  const total       = trends?.total || 0;
  const winner      = trends?.winner || { home: 0, draw: 0, away: 0 };
  const winTotal    = winner.home + winner.draw + winner.away || 1;
  const badge       = ptsBadge(initPred);
  const live        = liveLabel(match.status_short, match.elapsed);
  const isLive      = match.status === 'live';
  const isDone      = match.status === 'finished';

  return (
    <div className="mmodal-overlay" onClick={onClose}>
      <div className="mmodal" onClick={e => e.stopPropagation()}>

        {/* HERO */}
        <div className="mmodal-hero">
          <button className="mmodal-close" onClick={onClose}>✕</button>
          <div className="mmodal-hero-top">
            <span className="mmodal-stage-chip">{match.stage}</span>
            {isLive && (
              <span className="mmodal-status-chip live">
                <span className="mmodal-live-dot" /> EN VIVO
              </span>
            )}
            {isDone && <span className="mmodal-status-chip finished">Finalizado</span>}
            {!isLive && !isDone && <span className="mmodal-status-chip upcoming">Próximo</span>}
          </div>

          <div className="mmodal-teams">
            <div className="mmodal-team">
              <span className="mmodal-team-flag">{match.home_flag}</span>
              <span className="mmodal-team-name">{match.home_team}</span>
            </div>

            <div className="mmodal-center">
              {(isLive || isDone) && match.home_score != null ? (
                <div className="mmodal-scoreboard">
                  <span className="mmodal-score">{match.home_score} : {match.away_score}</span>
                  {isLive && (
                    <div className="mmodal-clock">
                      <span className="mmodal-clock-dot" />
                      <span className="mmodal-clock-time">{live.text}</span>
                      {live.sub && <span className="mmodal-clock-sub">{live.sub}</span>}
                    </div>
                  )}
                  {isDone && <span className="mmodal-ft">Tiempo reglamentario</span>}
                </div>
              ) : (
                <div className="mmodal-scoreboard">
                  <span className="mmodal-vs">VS</span>
                  <span className="mmodal-kickoff">{formatDate(match.match_date)}</span>
                </div>
              )}
            </div>

            <div className="mmodal-team">
              <span className="mmodal-team-flag">{match.away_flag}</span>
              <span className="mmodal-team-name">{match.away_team}</span>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="mmodal-body">

          {/* TENDENCIAS */}
          <div className="mmodal-section">
            <div className="mmodal-section-label">
              Marcadores en tendencia {total > 0 && <span style={{ color: '#cbd5e1' }}>· {total} apuesta{total !== 1 ? 's' : ''}</span>}
            </div>

            {!trends && <div className="mmodal-no-trends">Cargando...</div>}
            {trends && trends.trends.length === 0 && (
              <div className="mmodal-no-trends">Aún no hay apuestas — ¡sé el primero!</div>
            )}
            {trends && trends.trends.length > 0 && (
              <>
                <div className="mmodal-trends-grid">
                  {trends.trends.map((t, i) => (
                    <div
                      key={t.score}
                      className={`mmodal-trend-item${i === 0 ? ' top' : ''}`}
                      onClick={() => pickScore(t.score)}
                      title={canPredict ? 'Click para usar este marcador' : ''}
                    >
                      <div className="mmodal-trend-score">{t.score}</div>
                      <div className="mmodal-trend-bar-bg">
                        <div className="mmodal-trend-bar-fill" style={{ width: `${(t.pct / maxTrendPct) * 100}%` }} />
                      </div>
                      <div className="mmodal-trend-pct">{t.pct}%</div>
                    </div>
                  ))}
                </div>

                {/* Winner tendency bar */}
                <div className="mmodal-winner-bar" style={{ marginTop: 14 }}>
                  <div className="mmodal-winner-seg home" style={{ flex: winner.home || 0.1 }}>
                    {Math.round((winner.home / winTotal) * 100)}%
                  </div>
                  <div className="mmodal-winner-seg draw" style={{ flex: winner.draw || 0.1 }}>
                    {Math.round((winner.draw / winTotal) * 100)}%
                  </div>
                  <div className="mmodal-winner-seg away" style={{ flex: winner.away || 0.1 }}>
                    {Math.round((winner.away / winTotal) * 100)}%
                  </div>
                </div>
                <div className="mmodal-winner-labels">
                  <span>{match.home_team}</span>
                  <span>Empate</span>
                  <span>{match.away_team}</span>
                </div>
              </>
            )}
          </div>

          {/* PREDICCIÓN */}
          <div className="mmodal-section">
            <div className="mmodal-section-label">Tu predicción</div>

            {canPredict ? (
              <form onSubmit={handlePredict}>
                <div className="mmodal-predict-form">
                  <div className="mmodal-score-wrap">
                    <input
                      className="mmodal-score-input"
                      type="number" min="0" max="20"
                      value={predHome}
                      onChange={e => setPredHome(e.target.value)}
                      placeholder="0"
                    />
                    <span className="mmodal-score-sep">—</span>
                    <input
                      className="mmodal-score-input"
                      type="number" min="0" max="20"
                      value={predAway}
                      onChange={e => setPredAway(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <button
                    type="submit"
                    className={`mmodal-predict-btn${saved ? ' saved' : ''}`}
                    disabled={saving}
                  >
                    {saving ? '...' : saved ? '✓ Guardado' : initPred ? 'Actualizar' : 'Apostar'}
                  </button>
                </div>
                {error && <div className="mmodal-error">{error}</div>}
              </form>
            ) : initPred ? (
              <div className="mmodal-pred-result">
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 4 }}>Predijiste</div>
                  <div className="mmodal-pred-score">{initPred.home_score} — {initPred.away_score}</div>
                </div>
                <span className={`mmodal-pred-badge ${badge.cls}`}>{badge.label}</span>
              </div>
            ) : (
              <div className="mmodal-no-trends">
                {match.status === 'upcoming' ? '⏰ Predicciones cerradas' : 'No predijiste este partido'}
              </div>
            )}
          </div>

          {/* ÚLTIMAS APUESTAS */}
          <div className="mmodal-section">
            <div className="mmodal-section-label">Últimas apuestas</div>
            {!trends || trends.recent.length === 0 ? (
              <div className="mmodal-empty-recent">Sin apuestas aún</div>
            ) : (
              <div className="mmodal-recent-list">
                {trends.recent.map((r, i) => (
                  <div key={i} className="mmodal-recent-row">
                    <div className="mmodal-recent-avatar">{r.username[0]}</div>
                    <span className="mmodal-recent-user">{r.username}</span>
                    <span className="mmodal-recent-score">{r.home_score}—{r.away_score}</span>
                    <span className="mmodal-recent-time">{timeAgo(r.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
