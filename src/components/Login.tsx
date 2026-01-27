import React, { useState } from 'react';
import { useAuth } from '../AuthContext';


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
            await login({ username, password });
            // Login successful - AuthContext state change will trigger redirect in App.tsx
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Invalid username or password');
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-split-layout">
                {/* Left Side: About Section */}
                <div className="login-about-section">
                    <div className="login-about-content">
                        <h2>Revolutionizing Diagnosis</h2>
                        <p>
                            At dAIgnostics, our passion is improving the lives of people affected by neurodegenerative diseases.
                            Our highly effective AI-powered methodology for diagnosing ALS is founded on decades of research.
                        </p>
                        <p>
                            We are continually enhancing our method to include other neurological disorders like Parkinson’s,
                            Alzheimer’s, and Huntington’s disease.
                        </p>
                        <p>
                            By combining AI expertise with cutting-edge technologies, we aim to enable early treatment
                            and make a meaningful impact on the lives of millions worldwide.
                        </p>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="login-form-section">
                    <div className="login-card">
                        <div className="login-header">
                            <a href="https://daignostics.info" target="_blank" rel="noopener noreferrer">
                                <img src="/logo.svg" alt="dAIgnostics" style={{ height: '48px', marginBottom: '1rem' }} />
                            </a>
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
            </div>
        </div>
    );
};

export default Login;
