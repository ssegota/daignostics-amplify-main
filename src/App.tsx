import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';
import PatientList from './components/PatientList';
import './index.css';

Amplify.configure(outputs);

function AppContent() {
  const { currentDoctor } = useAuth();

  return (
    <>
      {currentDoctor ? <PatientList /> : <Login />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
