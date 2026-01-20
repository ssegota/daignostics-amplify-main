import React, { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';

const client = generateClient<Schema>();

interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    doctor: string;
}

const PatientList: React.FC = () => {
    const { currentDoctor, logout } = useAuth();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPatients();
    }, [currentDoctor]);

    const fetchPatients = async () => {
        if (!currentDoctor) return;

        setLoading(true);
        setError('');

        try {
            const { data } = await client.models.Patient.list({
                filter: { doctor: { eq: currentDoctor.username } },
            });

            setPatients(data as Patient[]);
        } catch (err) {
            console.error('Error fetching patients:', err);
            setError('Failed to load patients');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <header className="header">
                <div className="container">
                    <div className="header-content">
                        <a href="/" className="logo">dAIgnostics</a>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ color: 'var(--dark-gray)' }}>
                                Welcome, Dr. {currentDoctor?.username}
                            </span>
                            <button onClick={logout} className="btn btn-secondary">
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="patient-list-container">
                <div className="container">
                    <div className="patient-list-header">
                        <h1>My Patients</h1>
                    </div>

                    {loading ? (
                        <div className="loading-container">
                            <span className="spinner" style={{ width: '40px', height: '40px' }}></span>
                        </div>
                    ) : error ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">⚠️</div>
                            <p>{error}</p>
                            <button onClick={fetchPatients} className="btn btn-primary mt-md">
                                Retry
                            </button>
                        </div>
                    ) : patients.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">👥</div>
                            <h3>No patients yet</h3>
                            <p>You don't have any patients assigned to you.</p>
                        </div>
                    ) : (
                        <div className="patient-grid">
                            {patients.map((patient) => (
                                <div key={patient.id} className="patient-card">
                                    <div className="patient-name">
                                        {patient.firstName} {patient.lastName}
                                    </div>
                                    <div className="patient-info">Patient ID: {patient.id.slice(0, 8)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default PatientList;
