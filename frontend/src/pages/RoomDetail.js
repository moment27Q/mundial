import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Leaderboard from '../components/Leaderboard';

export default function RoomDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/rooms/${id}`)
      .then(res => setRoom(res.data))
      .catch(() => navigate('/rooms'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleLeave() {
    if (!window.confirm('¿Salir de esta sala?')) return;
    await api.delete(`/rooms/${id}/leave`);
    navigate('/rooms');
  }

  function copyCode() {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="loading">Cargando sala...</div>;
  if (!room) return null;

  const leaderboardEntries = room.members.map(m => ({
    id: m.id,
    username: m.username,
    points: m.points,
    rank: m.rank,
  }));

  return (
    <div className="page">
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate('/rooms')}>
        ← Volver a salas
      </button>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex-between">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{room.name}</h1>
            {room.description && <p className="text-muted" style={{ marginTop: 4 }}>{room.description}</p>}
            <p className="text-muted" style={{ marginTop: 4, fontSize: '0.8rem' }}>Creada por {room.owner_name} · {room.members?.length} miembros</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Código de invitación</div>
            <div
              className="room-code"
              onClick={copyCode}
              title="Click para copiar"
              style={{ cursor: 'pointer' }}
            >
              {room.code}
            </div>
            {copied && <div style={{ fontSize: '0.75rem', color: '#1a6b00', marginTop: 4 }}>¡Copiado!</div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>🏆 Tabla de posiciones</h2>
          <div className="card">
            <Leaderboard entries={leaderboardEntries} />
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>👥 Miembros</h2>
          <div className="card">
            {room.members.map(m => (
              <div key={m.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid #f0f4f0'
              }}>
                <div>
                  <span style={{ fontWeight: m.id === user?.id ? 700 : 500 }}>
                    {m.username}{m.id === user?.id ? ' (tú)' : ''}
                  </span>
                  {room.owner_id === m.id && (
                    <span style={{ marginLeft: 6, fontSize: '0.72rem', background: '#ffd700', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>ADMIN</span>
                  )}
                </div>
                <span style={{ fontWeight: 700, color: '#1a6b00' }}>⭐ {m.points}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="alert alert-info" style={{ fontSize: '0.85rem' }}>
              Compartí el código <strong>{room.code}</strong> para invitar amigos.
            </div>
          </div>

          {user?.id !== room.owner_id && (
            <button className="btn btn-danger btn-sm" style={{ marginTop: 12, width: '100%' }} onClick={handleLeave}>
              Salir de la sala
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
