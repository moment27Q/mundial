import React, { useEffect, useState } from 'react';
import api from '../services/api';

function formatDate(d) {
  return new Date(d).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const emptyMatch = { home_team: '', away_team: '', home_flag: '', away_flag: '', stage: 'Grupo A', match_date: '' };

export default function Admin() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyMatch);
  const [editMatch, setEditMatch] = useState(null);
  const [scoreModal, setScoreModal] = useState(null);
  const [scoreForm, setScoreForm] = useState({ home_score: '', away_score: '' });
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('matches');
  const [users, setUsers] = useState([]);
  const [showSync, setShowSync] = useState(false);
  const [syncForm, setSyncForm] = useState({ league: 1, season: 2026 });
  const [syncing, setSyncing] = useState(false);

  async function loadMatches() {
    const res = await api.get('/admin/matches');
    setMatches(res.data);
  }

  async function loadUsers() {
    const res = await api.get('/admin/users');
    setUsers(res.data);
  }

  useEffect(() => {
    Promise.all([loadMatches()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'users') loadUsers();
  }, [tab]);

  const notify = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post('/admin/matches', form);
      setForm(emptyMatch);
      setShowCreate(false);
      loadMatches();
      notify('Partido creado');
    } catch (err) {
      notify('Error: ' + (err.response?.data?.error || 'Error al crear'));
    }
  }

  async function handleEdit(e) {
    e.preventDefault();
    try {
      await api.put(`/admin/matches/${editMatch.id}`, editMatch);
      setEditMatch(null);
      loadMatches();
      notify('Partido actualizado');
    } catch (err) {
      notify('Error: ' + (err.response?.data?.error || 'Error al actualizar'));
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este partido?')) return;
    await api.delete(`/admin/matches/${id}`);
    loadMatches();
    notify('Partido eliminado');
  }

  async function handleSetResult(e) {
    e.preventDefault();
    try {
      await api.put(`/admin/matches/${scoreModal.id}`, {
        home_score: Number(scoreForm.home_score),
        away_score: Number(scoreForm.away_score),
        status: 'finished',
      });
      notify('Resultado guardado. Ahora podés calcular los puntos.');
      loadMatches();
      setScoreModal(null);
    } catch (err) {
      notify('Error: ' + (err.response?.data?.error || 'Error al guardar'));
    }
  }

  async function handleSyncMatches() {
    setSyncing(true);
    try {
      const res = await api.post('/admin/sync-matches', syncForm);
      notify(res.data.message);
      loadMatches();
    } catch (err) {
      notify('Error: ' + (err.response?.data?.error || 'Error al sincronizar'));
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncLive() {
    setSyncing(true);
    try {
      const res = await api.post('/admin/sync-live', { league: syncForm.league });
      notify(res.data.message);
      loadMatches();
    } catch (err) {
      notify('Error: ' + (err.response?.data?.error || 'Error al actualizar'));
    } finally {
      setSyncing(false);
    }
  }

  async function handleScore(matchId) {
    try {
      const res = await api.post(`/admin/matches/${matchId}/score`);
      notify(res.data.message);
      loadMatches();
    } catch (err) {
      notify('Error: ' + (err.response?.data?.error || 'Error al calcular puntos'));
    }
  }

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="page">
      <h1 className="page-title">🛠 Panel de Administración</h1>

      {message && <div className={`alert ${message.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>{message}</div>}

      <div className="tabs">
        <button className={`tab${tab === 'matches' ? ' active' : ''}`} onClick={() => setTab('matches')}>⚽ Partidos</button>
        <button className={`tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>👥 Usuarios</button>
      </div>

      {tab === 'matches' && (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? 'Cancelar' : '+ Nuevo partido'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowSync(s => !s)}>
              🔄 Sincronizar API-Sports
            </button>
          </div>

          {showSync && (
            <div className="card" style={{ marginBottom: 20, background: '#f0f7ff', border: '1px solid #c3dafe' }}>
              <h3 style={{ fontWeight: 700, marginBottom: 12 }}>🌐 Sincronizar con API-Sports</h3>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label>Liga (ID)</label>
                  <input
                    type="number"
                    value={syncForm.league}
                    onChange={e => setSyncForm(f => ({ ...f, league: Number(e.target.value) }))}
                    style={{ width: 120 }}
                  />
                </div>
                <div className="form-group">
                  <label>Temporada</label>
                  <input
                    type="number"
                    value={syncForm.season}
                    onChange={e => setSyncForm(f => ({ ...f, season: Number(e.target.value) }))}
                    style={{ width: 120 }}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#555', marginBottom: 12 }}>
                Liga 1 = FIFA World Cup · Liga 2 = Champions League · etc. Temporada = año (ej: 2026)
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={handleSyncMatches} disabled={syncing}>
                  {syncing ? '⏳ Sincronizando...' : '🔄 Importar todos los partidos'}
                </button>
                <button className="btn btn-gold" onClick={handleSyncLive} disabled={syncing}>
                  {syncing ? '⏳ Actualizando...' : '⚡ Actualizar en vivo ahora'}
                </button>
              </div>
            </div>
          )}

          {showCreate && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Crear partido</h3>
              <form onSubmit={handleCreate}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Equipo local *</label>
                    <input value={form.home_team} onChange={e => setForm(f => ({ ...f, home_team: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label>Equipo visitante *</label>
                    <input value={form.away_team} onChange={e => setForm(f => ({ ...f, away_team: e.target.value }))} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Bandera local (emoji)</label>
                    <input value={form.home_flag} onChange={e => setForm(f => ({ ...f, home_flag: e.target.value }))} placeholder="🇦🇷" maxLength={10} />
                  </div>
                  <div className="form-group">
                    <label>Bandera visitante (emoji)</label>
                    <input value={form.away_flag} onChange={e => setForm(f => ({ ...f, away_flag: e.target.value }))} placeholder="🇧🇷" maxLength={10} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Fase</label>
                    <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                      {['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F','Grupo G','Grupo H',
                        'Octavos de final','Cuartos de final','Semifinal','Tercer puesto','Final'].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha y hora *</label>
                    <input type="datetime-local" value={form.match_date} onChange={e => setForm(f => ({ ...f, match_date: e.target.value }))} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Crear partido</button>
              </form>
            </div>
          )}

          <div className="card" style={{ overflow: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Partido</th>
                  <th>Fase</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Resultado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(m => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td style={{ fontWeight: 600 }}>{m.home_flag} {m.home_team} vs {m.away_team} {m.away_flag}</td>
                    <td>{m.stage}</td>
                    <td>{formatDate(m.match_date)}</td>
                    <td><span className={`status-badge status-${m.status}`}>{m.status}</span></td>
                    <td style={{ fontWeight: 700 }}>
                      {m.home_score !== null ? `${m.home_score} - ${m.away_score}` : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditMatch({ ...m, match_date: m.match_date?.slice(0,16) })}>
                          Editar
                        </button>
                        <button className="btn btn-gold btn-sm" onClick={() => { setScoreModal(m); setScoreForm({ home_score: m.home_score ?? '', away_score: m.away_score ?? '' }); }}>
                          Resultado
                        </button>
                        {m.status === 'finished' && m.home_score !== null && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleScore(m.id)}>
                            Calcular pts
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'users' && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr><th>#</th><th>Usuario</th><th>Email</th><th>Rol</th><th>Puntos</th><th>Registrado</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td>{u.email}</td>
                  <td><span className={`status-badge ${u.role === 'admin' ? 'status-live' : 'status-upcoming'}`}>{u.role}</span></td>
                  <td style={{ fontWeight: 700 }}>⭐ {u.total_points}</td>
                  <td>{new Date(u.created_at).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Match Modal */}
      {editMatch && (
        <div className="modal-overlay" onClick={() => setEditMatch(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Editar partido</h2>
            <form onSubmit={handleEdit}>
              <div className="form-row">
                <div className="form-group"><label>Equipo local</label><input value={editMatch.home_team} onChange={e => setEditMatch(m => ({ ...m, home_team: e.target.value }))} /></div>
                <div className="form-group"><label>Equipo visitante</label><input value={editMatch.away_team} onChange={e => setEditMatch(m => ({ ...m, away_team: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Bandera local</label><input value={editMatch.home_flag} onChange={e => setEditMatch(m => ({ ...m, home_flag: e.target.value }))} /></div>
                <div className="form-group"><label>Bandera visitante</label><input value={editMatch.away_flag} onChange={e => setEditMatch(m => ({ ...m, away_flag: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fase</label>
                  <select value={editMatch.stage} onChange={e => setEditMatch(m => ({ ...m, stage: e.target.value }))}>
                    {['Grupo A','Grupo B','Grupo C','Grupo D','Grupo E','Grupo F','Grupo G','Grupo H',
                      'Octavos de final','Cuartos de final','Semifinal','Tercer puesto','Final'].map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><label>Fecha y hora</label><input type="datetime-local" value={editMatch.match_date} onChange={e => setEditMatch(m => ({ ...m, match_date: e.target.value }))} /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditMatch(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Score Modal */}
      {scoreModal && (
        <div className="modal-overlay" onClick={() => setScoreModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Cargar resultado</h2>
            <p style={{ marginBottom: 16, color: '#666' }}>
              {scoreModal.home_flag} {scoreModal.home_team} vs {scoreModal.away_team} {scoreModal.away_flag}
            </p>
            <form onSubmit={handleSetResult}>
              <div className="form-row">
                <div className="form-group">
                  <label>{scoreModal.home_team}</label>
                  <input type="number" min="0" max="30" value={scoreForm.home_score} onChange={e => setScoreForm(f => ({ ...f, home_score: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>{scoreModal.away_team}</label>
                  <input type="number" min="0" max="30" value={scoreForm.away_score} onChange={e => setScoreForm(f => ({ ...f, away_score: e.target.value }))} required />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setScoreModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar resultado</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
