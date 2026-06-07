import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div style={{ textAlign: 'center', fontSize: '3rem', marginBottom: 8 }}>⚽</div>
        <h1 className="auth-title">Mundial Predictor</h1>
        <p className="auth-subtitle">Iniciá sesión para hacer tus predicciones</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={handle} required autoFocus />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input name="password" type="password" value={form.password} onChange={handle} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="auth-footer">
          ¿No tenés cuenta? <Link to="/register">Registrate</Link>
        </div>
        <div className="auth-footer" style={{ marginTop: 8, color: '#aaa' }}>
          Admin: admin@worldcup.com / admin123
        </div>
      </div>
    </div>
  );
}
