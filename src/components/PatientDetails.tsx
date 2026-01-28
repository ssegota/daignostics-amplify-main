import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';
import CSVUpload from './CSVUpload';
import Header from './Header';

const client = generateClient<Schema>();

interface Experiment {
    id: string;
    patientId: string;
    generationDate: string;
    spectralFeatures: string;
    consensusPrediction: number | null;
    consensusConfidence: number | null;
    modelsUsed: number | null;
}

interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    doctor: string;
    dateOfBirth?: string;
    insuranceNumber?: string;
    cognitoId?: string;
}

interface Doctor {
    username: string;
    email: string;
}

const PatientDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [transferDoctorId, setTransferDoctorId] = useState('');
    const [editForm, setEditForm] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        insuranceNumber: '',
    });

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

    const handleEditClick = () => {
        if (!patient) return;
        setEditForm({
            firstName: patient.firstName,
            lastName: patient.lastName,
            dateOfBirth: patient.dateOfBirth || '',
            insuranceNumber: patient.insuranceNumber || '',
        });
        setShowEditModal(true);
    };

    const handleEditPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patient) return;

        setSubmitting(true);
        try {
            const { data } = await client.models.Patient.update({
                id: patient.id,
                firstName: editForm.firstName,
                lastName: editForm.lastName,
                dateOfBirth: editForm.dateOfBirth,
                insuranceNumber: editForm.insuranceNumber,
            });

            if (data) {
                setPatient(data as Patient);
                setShowEditModal(false);
            }
        } catch (err) {
            console.error('Error updating patient:', err);
            alert('Failed to update patient');
        } finally {
            setSubmitting(false);
        }
    };

    const handleTransferClick = async () => {
        if (doctors.length === 0) {
            try {
                const { data } = await client.models.Doctor.list();
                setDoctors(data as Doctor[]);
            } catch (err) {
                console.error('Error fetching doctors:', err);
                alert('Failed to load doctors list');
                return;
            }
        }
        setShowTransferModal(true);
    };

    const handleTransferPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patient || !transferDoctorId) return;

        if (!window.confirm('Are you sure you want to transfer this patient? You will lose access to this patient record.')) {
            return;
        }

        setSubmitting(true);
        try {
            await client.models.Patient.update({
                id: patient.id,
                doctor: transferDoctorId,
            });

            alert('Patient transferred successfully');
            navigate('/');
        } catch (err) {
            console.error('Error transferring patient:', err);
            alert('Failed to transfer patient');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <>
                <Header />
                <div className="loading-container">
                    <span className="spinner" style={{ width: '40px', height: '40px' }}></span>
                </div>
            </>
        );
    }

    if (error || !patient) {
        return (
            <>
                <Header />
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
            <Header />

            <div className="patient-list-container">
                <div className="container">
                    <button onClick={() => navigate('/')} className="btn btn-secondary mb-lg">
                        ← Back to Patients
                    </button>

                    <div className="patient-details-header">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h1>{patient.firstName} {patient.lastName}</h1>
                                <p style={{ color: 'var(--dark-gray)', marginTop: 'var(--spacing-xs)' }}>
                                    Patient ID: {patient.id.slice(0, 8)}
                                </p>
                                {patient.dateOfBirth && (
                                    <p style={{ color: 'var(--dark-gray)', marginTop: 'var(--spacing-xs)' }}>
                                        DOB: {new Date(patient.dateOfBirth).toLocaleDateString()} |
                                        Insurance: {patient.insuranceNumber || 'N/A'}
                                    </p>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button onClick={handleEditClick} className="btn btn-secondary">
                                    Edit Patient
                                </button>
                                <button onClick={handleTransferClick} className="btn btn-secondary" style={{ borderColor: 'var(--charcoal)', color: 'var(--charcoal)' }}>
                                    Transfer
                                </button>
                            </div>
                        </div>
                    </div>

                    <h2 className="mt-lg mb-md">Experiments</h2>

                    <div className="mb-lg">
                        <CSVUpload patientId={id!} patientCognitoId={patient?.cognitoId} onUploadComplete={fetchPatientAndExperiments} />
                    </div>

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
                                        <div className="patient-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '50%',
                                                background: experiment.consensusPrediction === 1 ? '#e74c3c' : '#27ae60'
                                            }}></span>
                                            Experiment {experiment.id.slice(0, 8)}
                                        </div>
                                        <div className="patient-info">
                                            {new Date(experiment.generationDate).toLocaleDateString()}
                                        </div>
                                        <div className="patient-info" style={{
                                            color: experiment.consensusPrediction === 1 ? '#e74c3c' : '#27ae60',
                                            fontWeight: 'bold'
                                        }}>
                                            {experiment.consensusPrediction === 1 ? 'Positive' : 'Negative'}
                                            {experiment.consensusConfidence !== null &&
                                                ` (${(experiment.consensusConfidence * 100).toFixed(0)}%)`}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Edit Patient</h2>
                            <button onClick={() => setShowEditModal(false)} className="modal-close">×</button>
                        </div>
                        <form onSubmit={handleEditPatient}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>First Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.firstName}
                                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Last Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.lastName}
                                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth</label>
                                    <input
                                        type="date"
                                        value={editForm.dateOfBirth}
                                        onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Insurance Number</label>
                                    <input
                                        type="text"
                                        value={editForm.insuranceNumber}
                                        onChange={(e) => setEditForm({ ...editForm, insuranceNumber: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showTransferModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Transfer Patient</h2>
                            <button onClick={() => setShowTransferModal(false)} className="modal-close">×</button>
                        </div>
                        <form onSubmit={handleTransferPatient}>
                            <div className="modal-body">
                                <p className="mb-md">
                                    Select a doctor to transfer <strong>{patient?.firstName} {patient?.lastName}</strong> to.
                                    <br />
                                    <span style={{ color: 'var(--primary-red)', fontSize: '0.9em' }}>
                                        Warning: You will lose access to this patient after transfer.
                                    </span>
                                </p>
                                <div className="form-group">
                                    <label>Select Doctor</label>
                                    <select
                                        required
                                        value={transferDoctorId}
                                        onChange={(e) => setTransferDoctorId(e.target.value)}
                                    >
                                        <option value="">-- Select Doctor --</option>
                                        {doctors
                                            .filter(d => d.username !== currentUser?.username)
                                            .map(doctor => (
                                                <option key={doctor.username} value={doctor.username}>
                                                    Dr. {doctor.username} ({doctor.email})
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowTransferModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting || !transferDoctorId}>
                                    {submitting ? 'Transferring...' : 'Transfer Patient'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default PatientDetails;
