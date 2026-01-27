import React, { useState } from 'react';
import { useAuth } from '../AuthContext';


const Login: React.FC = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);


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
                            <p className="login-subtitle">
                                Portal Login
                            </p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="username">
                                    Username or Email
                                </label>
                                <input
                                    type="text"
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username or email"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        disabled={loading}
                                        style={{ paddingRight: '40px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#666',
                                            padding: '0',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                <circle cx="12" cy="12" r="3"></circle>
                                            </svg>
                                        )}
                                    </button>
                                </div>
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
