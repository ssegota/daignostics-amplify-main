import React, { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

const client = generateClient<Schema>();

import Header from './Header';

const PatientDashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [experiments, setExperiments] = useState<Schema['Experiment']['type'][]>([]);

    // Header now handles displaying user name automatically based on currentUser role

    useEffect(() => {
        if (currentUser?.role !== 'patient') return;

        // Fetch Experiments
        // With 'allow.ownerDefinedIn', listing experiments will automatically return only those owned by the patient
        client.models.Experiment.list()
            .then(res => setExperiments(res.data))
            .catch(err => console.error("Error fetching experiments:", err));

    }, [currentUser]);

    return (
        <div className="app-container" style={{ backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
            <Header />

            <main className="container" style={{ padding: '2rem 1rem' }}>
                <div className="content-header" style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', color: 'var(--charcoal)' }}>My Health Dashboard</h1>
                    <p style={{ color: 'var(--dark-gray)', marginTop: '0.5rem' }}>
                        View your test results and generate reports.
                    </p>
                </div>

                {/* Dashboard Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', backgroundColor: 'white' }}>
                        <h3 style={{ color: 'var(--dark-gray)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Tests</h3>
                        <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: '0.5rem 0' }}>{experiments.length}</p>
                    </div>
                    <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', backgroundColor: 'white' }}>
                        <h3 style={{ color: 'var(--dark-gray)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Latest Result</h3>
                        <p style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--charcoal)', margin: '0.5rem 0' }}>
                            {experiments.length > 0
                                ? new Date(Math.max(...experiments.map(e => new Date(e.generationDate).getTime()))).toLocaleDateString()
                                : 'N/A'}
                        </p>
                    </div>
                </div>

                <div className="card" style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Recent Experiments</h2>
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
                                {experiments.length > 0 ? (
                                    experiments
                                        .sort((a, b) => new Date(b.generationDate).getTime() - new Date(a.generationDate).getTime())
                                        .map((exp) => (
                                            <tr key={exp.id}>
                                                <td style={{ fontWeight: '500' }}>{new Date(exp.generationDate).toLocaleDateString()}</td>
                                                <td>{exp.peakCounts.toFixed(1)}</td>
                                                <td>{exp.amplitude.toFixed(2)}</td>
                                                <td>
                                                    <span className={`status-badge ${exp.snr > 10 ? 'status-completed' : 'status-pending'}`}>
                                                        {exp.snr > 10 ? 'Complete' : 'Processing'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => navigate(`/experiment/${exp.id}`)}
                                                    >
                                                        View Report
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                                            <div style={{ color: '#ccc', fontSize: '3rem', marginBottom: '1rem' }}>🧪</div>
                                            <p style={{ fontSize: '1.1rem', color: 'var(--dark-gray)' }}>No test results available yet.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PatientDashboard;
