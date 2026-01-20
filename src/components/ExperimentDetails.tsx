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

interface MetricInfo {
    label: string;
    value: number;
    unit: string;
    tooltip: string;
}

const ExperimentDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentDoctor, logout } = useAuth();
    const [experiment, setExperiment] = useState<Experiment | null>(null);
    const [patientName, setPatientName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetchExperiment();
    }, [id]);

    const fetchExperiment = async () => {
        if (!id) return;

        setLoading(true);
        setError('');

        try {
            const { data } = await client.models.Experiment.get({ id });
            if (!data) {
                setError('Experiment not found');
                setLoading(false);
                return;
            }
            setExperiment(data as Experiment);

            // Fetch patient name
            if (data.patientId) {
                const { data: patientData } = await client.models.Patient.get({ id: data.patientId });
                if (patientData) {
                    setPatientName(`${patientData.firstName} ${patientData.lastName}`);
                }
            }
        } catch (err) {
            console.error('Error fetching experiment:', err);
            setError('Failed to load experiment data');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!experiment || !currentDoctor) return;

        setGenerating(true);
        setError('');

        try {
            const apiUrl = import.meta.env.VITE_REPORT_API_URL;

            if (!apiUrl) {
                throw new Error('Report API URL not configured. Please set VITE_REPORT_API_URL in .env');
            }

            // Prepare request payload
            const payload = {
                doctorUsername: currentDoctor.username,
                patientName: patientName || 'Unknown Patient',
                measurements: {
                    peakCounts: experiment.peakCounts,
                    amplitude: experiment.amplitude,
                    auc: experiment.auc,
                    fwhm: experiment.fwhm,
                    frequency: experiment.frequency,
                    snr: experiment.snr,
                    skewness: experiment.skewness,
                    kurtosis: experiment.kurtosis,
                    generationDate: experiment.generationDate,
                },
            };

            console.log('Sending request to Lambda:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.downloadUrl) {
                // Open download URL in new tab
                window.open(result.downloadUrl, '_blank');
                alert('✅ Report generated successfully! Download started.');
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (err) {
            console.error('Error generating report:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate report');
            alert(`Failed to generate report: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setGenerating(false);
        }
    };

    const getMetrics = (): MetricInfo[] => {
        if (!experiment) return [];

        return [
            {
                label: 'Peak Counts',
                value: experiment.peakCounts,
                unit: '',
                tooltip: 'Number of detected peaks in the signal',
            },
            {
                label: 'Amplitude',
                value: experiment.amplitude,
                unit: 'mV',
                tooltip: 'Maximum signal strength',
            },
            {
                label: 'AUC',
                value: experiment.auc,
                unit: '',
                tooltip: 'Area Under Curve - total area under the signal curve',
            },
            {
                label: 'FWHM',
                value: experiment.fwhm,
                unit: 'ms',
                tooltip: 'Full Width at Half Maximum - width of peak at half its maximum height',
            },
            {
                label: 'Frequency',
                value: experiment.frequency,
                unit: 'Hz',
                tooltip: 'Dominant frequency in the signal',
            },
            {
                label: 'SNR',
                value: experiment.snr,
                unit: 'dB',
                tooltip: 'Signal-to-Noise Ratio - ratio of signal power to noise power',
            },
            {
                label: 'Skewness',
                value: experiment.skewness,
                unit: '',
                tooltip: 'Measure of signal asymmetry around its mean',
            },
            {
                label: 'Kurtosis',
                value: experiment.kurtosis,
                unit: '',
                tooltip: 'Measure of signal distribution tailedness (peakedness)',
            },
        ];
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

    if (error || !experiment) {
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
                    <p>{error || 'Experiment not found'}</p>
                    <button onClick={() => navigate(-1)} className="btn btn-primary mt-md">
                        Go Back
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
                    <button onClick={() => navigate(`/patient/${experiment.patientId}`)} className="btn btn-secondary mb-lg">
                        ← Back to Patient
                    </button>

                    <div className="experiment-details-header">
                        <h1>Experiment Details</h1>
                        <p style={{ color: 'var(--dark-gray)', marginTop: 'var(--spacing-xs)' }}>
                            Generated: {new Date(experiment.generationDate).toLocaleString()}
                        </p>
                        <p style={{ color: 'var(--dark-gray)' }}>
                            Experiment ID: {experiment.id.slice(0, 16)}
                        </p>
                    </div>

                    <div className="metrics-grid">
                        {getMetrics().map((metric) => (
                            <div key={metric.label} className="metric-card" title={metric.tooltip}>
                                <div className="metric-label">{metric.label}</div>
                                <div className="metric-value">
                                    {metric.value.toFixed(2)}
                                    {metric.unit && <span className="metric-unit"> {metric.unit}</span>}
                                </div>
                                <div className="metric-tooltip">{metric.tooltip}</div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-lg" style={{ textAlign: 'center' }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleGenerateReport}
                            disabled={generating}
                        >
                            {generating ? (
                                <>
                                    <span className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></span>
                                    Generating Report...
                                </>
                            ) : (
                                '📄 Generate Report'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ExperimentDetails;
