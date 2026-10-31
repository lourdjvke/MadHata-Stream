import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100svh',
          display: 'grid',
          placeItems: 'center',
          background: '#0b0e16',
          color: '#fff',
        }}
      >
        <div
          style={{
            width: '2.4rem',
            height: '2.4rem',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.15)',
            borderTopColor: '#5b4ee8',
            animation: 'sp 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/whos-watching" state={{ from: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
};
