import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface Doctor {
    id?: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    primaryInstitution?: string;
    primaryInstitutionAddress?: string;
    secondaryInstitution?: string;
    secondaryInstitutionAddress?: string;
}

const Header: React.FC = () => {
    const { currentDoctor, logout } = useAuth();
    const [doctorDetails, setDoctorDetails] = useState<Doctor | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState<Doctor>({
        id: '',
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        primaryInstitution: '',
        primaryInstitutionAddress: '',
        secondaryInstitution: '',
        secondaryInstitutionAddress: ''
    });

    useEffect(() => {
        if (currentDoctor) {
            fetchDoctorDetails();
        }
    }, [currentDoctor]);

    const fetchDoctorDetails = async () => {
        if (!currentDoctor) return;
        try {
            console.log('Fetching doctor details for:', currentDoctor.username);
            // Use list with filter since username is not the primary key (id is auto-generated)
            const { data } = await client.models.Doctor.list({
                filter: { username: { eq: currentDoctor.username } }
            });
            console.log('Doctor data received:', data);
            if (data && data.length > 0) {
                setDoctorDetails(data[0] as any);
                setForm(data[0] as any);
            } else {
                console.warn('No doctor data found, using currentDoctor as fallback');
                // Use currentDoctor as fallback
                setDoctorDetails({
                    username: currentDoctor.username,
                    email: currentDoctor.email || '',
                } as Doctor);
                setForm({
                    username: currentDoctor.username,
                    email: currentDoctor.email || '',
                    firstName: '',
                    lastName: '',
                    primaryInstitution: '',
                    primaryInstitutionAddress: '',
                    secondaryInstitution: '',
                    secondaryInstitutionAddress: ''
                });
            }
        } catch (err) {
            console.error('Error fetching doctor details:', err);
            // Still set basic info from currentDoctor
            setDoctorDetails({
                username: currentDoctor.username,
                email: currentDoctor.email || '',
            } as Doctor);
        }
    };

    const handleEditClick = () => {
        // Always allow opening the modal - use whatever data we have
        if (doctorDetails) {
            setForm(doctorDetails);
        } else if (currentDoctor) {
            // Fallback to basic info
            setForm({
                username: currentDoctor.username,
                email: currentDoctor.email || '',
                firstName: '',
                lastName: '',
                primaryInstitution: '',
                primaryInstitutionAddress: '',
                secondaryInstitution: '',
                secondaryInstitutionAddress: ''
            });
        }
        setShowEditModal(true);
    };

    const handleUpdateDoctor = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            console.log('Attempting to update doctor with:', form);
            const { data, errors } = await client.models.Doctor.update({
                id: form.id!,  // Use id for the primary key
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email,
                primaryInstitution: form.primaryInstitution,
                primaryInstitutionAddress: form.primaryInstitutionAddress,
                secondaryInstitution: form.secondaryInstitution,
                secondaryInstitutionAddress: form.secondaryInstitutionAddress,
            });

            if (errors && errors.length > 0) {
                console.error('Update errors:', errors);
                alert('Failed to update profile: ' + errors.map(e => e.message).join(', '));
                return;
            }

            console.log('Update successful, received:', data);
            if (data) {
                setDoctorDetails(data as Doctor);
                // Re-fetch to ensure we have latest data
                await fetchDoctorDetails();
            }
            setShowEditModal(false);
        } catch (err) {
            console.error('Error updating doctor:', err);
            alert('Failed to update profile: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    const displayName = doctorDetails?.lastName
        ? `Dr. ${doctorDetails.lastName}`
        : `Dr. ${currentDoctor?.username}`;

    return (
        <>
            <header className="header">
                <div className="container">
                    <div className="header-content">
                        <a href="/" className="logo">dAIgnostics</a>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ color: 'var(--dark-gray)' }}>
                                Welcome, <span
                                    onClick={handleEditClick}
                                    style={{
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        color: 'var(--primary-color)'
                                    }}
                                >
                                    {displayName}
                                </span>
                            </span>
                            <button onClick={logout} className="btn btn-secondary">
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {showEditModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Edit Profile</h2>
                            <button onClick={() => setShowEditModal(false)} className="modal-close">×</button>
                        </div>
                        <form onSubmit={handleUpdateDoctor}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label>First Name</label>
                                        <input
                                            type="text"
                                            value={form.firstName || ''}
                                            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Last Name</label>
                                        <input
                                            type="text"
                                            value={form.lastName || ''}
                                            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={form.email || ''}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Primary Institution</label>
                                    <input
                                        type="text"
                                        value={form.primaryInstitution || ''}
                                        onChange={(e) => setForm({ ...form, primaryInstitution: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Primary Institution Address</label>
                                    <input
                                        type="text"
                                        value={form.primaryInstitutionAddress || ''}
                                        onChange={(e) => setForm({ ...form, primaryInstitutionAddress: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Secondary Institution (Optional)</label>
                                    <input
                                        type="text"
                                        value={form.secondaryInstitution || ''}
                                        onChange={(e) => setForm({ ...form, secondaryInstitution: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Secondary Institution Address (Optional)</label>
                                    <input
                                        type="text"
                                        value={form.secondaryInstitutionAddress || ''}
                                        onChange={(e) => setForm({ ...form, secondaryInstitutionAddress: e.target.value })}
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
        </>
    );
};

export default Header;
