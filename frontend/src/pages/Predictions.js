import React, { useEffect, useState } from 'react';
import api from '../services/api';
import MatchCard from '../components/MatchCard';

export default function Predictions() {
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [tab, setTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);

  async function load() {
    const [matchRes, predRes] = await Promise.all([
      api.get('/matches'),
      api.get('/predictions/my'),
    ]);
    setMatches(matchRes.data);
    const predMap = {};
    predRes.data.forEach(p => { predMap[p.match_id] = p; });
    setPredictions(predMap);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Cargando partidos...</div>;

  const filtered = tab === 'upcoming'
    ? matches.filter(m => m.status === 'upcoming')
    : tab === 'finished'
    ? matches.filter(m => m.status === 'finished')
    : matches;

  return (
    <div className="page">
      <h1 className="page-title">🔮 Mis Predicciones</h1>

      <div className="tabs">
        {['upcoming', 'finished', 'all'].map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'upcoming' ? '⏰ Próximos' : t === 'finished' ? '✅ Finalizados' : '📋 Todos'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⚽</div>
          <p>{tab === 'upcoming' ? 'No hay partidos próximos' : 'No hay partidos en esta categoría'}</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictions[match.id] || null}
              onPredicted={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
