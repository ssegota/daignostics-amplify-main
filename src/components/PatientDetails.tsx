import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';

const client = generateClient<Schema>();

interface Experiment {
    id: string;
    patientId: string;
    peakCounts: number;
    amplitude: number;
    auc: number;
    fwhm: number;
    frequency: number;
    snr: number;
    skewness: number;
    kurtosis: number;
    generationDate: string;
}

interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    doctor: string;
}

const PatientDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentDoctor, logout } = useAuth();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        fetchPatientAndExperiments();
    }, [id]);

    const fetchPatientAndExperiments = async () => {
        if (!id) return;

        setLoading(true);
        setError('');

        try {
            // Fetch patient details
            const { data: patientData } = await client.models.Patient.get({ id });
            if (!patientData) {
                setError('Patient not found');
                setLoading(false);
                return;
            }
            setPatient(patientData as Patient);

            // Fetch experiments for this patient
            const { data: experimentsData } = await client.models.Experiment.list({
                filter: { patientId: { eq: id } },
            });
            setExperiments(experimentsData as Experiment[]);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load patient data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
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
                <div className="loading-container">
                    <span className="spinner" style={{ width: '40px', height: '40px' }}></span>
                </div>
            </>
        );
    }

    if (error || !patient) {
        return (
            <>
                <header className="header">
                    <div className="container">
                        <div className="header-content">
                            <a href="/" className="logo">dAIgnostics</a>
                        </div>
                    </div>
                </header>
                <div className="empty-state">
                    <div className="empty-state-icon">⚠️</div>
                    <p>{error || 'Patient not found'}</p>
                    <button onClick={() => navigate('/')} className="btn btn-primary mt-md">
                        Back to Patient List
                    </button>
                </div>
            </>
        );
    }

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
                    <button onClick={() => navigate('/')} className="btn btn-secondary mb-lg">
                        ← Back to Patients
                    </button>

                    <div className="patient-details-header">
                        <h1>{patient.firstName} {patient.lastName}</h1>
                        <p style={{ color: 'var(--dark-gray)', marginTop: 'var(--spacing-xs)' }}>
                            Patient ID: {patient.id.slice(0, 8)}
                        </p>
                    </div>

                    <h2 className="mt-lg mb-md">Experiments</h2>

                    {experiments.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">🧪</div>
                            <h3>No experiments yet</h3>
                            <p>No experiments have been recorded for this patient.</p>
                        </div>
                    ) : (
                        <div className="patient-grid">
                            {experiments
                                .sort((a, b) => new Date(b.generationDate).getTime() - new Date(a.generationDate).getTime())
                                .map((experiment) => (
                                    <div
                                        key={experiment.id}
                                        className="patient-card"
                                        onClick={() => navigate(`/experiment/${experiment.id}`)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="patient-name">
                                            Experiment {experiment.id.slice(0, 8)}
                                        </div>
                                        <div className="patient-info">
                                            Date: {new Date(experiment.generationDate).toLocaleDateString()}
                                        </div>
                                        <div className="patient-info">
                                            SNR: {experiment.snr.toFixed(2)} | Amplitude: {experiment.amplitude.toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default PatientDetails;
