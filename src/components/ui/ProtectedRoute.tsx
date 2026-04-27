import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { SplashScreen } from './SplashScreen'; // Naya premium loader

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, profile } = useAuth();
  const location = useLocation(); // Current page check karne ke liye

  // 1. Agar check chal raha hai, toh mast Heartbeat dikhao
  if (loading) {
    return <SplashScreen />;
  }

  // 2. Agar login nahi hai, toh seedha Auth page par fek do
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // 3. Agar login hai par partner se connect nahi hai, toh Connect page par bhejo
  if (profile && !profile.is_paired) {
    // Check karo ki kahin hum already Connect page par toh nahi hain? (Infinite loop prevention)
    if (location.pathname !== '/connect') {
      return <Navigate to="/connect" replace />;
    }
  }

  // 4. Sab theek hai toh page dikhao
  return <>{children}</>;
};