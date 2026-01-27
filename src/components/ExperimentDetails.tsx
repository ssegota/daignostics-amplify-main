import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';
import Header from './Header';

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
    const { currentUser } = useAuth();
    const [experiment, setExperiment] = useState<Experiment | null>(null);
    const [patientName, setPatientName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [generating, setGenerating] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [reportData, setReportData] = useState<{ analysis: string; downloadUrl: string; fileName: string } | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!id) return;
        fetchExperiment();
    }, [id]);

    // Cleanup effect: stop audio when modal closes
    useEffect(() => {
        if (!showPreview) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            setIsSpeaking(false);
            setIsPaused(false);
        }
    }, [showPreview]);

    // Update playback speed when changed
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed]);

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
        if (!experiment || !currentUser) return;

        setGenerating(true);
        setError('');

        try {
            const apiUrl = import.meta.env.VITE_REPORT_API_URL;

            if (!apiUrl) {
                throw new Error('Report API URL not configured. Please set VITE_REPORT_API_URL in .env');
            }

            // Prepare request payload
            // If current user is doctor, use their username. If patient, use the doctor ID from the patient record (if available) or currentUser.username as fallback
            const doctorUsername = currentUser.role === 'doctor' ? currentUser.username : currentUser.username;

            const payload = {
                doctorUsername: doctorUsername,
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
                // Show preview modal with analysis
                setReportData({
                    analysis: result.analysis || 'Analysis not available',
                    downloadUrl: result.downloadUrl,
                    fileName: result.fileName || 'report.pdf'
                });
                setShowPreview(true);
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

    const handleTextToSpeech = async () => {
        if (!reportData?.analysis) return;

        // If audio exists and is playing, this becomes a toggle
        if (audioRef.current && audioUrl) {
            if (isSpeaking && !isPaused) {
                // Pause
                audioRef.current.pause();
                setIsPaused(true);
                return;
            } else if (isPaused) {
                // Resume
                audioRef.current.play();
                setIsPaused(false);
                return;
            }
        }

        // Generate new audio
        try {
            setIsSpeaking(true);
            setIsPaused(false);

            // Call Lambda TTS endpoint
            const apiUrl = import.meta.env.VITE_REPORT_API_URL;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'text_to_speech',
                    text: reportData.analysis
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate speech');
            }

            const result = await response.json();

            if (result.success && result.audio) {
                // Decode base64 audio
                const audioData = atob(result.audio);
                const audioArray = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    audioArray[i] = audioData.charCodeAt(i);
                }
                const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
                const newAudioUrl = URL.createObjectURL(audioBlob);

                // Revoke old URL if exists
                if (audioUrl) {
                    URL.revokeObjectURL(audioUrl);
                }
                setAudioUrl(newAudioUrl);

                // Create audio element
                if (!audioRef.current) {
                    audioRef.current = new Audio();
                }
                audioRef.current.src = newAudioUrl;
                audioRef.current.playbackRate = playbackSpeed;
                audioRef.current.onended = () => {
                    setIsSpeaking(false);
                    setIsPaused(false);
                };
                audioRef.current.onerror = () => {
                    setIsSpeaking(false);
                    setIsPaused(false);
                    console.error('Audio playback error, trying fallback...');
                    fallbackToWebSpeech();
                };

                await audioRef.current.play();
            } else {
                throw new Error('Invalid response from TTS service');
            }
        } catch (error) {
            console.log('Polly TTS failed, falling back to Web Speech API:', error);
            fallbackToWebSpeech();
        }
    };

    const handlePauseResume = () => {
        if (!audioRef.current) return;

        if (isPaused) {
            audioRef.current.play();
            setIsPaused(false);
        } else {
            audioRef.current.pause();
            setIsPaused(true);
        }
    };

    const handleStop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
        setIsPaused(false);
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
        if (audioRef.current) {
            audioRef.current.playbackRate = speed;
        }
    };

    const fallbackToWebSpeech = () => {
        if (!reportData?.analysis) return;

        // Check if browser supports speech synthesis
        if (!('speechSynthesis' in window)) {
            setIsSpeaking(false);
            alert('Text-to-speech is not available.');
            return;
        }

        try {
            // Create utterance with Web Speech API
            const utterance = new SpeechSynthesisUtterance(reportData.analysis);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => {
                setIsSpeaking(false);
                alert('Text-to-speech failed.');
            };

            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Web Speech API error:', error);
            setIsSpeaking(false);
            alert('Text-to-speech failed.');
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
                <Header />
                <div className="loading-container">
                    <span className="spinner" style={{ width: '40px', height: '40px' }}></span>
                </div>
            </>
        );
    }

    if (error || !experiment) {
        return (
            <>
                <Header />
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
            <Header />

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

                    {/* Report Preview Modal */}
                    {showPreview && reportData && (
                        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>📄 Report Generated Successfully</h2>
                                    <button className="modal-close" onClick={() => setShowPreview(false)}>×</button>
                                </div>
                                <div className="modal-body">
                                    <div className="report-preview">
                                        <h3>Clinical Interpretation</h3>
                                        <p style={{ lineHeight: '1.6', marginBottom: '1.5rem' }}>{reportData.analysis}</p>

                                        <div style={{ borderTop: '1px solid #ddd', paddingTop: '1rem', marginTop: '1rem' }}>
                                            <p style={{ fontSize: '0.9rem', color: '#666' }}>
                                                <strong>File:</strong> {reportData.fileName}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>
                                        Close
                                    </button>

                                    {/* Audio Player Controls */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem 1rem',
                                        backgroundColor: 'var(--off-white)',
                                        borderRadius: '8px',
                                        marginRight: 'auto'
                                    }}>
                                        {!isSpeaking ? (
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleTextToSpeech}
                                                title="Play audio"
                                                style={{ padding: '0.5rem 0.75rem' }}
                                            >
                                                ▶️ Play
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={handlePauseResume}
                                                    title={isPaused ? "Resume" : "Pause"}
                                                    style={{ padding: '0.5rem 0.75rem' }}
                                                >
                                                    {isPaused ? '▶️' : '⏸️'}
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={handleStop}
                                                    title="Stop"
                                                    style={{ padding: '0.5rem 0.75rem' }}
                                                >
                                                    ⏹️
                                                </button>
                                            </>
                                        )}

                                        {/* Speed Control */}
                                        <select
                                            value={playbackSpeed}
                                            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                                            style={{
                                                padding: '0.4rem 0.5rem',
                                                borderRadius: '4px',
                                                border: '1px solid var(--medium-gray)',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer'
                                            }}
                                            title="Playback speed"
                                        >
                                            <option value={0.5}>0.5x</option>
                                            <option value={0.75}>0.75x</option>
                                            <option value={1}>1x</option>
                                            <option value={1.25}>1.25x</option>
                                            <option value={1.5}>1.5x</option>
                                            <option value={2}>2x</option>
                                        </select>
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        onClick={() => {
                                            window.open(reportData.downloadUrl, '_blank');
                                            setShowPreview(false);
                                        }}
                                    >
                                        📥 Download PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ExperimentDetails;
