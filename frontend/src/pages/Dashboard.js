import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Leaderboard from '../components/Leaderboard';

function formatDate(d) {
  return new Date(d).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [matches, setMatches] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/matches', { params: { status: 'live,upcoming' } }),
      api.get('/leaderboard'),
      api.get('/predictions/my'),
      refreshUser(),
    ]).then(([m, lb, p]) => {
      const all = m.data;
      // Mostrar en vivo primero, luego próximos ordenados por fecha
      const live     = all.filter(x => x.status === 'live');
      const upcoming = all.filter(x => x.status === 'upcoming')
                          .sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
      setMatches([...live, ...upcoming].slice(0, 5));
      setLeaderboard(lb.data);
      setPredictions(p.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Cargando...</div>;

  const totalPredictions = predictions.length;
  const scoredPredictions = predictions.filter(p => p.scored);
  const correctPredictions = scoredPredictions.filter(p => p.base_points > 0);
  const accuracy = scoredPredictions.length > 0
    ? Math.round((correctPredictions.length / scoredPredictions.length) * 100)
    : 0;

  const myRank = leaderboard.find(e => e.id === user?.id)?.rank;

  return (
    <div className="page">
      <h1 className="page-title">⚽ Bienvenido, {user?.username}!</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">⭐ {user?.total_points ?? 0}</div>
          <div className="stat-label">Puntos totales</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{myRank ? `#${myRank}` : '-'}</div>
          <div className="stat-label">Posición global</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalPredictions}</div>
          <div className="stat-label">Predicciones hechas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{accuracy}%</div>
          <div className="stat-label">Precisión (ganador)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Próximos partidos</h2>
            <Link to="/predictions" className="btn btn-secondary btn-sm">Ver todos</Link>
          </div>
          {matches.length === 0 ? (
            <div className="empty"><div className="empty-icon">📅</div><p>No hay partidos próximos</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {matches.map(m => (
                <div key={m.id} className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.home_flag} {m.home_team} vs {m.away_team} {m.away_flag}</span>
                      <div className="text-muted" style={{ marginTop: 2 }}>{formatDate(m.match_date)}</div>
                    </div>
                    <span className="match-stage">{m.stage}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>🏆 Tabla global</h2>
            <Link to="/rooms" className="btn btn-secondary btn-sm">Mis salas</Link>
          </div>
          <div className="card">
            <Leaderboard entries={leaderboard} limit={10} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20, background: 'linear-gradient(135deg, #1a6b00 0%, #2d9e00 100%)', color: '#fff', padding: 24 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 8 }}>📋 Sistema de puntuación</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { icon: '🎯', label: 'Marcador exacto', pts: '+5 pts' },
            { icon: '✅', label: 'Ganador correcto', pts: '+3 pts' },
            { icon: '〰️', label: 'Diferencia de goles', pts: '+2 pts' },
            { icon: '🔥', label: 'Racha de 3 seguidos', pts: '+2 pts extra' },
            { icon: '⚡', label: 'Predicción anticipada (+24h)', pts: '+1 pt extra' },
          ].map(r => (
            <div key={r.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: '1.2rem' }}>{r.icon}</span>
              <div style={{ fontSize: '0.85rem', marginTop: 4 }}>{r.label}</div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{r.pts}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
