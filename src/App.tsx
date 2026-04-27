import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './app/providers/AuthProvider';
import { ProtectedRoute } from './components/ui/ProtectedRoute';
import { AuthPage } from './features/auth/AuthPage';
import { ConnectPage } from './features/connection/ConnectPage';
import { DashboardPage } from './features/dashboard/DashboardPage'; // 👈 Dashboard import
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <AuthProvider>
      <Toaster 
        position="top-center" 
        reverseOrder={false} 
        toastOptions={{
          style: {
            background: '#18181b', 
            color: '#fff',
            border: '1px solid #27272a',
          },
        }}
      />
      
      <Router>
        <Routes>
          {/* Main Dashboard (Ye ab sabse pehle khulega) */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />

          {/* Connect Page */}
          <Route 
            path="/connect" 
            element={
              <ProtectedRoute>
                <ConnectPage />
              </ProtectedRoute>
            } 
          />

          {/* Public Route */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Agar user koi ajeeb URL dale toh Dashboard par bhej do */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;