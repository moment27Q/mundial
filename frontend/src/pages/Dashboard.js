import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Leaderboard from '../components/Leaderboard';
import MatchModal from '../components/MatchModal';
import './Dashboard.css';

function formatDate(d) {
  return new Date(d).toLocaleString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

const SCORING_RULES = [
  { label: 'Marcador exacto',     pts: '+5 pts' },
  { label: 'Ganador correcto',    pts: '+3 pts' },
  { label: 'Diferencia de goles', pts: '+2 pts' },
  { label: 'Racha de 3 seguidos', pts: '+2 extra' },
  { label: 'Predicción con 24h+', pts: '+1 extra' },
];

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [matches, setMatches]         = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [predMap, setPredMap]         = useState({});
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState(null);

  async function load() {
    const [m, lb, p] = await Promise.all([
      api.get('/matches', { params: { status: 'live,upcoming' } }),
      api.get('/leaderboard'),
      api.get('/predictions/my'),
    ]);
    const all     = m.data;
    const live    = all.filter(x => x.status === 'live');
    const upcoming = all.filter(x => x.status === 'upcoming')
                       .sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
    setMatches([...live, ...upcoming].slice(0, 6));
    setLeaderboard(lb.data);
    const map = {};
    p.data.forEach(pred => { map[pred.match_id] = pred; });
    setPredMap(map);
  }

  useEffect(() => {
    Promise.all([load(), refreshUser()]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Cargando...</div>;

  const predictions  = Object.values(predMap);
  const total        = predictions.length;
  const scored       = predictions.filter(p => p.scored);
  const correct      = scored.filter(p => p.base_points > 0);
  const accuracy     = scored.length > 0 ? Math.round((correct.length / scored.length) * 100) : 0;
  const myRank       = leaderboard.find(e => e.id === user?.id)?.rank;

  return (
    <div className="dash">

      <div className="dash-header">
        <div>
          <p className="dash-greeting">Bienvenido de vuelta</p>
          <h1 className="dash-username">{user?.username}</h1>
        </div>
        <Link to="/predictions" className="btn btn-primary">Predecir partidos</Link>
      </div>

      <div className="dash-stats">
        <div className="dash-stat">
          <span className="dash-stat-val">{user?.total_points ?? 0}</span>
          <span className="dash-stat-label">Puntos</span>
        </div>
        <div className="dash-stat-div" />
        <div className="dash-stat">
          <span className="dash-stat-val">{myRank ? `#${myRank}` : '—'}</span>
          <span className="dash-stat-label">Posición</span>
        </div>
        <div className="dash-stat-div" />
        <div className="dash-stat">
          <span className="dash-stat-val">{total}</span>
          <span className="dash-stat-label">Predicciones</span>
        </div>
        <div className="dash-stat-div" />
        <div className="dash-stat">
          <span className="dash-stat-val">{accuracy}%</span>
          <span className="dash-stat-label">Precisión</span>
        </div>
      </div>

      <div className="dash-grid">

        <div className="dash-section">
          <div className="dash-section-head">
            <h2>Próximos partidos</h2>
            <Link to="/predictions">Ver todos →</Link>
          </div>
          {matches.length === 0 ? (
            <div className="dash-empty">No hay partidos próximos</div>
          ) : (
            matches.map(m => (
              <div
                key={m.id}
                className={`dash-match${m.status === 'live' ? ' is-live' : ''}`}
                onClick={() => setSelected(m)}
                style={{ cursor: 'pointer' }}
              >
                <div className="dash-match-teams">
                  <div className="dash-match-row">
                    <span>{m.home_flag} {m.home_team}</span>
                    <span className="dash-match-vs">vs</span>
                    <span>{m.away_team} {m.away_flag}</span>
                  </div>
                  <div className="dash-match-meta">
                    <span className="dash-match-date">{formatDate(m.match_date)}</span>
                    <span className="dash-match-stage">{m.stage}</span>
                  </div>
                </div>
                {m.status === 'live' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="dash-live-dot" />
                    <span className="dash-live-label">EN VIVO</span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>›</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="dash-aside">
          <div className="dash-section">
            <div className="dash-section-head">
              <h2>Tabla global</h2>
              <Link to="/rooms">Mis salas →</Link>
            </div>
            <Leaderboard entries={leaderboard} limit={8} />
          </div>

          <div className="dash-scoring">
            <div className="dash-scoring-head">Puntuación</div>
            <div className="dash-scoring-list">
              {SCORING_RULES.map(r => (
                <div key={r.label} className="dash-scoring-row">
                  <span className="dash-scoring-name">{r.label}</span>
                  <span className="dash-scoring-pts">{r.pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <MatchModal
          match={selected}
          prediction={predMap[selected.id] || null}
          onClose={() => setSelected(null)}
          onPredicted={() => { load(); setSelected(null); }}
        />
      )}
    </div>
  );
}
