import React, { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';

const client = generateClient<Schema>();

const Login: React.FC = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Query the Doctor table for matching username
            const { data: doctors } = await client.models.Doctor.list({
                filter: { username: { eq: username } },
            });

            if (doctors.length === 0) {
                setError('Invalid username or password');
                setLoading(false);
                return;
            }

            const doctor = doctors[0];

            // Check password (plaintext comparison for demo)
            if (doctor.password !== password) {
                setError('Invalid username or password');
                setLoading(false);
                return;
            }

            // Login successful
            login(doctor.username, doctor.email);
        } catch (err) {
            console.error('Login error:', err);
            setError('An error occurred during login');
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h1 className="login-title">dAIgnostics</h1>
                    <p className="login-subtitle">Doctor Portal</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="form-error">{error}</div>}

                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                Logging in...
                            </>
                        ) : (
                            'Login'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
