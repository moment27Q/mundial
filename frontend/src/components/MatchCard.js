import React, { useState } from 'react';
import api from '../services/api';

function formatDate(d) {
  return new Date(d).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ptsBadgeClass(pts) {
  if (pts === 5) return 'pts-badge pts-5';
  if (pts === 3) return 'pts-badge pts-3';
  if (pts === 2) return 'pts-badge pts-2';
  if (pts === 0) return 'pts-badge pts-0';
  return 'pts-badge pts-pending';
}

function ptsBadgeLabel(pts, scored) {
  if (!scored) return '⏳ Pendiente';
  if (pts === 5) return '🎯 ¡Exacto! +5 pts';
  if (pts === 3) return '✅ Ganador +3 pts';
  if (pts === 2) return '〰️ Diferencia +2 pts';
  return '❌ Sin puntos';
}

export default function MatchCard({ match, prediction: initialPred, onPredicted }) {
  const [predHome, setPredHome] = useState(initialPred?.home_score ?? '');
  const [predAway, setPredAway] = useState(initialPred?.away_score ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const now = new Date();
  const matchDate = new Date(match.match_date);
  const minutesLeft = (matchDate - now) / 60000;
  const canPredict = match.status === 'upcoming' && minutesLeft > 10;

  const totalPoints = initialPred
    ? (initialPred.total_points ?? null)
    : null;
  const earlyBonus = initialPred?.bonus_points > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (predHome === '' || predAway === '') return setError('Ingresá ambos marcadores');
    setSaving(true);
    setError('');
    try {
      await api.post('/predictions', {
        match_id: match.id,
        home_score: Number(predHome),
        away_score: Number(predAway),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onPredicted) onPredicted();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="match-card">
      <div className="match-header">
        <span className="match-stage">{match.stage}</span>
        <span className={`status-badge status-${match.status}`}>
          {match.status === 'upcoming' ? 'Próximo' : match.status === 'live' ? '🔴 EN VIVO' : 'Finalizado'}
        </span>
      </div>

      <div className="match-date">{formatDate(match.match_date)}</div>

      <div className="match-teams">
        <div className="team">
          <span className="team-flag">{match.home_flag}</span>
          <span className="team-name">{match.home_team}</span>
        </div>
        {match.status === 'finished' ? (
          <div className="match-score finished">{match.actual_home ?? match.home_score} - {match.actual_away ?? match.away_score}</div>
        ) : (
          <div className="match-vs">VS</div>
        )}
        <div className="team">
          <span className="team-flag">{match.away_flag}</span>
          <span className="team-name">{match.away_team}</span>
        </div>
      </div>

      {canPredict && (
        <form onSubmit={handleSubmit} className="prediction-form">
          <input
            type="number" min="0" max="20"
            className="score-input"
            value={predHome}
            onChange={e => setPredHome(e.target.value)}
            placeholder="0"
          />
          <span className="score-sep">-</span>
          <input
            type="number" min="0" max="20"
            className="score-input"
            value={predAway}
            onChange={e => setPredAway(e.target.value)}
            placeholder="0"
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? '...' : saved ? '✓' : 'Predecir'}
          </button>
        </form>
      )}

      {!canPredict && initialPred && (
        <div className="pred-result">
          <div style={{ marginBottom: 4, fontSize: '0.85rem', color: '#666' }}>
            Tu predicción: <strong>{initialPred.home_score} - {initialPred.away_score}</strong>
            {earlyBonus && <span style={{ marginLeft: 6, color: '#1a6b00' }}>+1 anticipada</span>}
          </div>
          {initialPred.scored !== undefined && (
            <span className={ptsBadgeClass(totalPoints)}>
              {ptsBadgeLabel(totalPoints, initialPred.scored)}
            </span>
          )}
        </div>
      )}

      {!canPredict && !initialPred && match.status === 'upcoming' && (
        <div className="text-muted text-center mt-8">⏰ Predicciones cerradas</div>
      )}

      {!canPredict && !initialPred && match.status !== 'upcoming' && (
        <div className="text-muted text-center mt-8">No predijiste este partido</div>
      )}

      {error && <div className="alert alert-error mt-8" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
