import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ entries = [], limit }) {
  const { user } = useAuth();
  const rows = limit ? entries.slice(0, limit) : entries;

  if (!rows.length) return <div className="empty"><div className="empty-icon">🏆</div><p>Sin participantes aún</p></div>;

  return (
    <div className="leaderboard">
      {rows.map((entry) => {
        const rank = Number(entry.rank);
        const isMe = entry.id === user?.id;
        const cls = `lb-row${isMe ? ' me' : ''}${rank === 1 ? ' top-1' : rank === 2 ? ' top-2' : rank === 3 ? ' top-3' : ''}`;
        return (
          <div key={entry.id} className={cls}>
            <div className="lb-rank">{medals[rank] || `#${rank}`}</div>
            <div className="lb-username">{entry.username}{isMe && ' (tú)'}</div>
            <div className="lb-points">⭐ {entry.points ?? entry.total_points} pts</div>
          </div>
        );
      })}
    </div>
  );
}
