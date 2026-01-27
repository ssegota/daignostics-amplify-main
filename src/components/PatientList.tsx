import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';

const client = generateClient<Schema>();

interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    doctor: string;
    dateOfBirth?: string;
    insuranceNumber?: string;
    height?: number;
    weight?: number;
}

const PatientList: React.FC = () => {
    const { currentDoctor, logout } = useAuth();
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newPatient, setNewPatient] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        insuranceNumber: '',
        height: '',
        weight: '',
    });

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
                limit: 1000,
            });

            setPatients(data as Patient[]);
        } catch (err) {
            console.error('Error fetching patients:', err);
            setError('Failed to load patients');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentDoctor) return;

        setSubmitting(true);
        try {
            const { data } = await client.models.Patient.create({
                firstName: newPatient.firstName,
                lastName: newPatient.lastName,
                doctor: currentDoctor.username,
                dateOfBirth: newPatient.dateOfBirth,
                insuranceNumber: newPatient.insuranceNumber,
                height: parseFloat(newPatient.height),
                weight: parseFloat(newPatient.weight),
            });

            if (data) {
                setPatients([...patients, data as Patient]);
                setShowAddModal(false);
                setNewPatient({
                    firstName: '',
                    lastName: '',
                    dateOfBirth: '',
                    insuranceNumber: '',
                    height: '',
                    weight: '',
                });
            }
        } catch (err) {
            console.error('Error creating patient:', err);
            alert('Failed to create patient');
        } finally {
            setSubmitting(false);
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
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                            + Add Patient
                        </button>
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
                                <div
                                    key={patient.id}
                                    className="patient-card"
                                    onClick={() => navigate(`/patient/${patient.id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
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
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Add New Patient</h2>
                            <button onClick={() => setShowAddModal(false)} className="modal-close">×</button>
                        </div>
                        <form onSubmit={handleAddPatient}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>First Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newPatient.firstName}
                                        onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Last Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newPatient.lastName}
                                        onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth</label>
                                    <input
                                        type="date"
                                        required
                                        value={newPatient.dateOfBirth}
                                        onChange={(e) => setNewPatient({ ...newPatient, dateOfBirth: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Insurance Number</label>
                                    <input
                                        type="text"
                                        required
                                        value={newPatient.insuranceNumber}
                                        onChange={(e) => setNewPatient({ ...newPatient, insuranceNumber: e.target.value })}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label>Height (cm)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            required
                                            value={newPatient.height}
                                            onChange={(e) => setNewPatient({ ...newPatient, height: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Weight (kg)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            required
                                            value={newPatient.weight}
                                            onChange={(e) => setNewPatient({ ...newPatient, weight: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Adding...' : 'Add Patient'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default PatientList;
