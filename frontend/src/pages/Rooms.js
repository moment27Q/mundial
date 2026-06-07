import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newRoom, setNewRoom] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  async function loadRooms() {
    const res = await api.get('/rooms/my');
    setRooms(res.data);
  }

  useEffect(() => { loadRooms().finally(() => setLoading(false)); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/rooms', newRoom);
      setNewRoom({ name: '', description: '' });
      setShowCreate(false);
      setSuccess('¡Sala creada!');
      loadRooms();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear sala');
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/rooms/join', { code: joinCode });
      setJoinCode('');
      setSuccess('¡Te uniste a la sala!');
      loadRooms();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Código inválido');
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
  }

  if (loading) return <div className="loading">Cargando salas...</div>;

  return (
    <div className="page">
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>🏠 Mis Salas</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancelar' : '+ Crear sala'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Nueva sala</h3>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Nombre de la sala *</label>
              <input value={newRoom.name} onChange={e => setNewRoom(r => ({ ...r, name: e.target.value }))} required maxLength={100} />
            </div>
            <div className="form-group">
              <label>Descripción (opcional)</label>
              <input value={newRoom.description} onChange={e => setNewRoom(r => ({ ...r, description: e.target.value }))} maxLength={200} />
            </div>
            <button type="submit" className="btn btn-primary">Crear sala</button>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 12, fontWeight: 700 }}>Unirse con código</h3>
        <form onSubmit={handleJoin} className="form-inline">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Código de 6 letras (ej: ABC123)"
            maxLength={10}
            style={{ fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase' }}
          />
          <button type="submit" className="btn btn-gold">Unirse</button>
        </form>
      </div>

      {rooms.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏠</div>
          <p>Todavía no estás en ninguna sala.</p>
          <p className="text-muted">Creá una nueva o unite con un código.</p>
        </div>
      ) : (
        <div className="card-grid">
          {rooms.map(room => (
            <div key={room.id} className="card room-card" onClick={() => navigate(`/rooms/${room.id}`)}>
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <h3 style={{ fontWeight: 700, fontSize: '1.05rem' }}>{room.name}</h3>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>{room.member_count} miembros</span>
              </div>
              {room.description && <p className="text-muted" style={{ marginBottom: 12, fontSize: '0.875rem' }}>{room.description}</p>}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Código de invitación</div>
                <div
                  className="room-code"
                  onClick={e => { e.stopPropagation(); copyCode(room.code); }}
                  title="Click para copiar"
                >
                  {room.code}
                </div>
              </div>
              <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                <span className="text-muted">Creado por {room.owner_name}</span>
                <span style={{ fontWeight: 700, color: '#1a6b00' }}>⭐ {room.my_points} pts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
