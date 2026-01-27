import React, { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

const client = generateClient<Schema>();

const PatientDashboard: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [experiments, setExperiments] = useState<Schema['Experiment']['type'][]>([]);
    const [patientName, setPatientName] = useState('');

    useEffect(() => {
        if (currentUser?.role !== 'patient') return;

        // Fetch Patient details (to show name)
        client.models.Patient.list({ filter: { cognitoId: { eq: currentUser.username } } })
            .then(res => {
                if (res.data.length > 0) {
                    setPatientName(`${res.data[0].firstName} ${res.data[0].lastName}`);
                }
            });

        // Fetch Experiments
        // With 'allow.ownerDefinedIn', the list should automatically be filtered to experiments owned by the patient
        client.models.Experiment.list()
            .then(res => setExperiments(res.data));

    }, [currentUser]);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="header-content">
                    <div className="header-left">
                        <img src="/logo.svg" alt="dAIgnostics" className="header-logo" />
                        <span className="header-title">Patient Portal</span>
                    </div>
                    <div className="header-right">
                        <span className="doctor-welcome">
                            Welcome, {patientName || 'Patient'}
                        </span>
                        <button onClick={handleLogout} className="btn btn-secondary">
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="main-content">
                <div className="content-header">
                    <h1>My Test Results</h1>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Peak Counts</th>
                                <th>Amplitude</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {experiments.map((exp) => (
                                <tr key={exp.id}>
                                    <td>{new Date(exp.generationDate).toLocaleDateString()}</td>
                                    <td>{exp.peakCounts.toFixed(1)}</td>
                                    <td>{exp.amplitude.toFixed(2)}</td>
                                    <td>
                                        <span className={`status-badge ${exp.snr > 10 ? 'status-completed' : 'status-pending'}`}>
                                            {exp.snr > 10 ? 'Complete' : 'Processing'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => navigate(`/experiment/${exp.id}`)}
                                        >
                                            View Report
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {experiments.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                                        No test results found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
};

export default PatientDashboard;
