import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Predictions from './pages/Predictions';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import Admin from './pages/Admin';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function HomeRoute() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

function Layout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/predictions" element={<PrivateRoute><Layout><Predictions /></Layout></PrivateRoute>} />
          <Route path="/rooms" element={<PrivateRoute><Layout><Rooms /></Layout></PrivateRoute>} />
          <Route path="/rooms/:id" element={<PrivateRoute><Layout><RoomDetail /></Layout></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute><Layout><Admin /></Layout></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
