import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import heroBg from '../imagen/mundial.png';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(form.username, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper" style={{ backgroundImage: `url(${heroBg})` }}>
      <div className="auth-card">
        <div style={{ textAlign: 'center', fontSize: '3rem', marginBottom: 8 }}>⚽</div>
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-subtitle">Únete y hacé tus predicciones del Mundial</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre de usuario</label>
            <input name="username" type="text" value={form.username} onChange={handle} required autoFocus minLength={3} maxLength={50} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={handle} required />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input name="password" type="password" value={form.password} onChange={handle} required minLength={6} />
            <small className="text-muted">Mínimo 6 caracteres</small>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="auth-footer">
          ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
        </div>
      </div>
    </div>
  );
}
