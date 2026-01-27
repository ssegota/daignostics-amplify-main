import { Amplify } from 'aws-amplify';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import outputs from '../amplify_outputs.json';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';
import PatientList from './components/PatientList';
import PatientDetails from './components/PatientDetails';
import ExperimentDetails from './components/ExperimentDetails';
import './index.css';

Amplify.configure(outputs);

import PatientDashboard from './components/PatientDashboard';

function AppContent() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <span className="spinner" style={{ width: '50px', height: '50px' }}></span>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  if (currentUser.role === 'patient') {
    return (
      <Routes>
        <Route path="/" element={<PatientDashboard />} />
        <Route path="/experiment/:id" element={<ExperimentDetails />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Doctor Routes
  return (
    <Routes>
      <Route path="/" element={<PatientList />} />
      <Route path="/patient/:id" element={<PatientDetails />} />
      <Route path="/experiment/:id" element={<ExperimentDetails />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
