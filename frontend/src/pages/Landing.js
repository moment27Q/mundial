import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import heroBg from '../imagen/mundial.png';
import './Landing.css';

const STEPS = [
  {
    num: '01',
    title: 'Predecí el marcador',
    desc: 'Antes de que arranque cada partido, ingresás el resultado que creés que va a salir. Cuanto más preciso, más puntos.',
  },
  {
    num: '02',
    title: 'Armá tu sala',
    desc: 'Creá una sala privada, compartí el código con tus amigos y competí en un ranking propio.',
  },
  {
    num: '03',
    title: 'Seguí el ranking',
    desc: 'La tabla se actualiza automáticamente con cada resultado. Podés ver el ranking global o solo el de tu sala.',
  },
  {
    num: '04',
    title: 'Análisis por partido',
    desc: 'Cada partido tiene un análisis generado con IA que resume el contexto, las estadísticas y los datos clave.',
  },
];

const SCORES = [
  { pts: '+5', label: 'Marcador exacto', color: '#ffd700' },
  { pts: '+3', label: 'Ganador correcto', color: '#4ade80' },
  { pts: '+2', label: 'Diferencia de goles', color: '#60a5fa' },
  { pts: '+2', label: 'Racha de 3 seguidos', color: '#f472b6' },
  { pts: '+1', label: 'Predicción anticipada', color: '#a78bfa' },
];

export default function Landing() {
  const [recentMatches, setRecentMatches] = useState([]);

  useEffect(() => {
    fetch('/api/matches/recent-public')
      .then(r => r.ok ? r.json() : [])
      .then(data => setRecentMatches(data || []))
      .catch(() => {});
  }, []);

  return (
    <div className="landing">

      {/* NAV */}
      <nav className="landing-nav">
        <div className="landing-nav-brand">
          <span>⚽</span>
          <span>Mundial Predictor</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-btn-outline">Ingresar</Link>
          <Link to="/register" className="landing-btn-solid">Registrarse</Link>
        </div>
      </nav>

      {/* HERO */}
      <section
        className="landing-hero"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="landing-hero-overlay" />
        <div className="landing-hero-content">
          <div className="landing-host-bar">
            <span>🇨🇦 CANADA</span>
            <span className="dot">·</span>
            <span>🇲🇽 MEXICO</span>
            <span className="dot">·</span>
            <span>🇺🇸 USA</span>
          </div>

          <h1 className="landing-title">
            <span className="landing-title-top">FIFA WORLD CUP</span>
            <span className="landing-title-year">2026™</span>
          </h1>

          <p className="landing-subtitle">
            Predecí partidos, competí con amigos<br />y seguí el Mundial en tiempo real.
          </p>

          <div className="landing-cta">
            <Link to="/register" className="landing-cta-primary">
              Empezar a predecir →
            </Link>
            <Link to="/login" className="landing-cta-secondary">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="landing-features">
        <div className="landing-features-inner">
          <div className="landing-features-header">
            <p className="landing-features-label">Cómo funciona</p>
            <h2 className="landing-features-title">Todo lo que necesitás<br />para el Mundial</h2>
          </div>
          <div className="landing-steps">
            {STEPS.map(s => (
              <div key={s.num} className="landing-step">
                <span className="landing-step-num">{s.num}</span>
                <div>
                  <h3 className="landing-step-title">{s.title}</h3>
                  <p className="landing-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCORING */}
      <section className="landing-scoring">
        <div className="landing-scoring-inner">
          <h2 className="landing-section-title" style={{ color: '#fff' }}>Sistema de puntuación</h2>
          <div className="landing-scores-row">
            {SCORES.map(s => (
              <div key={s.label} className="landing-score-item">
                <span className="landing-score-pts" style={{ color: s.color }}>{s.pts}</span>
                <span className="landing-score-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="landing-bottom">
        <div className="landing-bottom-inner">
          <div className="landing-bottom-text">
            <h2>¿Quién va a salir campeón?</h2>
            <p>Registrate, predecí cada partido y demostrá que sabés más de fútbol que tus amigos.</p>
            <Link to="/register" className="landing-cta-primary">
              Crear cuenta — es gratis
            </Link>
            <div className="landing-bottom-note">
              Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
            </div>
          </div>
          <div className="landing-bottom-preview">
            {recentMatches.length > 0 ? recentMatches.map(m => {
              const home = m.home_score ?? 0;
              const away = m.away_score ?? 0;
              const winner = home > away ? m.home_team : away > home ? m.away_team : null;
              return (
                <div key={m.id} className="preview-card">
                  <div className="preview-stage">{m.stage || 'Grupo'}</div>
                  <div className="preview-match">
                    <span>{m.home_flag} {m.home_team}</span>
                    <span className="preview-score">{home} — {away}</span>
                    <span>{m.away_team} {m.away_flag}</span>
                  </div>
                  <div className="preview-footer">
                    <span className="preview-chip preview-chip-done">✓ Finalizado</span>
                    {winner && (
                      <span className="preview-chip preview-chip-winner">🏆 {winner}</span>
                    )}
                  </div>
                </div>
              );
            }) : (
              <>
                <div className="preview-card">
                  <div className="preview-stage">Cuartos de Final</div>
                  <div className="preview-match">
                    <span>🇦🇷 Argentina</span>
                    <span className="preview-score">2 — 1</span>
                    <span>Francia 🇫🇷</span>
                  </div>
                  <div className="preview-footer">
                    <span className="preview-chip preview-chip-done">✓ Finalizado</span>
                    <span className="preview-chip preview-chip-winner">🏆 Argentina</span>
                  </div>
                </div>
                <div className="preview-card">
                  <div className="preview-stage">Semifinal</div>
                  <div className="preview-match">
                    <span>🇧🇷 Brasil</span>
                    <span className="preview-score">1 — 0</span>
                    <span>España 🇪🇸</span>
                  </div>
                  <div className="preview-footer">
                    <span className="preview-chip preview-chip-done">✓ Finalizado</span>
                    <span className="preview-chip preview-chip-winner">🏆 Brasil</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <span>⚽ Mundial Predictor 2026</span>
        <span>·</span>
        <Link to="/login">Iniciar sesión</Link>
        <span>·</span>
        <Link to="/register">Registrarse</Link>
      </footer>
    </div>
  );
}
