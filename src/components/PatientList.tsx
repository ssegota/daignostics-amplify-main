import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';
import Header from './Header';

const client = generateClient<Schema>();

interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    doctor: string;
    dateOfBirth?: string;
    gender?: string;
    insuranceNumber?: string;
    height?: number;
    weight?: number;
}

type SortOption = 'name-asc' | 'name-desc' | 'age-asc' | 'age-desc' | 'newest' | 'oldest';

const PatientList: React.FC = () => {
    const { currentDoctor } = useAuth();
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Filter states
    const [genderFilter, setGenderFilter] = useState<string>('all');
    const [minAge, setMinAge] = useState<string>('');
    const [maxAge, setMaxAge] = useState<string>('');
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');

    const [newPatient, setNewPatient] = useState({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        gender: '',
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

    // Calculate age from date of birth
    const calculateAge = (dateOfBirth?: string): number | null => {
        if (!dateOfBirth) return null;
        const today = new Date();
        const birth = new Date(dateOfBirth);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    // Filtered and sorted patients
    const filteredPatients = useMemo(() => {
        let result = [...patients];

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(patient =>
                patient.firstName.toLowerCase().includes(query) ||
                patient.lastName.toLowerCase().includes(query) ||
                `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(query) ||
                patient.id.toLowerCase().includes(query)
            );
        }

        // Apply gender filter
        if (genderFilter !== 'all') {
            result = result.filter(patient => patient.gender === genderFilter);
        }

        // Apply age filter
        if (minAge) {
            result = result.filter(patient => {
                const age = calculateAge(patient.dateOfBirth);
                return age !== null && age >= parseInt(minAge);
            });
        }
        if (maxAge) {
            result = result.filter(patient => {
                const age = calculateAge(patient.dateOfBirth);
                return age !== null && age <= parseInt(maxAge);
            });
        }

        // Apply sorting
        result.sort((a, b) => {
            switch (sortBy) {
                case 'name-asc':
                    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
                case 'name-desc':
                    return `${b.lastName} ${b.firstName}`.localeCompare(`${a.lastName} ${a.firstName}`);
                case 'age-asc': {
                    const ageA = calculateAge(a.dateOfBirth) ?? 0;
                    const ageB = calculateAge(b.dateOfBirth) ?? 0;
                    return ageA - ageB;
                }
                case 'age-desc': {
                    const ageA = calculateAge(a.dateOfBirth) ?? 0;
                    const ageB = calculateAge(b.dateOfBirth) ?? 0;
                    return ageB - ageA;
                }
                case 'newest':
                    return (b.dateOfBirth || '').localeCompare(a.dateOfBirth || '');
                case 'oldest':
                    return (a.dateOfBirth || '').localeCompare(b.dateOfBirth || '');
                default:
                    return 0;
            }
        });

        return result;
    }, [patients, searchQuery, genderFilter, minAge, maxAge, sortBy]);

    const clearFilters = () => {
        setSearchQuery('');
        setGenderFilter('all');
        setMinAge('');
        setMaxAge('');
        setSortBy('name-asc');
    };

    const hasActiveFilters = searchQuery || genderFilter !== 'all' || minAge || maxAge;

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
                gender: newPatient.gender || undefined,
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
                    gender: '',
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

    // Sidebar styles
    const sidebarStyles: React.CSSProperties = {
        width: '250px',
        flexShrink: 0,
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        padding: '1.5rem',
        height: 'fit-content',
        position: 'sticky',
        top: '2rem',
    };

    const filterSectionStyles: React.CSSProperties = {
        marginBottom: '1.5rem',
    };

    const filterLabelStyles: React.CSSProperties = {
        fontWeight: 600,
        marginBottom: '0.5rem',
        display: 'block',
        color: 'var(--dark-gray)',
        fontSize: '0.9rem',
    };

    return (
        <>
            <Header />

            <div className="patient-list-container">
                <div className="container">
                    <div className="patient-list-header">
                        <h1>My Patients</h1>
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                            + Add Patient
                        </button>
                    </div>

                    {/* Main content with sidebar layout */}
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>

                        {/* Sidebar */}
                        <aside style={sidebarStyles}>
                            <h3 style={{ marginBottom: '1rem', color: 'var(--primary-red)' }}>
                                🔧 Filters & Sort
                            </h3>

                            {/* Sort */}
                            <div style={filterSectionStyles}>
                                <label style={filterLabelStyles}>Sort By</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                                >
                                    <option value="name-asc">Name (A-Z)</option>
                                    <option value="name-desc">Name (Z-A)</option>
                                    <option value="age-asc">Age (Youngest)</option>
                                    <option value="age-desc">Age (Oldest)</option>
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                </select>
                            </div>

                            {/* Gender Filter */}
                            <div style={filterSectionStyles}>
                                <label style={filterLabelStyles}>Gender</label>
                                <select
                                    value={genderFilter}
                                    onChange={(e) => setGenderFilter(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                                >
                                    <option value="all">All</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>

                            {/* Age Range */}
                            <div style={filterSectionStyles}>
                                <label style={filterLabelStyles}>Age Range</label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        value={minAge}
                                        onChange={(e) => setMinAge(e.target.value)}
                                        style={{ width: '70px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                                        min="0"
                                        max="120"
                                    />
                                    <span>-</span>
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={maxAge}
                                        onChange={(e) => setMaxAge(e.target.value)}
                                        style={{ width: '70px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ddd' }}
                                        min="0"
                                        max="120"
                                    />
                                </div>
                            </div>

                            {/* Clear Filters */}
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="btn btn-secondary"
                                    style={{ width: '100%', marginTop: '0.5rem' }}
                                >
                                    ✕ Clear All Filters
                                </button>
                            )}

                            {/* Results count */}
                            <div style={{ marginTop: '1.5rem', padding: '0.75rem', backgroundColor: '#e9ecef', borderRadius: '8px', textAlign: 'center' }}>
                                <strong>{filteredPatients.length}</strong> of <strong>{patients.length}</strong> patients
                            </div>
                        </aside>

                        {/* Main content */}
                        <div style={{ flex: 1 }}>
                            {/* Search Input */}
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <input
                                    type="text"
                                    placeholder="🔍 Search patients by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        fontSize: '1rem',
                                        border: '2px solid var(--light-gray)',
                                        borderRadius: '8px',
                                        transition: 'border-color 0.2s',
                                    }}
                                />
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
                            ) : filteredPatients.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">🔍</div>
                                    <h3>No matching patients</h3>
                                    <p>No patients match your current filters.</p>
                                    <button
                                        onClick={clearFilters}
                                        className="btn btn-secondary mt-md"
                                    >
                                        Clear All Filters
                                    </button>
                                </div>
                            ) : (
                                <div className="patient-grid">
                                    {filteredPatients.map((patient) => (
                                        <div
                                            key={patient.id}
                                            className="patient-card"
                                            onClick={() => navigate(`/patient/${patient.id}`)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="patient-name">
                                                {patient.firstName} {patient.lastName}
                                            </div>
                                            <div className="patient-info" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                                {patient.gender && <span>{patient.gender === 'Male' ? '♂️' : '♀️'} {patient.gender}</span>}
                                                {patient.dateOfBirth && <span>🎂 {calculateAge(patient.dateOfBirth)} yrs</span>}
                                            </div>
                                            <div className="patient-info" style={{ marginTop: '0.25rem', color: '#888' }}>
                                                ID: {patient.id.slice(0, 8)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
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
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                                        <label>Gender</label>
                                        <select
                                            value={newPatient.gender}
                                            onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                                            style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '2px solid var(--light-gray)' }}
                                        >
                                            <option value="">Select...</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                        </select>
                                    </div>
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
