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

function AppContent() {
  const { currentDoctor } = useAuth();

  if (!currentDoctor) {
    return <Login />;
  }

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
