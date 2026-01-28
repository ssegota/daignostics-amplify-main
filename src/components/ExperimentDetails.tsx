import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useAuth } from '../AuthContext';
import Header from './Header';

const client = generateClient<Schema>();

interface SpectralFeatures {
    [key: string]: number;
}

interface ModelResult {
    model: string;
    prediction: number | null;
    probabilities: number[] | null;
    error: string | null;
}

interface Experiment {
    id: string;
    patientId: string;
    generationDate: string;
    spectralFeatures: string;
    consensusPrediction: number | null;
    consensusConfidence: number | null;
    averageProbabilities: string | null;
    individualResults: string | null;
    modelsUsed: number | null;
}

// Group features by channel for display
const CHANNEL_NAMES = ['Channel 0', 'Channel 1', 'Channel 2'];
const FEATURE_LABELS: Record<string, string> = {
    'total_power': 'Total Power',
    'peak_freq': 'Peak Frequency',
    'peak_power': 'Peak Power',
    'centroid': 'Centroid',
    'bandwidth': 'Bandwidth',
    'rolloff95': 'Rolloff 95%',
    'flatness': 'Flatness',
    'entropy': 'Entropy',
    'slope': 'Slope',
    'bp_uSlow': 'BP Ultra Slow',
    'bp_slow': 'BP Slow',
    'bp_mid': 'BP Mid',
    'bp_fast': 'BP Fast',
};

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
    const [showAllFeatures, setShowAllFeatures] = useState(false);
    const [selectedModelResult, setSelectedModelResult] = useState<ModelResult | null>(null);

    useEffect(() => {
        if (!id) return;
        fetchExperiment();
    }, [id]);

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
            setExperiment(data as unknown as Experiment);

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

    const getSpectralFeatures = (): SpectralFeatures | null => {
        if (!experiment?.spectralFeatures) return null;
        try {
            return JSON.parse(experiment.spectralFeatures);
        } catch {
            return null;
        }
    };

    const getModelResults = (): ModelResult[] => {
        if (!experiment?.individualResults) return [];
        try {
            return JSON.parse(experiment.individualResults);
        } catch {
            return [];
        }
    };

    const getAverageProbabilities = (): number[] | null => {
        if (!experiment?.averageProbabilities) return null;
        try {
            return JSON.parse(experiment.averageProbabilities);
        } catch {
            return null;
        }
    };

    const handleGenerateReport = async () => {
        if (!experiment || !currentUser) return;
        setGenerating(true);
        setError('');

        try {
            const apiUrl = import.meta.env.VITE_REPORT_API_URL;
            if (!apiUrl) {
                throw new Error('Report API URL not configured');
            }

            const features = getSpectralFeatures();
            const modelResults = getModelResults();
            const avgProbs = getAverageProbabilities();

            const payload = {
                doctorUsername: currentUser.username,
                patientName: patientName || 'Unknown Patient',
                measurements: {
                    spectralFeatures: features,
                    generationDate: experiment.generationDate,
                },
                mlResults: {
                    consensusPrediction: experiment.consensusPrediction,
                    consensusConfidence: experiment.consensusConfidence,
                    averageProbabilities: avgProbs,
                    individualResults: modelResults,
                    modelsUsed: experiment.modelsUsed,
                    diagnosis: experiment.consensusPrediction === 1 ? 'Positive' : 'Negative',
                },
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.downloadUrl) {
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
        } finally {
            setGenerating(false);
        }
    };

    const handleTextToSpeech = async () => {
        if (!reportData?.analysis) return;

        if (audioRef.current && audioUrl) {
            if (isSpeaking && !isPaused) {
                audioRef.current.pause();
                setIsPaused(true);
                return;
            } else if (isPaused) {
                audioRef.current.play();
                setIsPaused(false);
                return;
            }
        }

        try {
            setIsSpeaking(true);
            setIsPaused(false);
            const apiUrl = import.meta.env.VITE_REPORT_API_URL;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'text_to_speech', text: reportData.analysis }),
            });

            if (!response.ok) throw new Error('Failed to generate speech');
            const result = await response.json();

            if (result.success && result.audio) {
                const audioData = atob(result.audio);
                const audioArray = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    audioArray[i] = audioData.charCodeAt(i);
                }
                const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
                const newAudioUrl = URL.createObjectURL(audioBlob);

                if (audioUrl) URL.revokeObjectURL(audioUrl);
                setAudioUrl(newAudioUrl);

                if (!audioRef.current) audioRef.current = new Audio();
                audioRef.current.src = newAudioUrl;
                audioRef.current.playbackRate = playbackSpeed;
                audioRef.current.onended = () => { setIsSpeaking(false); setIsPaused(false); };
                audioRef.current.onerror = () => { setIsSpeaking(false); setIsPaused(false); fallbackToWebSpeech(); };
                await audioRef.current.play();
            } else {
                throw new Error('Invalid TTS response');
            }
        } catch {
            fallbackToWebSpeech();
        }
    };

    const handleStop = () => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
    };

    const fallbackToWebSpeech = () => {
        if (!reportData?.analysis || !('speechSynthesis' in window)) {
            setIsSpeaking(false);
            return;
        }
        const utterance = new SpeechSynthesisUtterance(reportData.analysis);
        utterance.lang = 'en-US';
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    const getPredictionLabel = (prediction: number | null) => {
        if (prediction === null) return 'Unknown';
        return prediction === 1 ? 'Positive' : 'Negative';
    };

    const getPredictionColor = (prediction: number | null) => {
        if (prediction === null) return '#666';
        return prediction === 1 ? '#e74c3c' : '#27ae60';
    };

    // Helper to format percentage
    const formatPct = (val: number) => (val * 100).toFixed(1) + '%';

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
                    <button onClick={() => navigate(-1)} className="btn btn-primary mt-md">Go Back</button>
                </div>
            </>
        );
    }

    const features = getSpectralFeatures();
    const modelResults = getModelResults();
    const avgProbs = getAverageProbabilities();

    return (
        <>
            <Header />
            <div className="patient-list-container">
                <div className="container">
                    <button onClick={() => navigate(`/patient/${experiment.patientId}`)} className="btn btn-secondary mb-lg">
                        ← Back to Patient
                    </button>

                    <div className="experiment-details-header">
                        <h1>Experiment Results</h1>
                        <p style={{ color: 'var(--dark-gray)', marginTop: 'var(--spacing-xs)' }}>
                            {new Date(experiment.generationDate).toLocaleString()}
                        </p>
                    </div>

                    {/* ML Prediction Results */}
                    <div className="card mb-lg" style={{
                        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                        border: `3px solid ${getPredictionColor(experiment.consensusPrediction)}`,
                        padding: '2rem'
                    }}>
                        <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🤖 ML Diagnosis
                        </h2>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    fontSize: '3rem',
                                    fontWeight: 'bold',
                                    color: getPredictionColor(experiment.consensusPrediction)
                                }}>
                                    {getPredictionLabel(experiment.consensusPrediction)}
                                </div>
                                <div style={{ color: '#666', marginTop: '0.5rem' }}>
                                    Consensus Prediction
                                </div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
                                    {experiment.consensusConfidence !== null
                                        ? `${(experiment.consensusConfidence * 100).toFixed(0)}%`
                                        : 'N/A'}
                                </div>
                                <div style={{ color: '#666' }}>Confidence</div>
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>
                                    {modelResults.length > 0
                                        ? `${modelResults.filter(r => Number(r.prediction) === Number(experiment.consensusPrediction)).length}/${modelResults.length}`
                                        : `${experiment.modelsUsed || 0}/6`
                                    }
                                </div>
                                <div style={{ color: '#666' }}>Models Agree</div>
                            </div>

                            {avgProbs && (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', color: '#333' }}>
                                        <span style={{ color: '#27ae60' }}>{(avgProbs[0] * 100).toFixed(1)}%</span>
                                        {' / '}
                                        <span style={{ color: '#e74c3c' }}>{(avgProbs[1] * 100).toFixed(1)}%</span>
                                    </div>
                                    <div style={{ color: '#666' }}>Neg / Pos Probability</div>
                                </div>
                            )}
                        </div>

                        {/* Individual Model Results */}
                        {modelResults.length > 0 && (
                            <div style={{ marginTop: '1.5rem' }}>
                                <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#666' }}>
                                    Individual Model Votes (Click for details)
                                </h3>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {modelResults.map((result) => (
                                        <div
                                            key={result.model}
                                            onClick={() => setSelectedModelResult(result)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '20px',
                                                background: result.error ? '#ffc107' : getPredictionColor(result.prediction),
                                                color: 'white',
                                                fontSize: '0.85rem',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                                transition: 'transform 0.1s',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                            title="Click to view probabilities"
                                        >
                                            {result.model}: {result.error ? '⚠️' : getPredictionLabel(result.prediction)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Spectral Features - Collapsible */}
                    {features && (
                        <div className="card mb-lg">
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    padding: '1rem'
                                }}
                                onClick={() => setShowAllFeatures(!showAllFeatures)}
                            >
                                <h2 style={{ margin: 0 }}>📊 Spectral Features</h2>
                                <span style={{ fontSize: '1.5rem' }}>{showAllFeatures ? '▼' : '▶'}</span>
                            </div>

                            {showAllFeatures && (
                                <div style={{ padding: '0 1rem 1rem' }}>
                                    {[0, 1, 2].map(ch => (
                                        <div key={ch} style={{ marginBottom: '1rem' }}>
                                            <h3 style={{ fontSize: '1rem', color: '#666', marginBottom: '0.5rem' }}>
                                                {CHANNEL_NAMES[ch]}
                                            </h3>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                                gap: '0.5rem'
                                            }}>
                                                {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                                                    const featureKey = `ch${ch}_${key}`;
                                                    const value = features[featureKey];
                                                    if (value === undefined) return null;
                                                    return (
                                                        <div
                                                            key={featureKey}
                                                            style={{
                                                                padding: '0.5rem',
                                                                background: '#f8f9fa',
                                                                borderRadius: '4px',
                                                                fontSize: '0.85rem'
                                                            }}
                                                        >
                                                            <span style={{ color: '#666' }}>{label}:</span>{' '}
                                                            <strong>{value.toFixed(4)}</strong>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Generate Report Button */}
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

                    {/* Model Detail Modal */}
                    {selectedModelResult && (
                        <div className="modal-overlay" onClick={() => setSelectedModelResult(null)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                                <div className="modal-header">
                                    <h2 style={{ color: getPredictionColor(selectedModelResult.prediction) }}>
                                        {selectedModelResult.model} Details
                                    </h2>
                                    <button className="modal-close" onClick={() => setSelectedModelResult(null)}>×</button>
                                </div>
                                <div className="modal-body">
                                    {selectedModelResult.error ? (
                                        <div className="form-error">{selectedModelResult.error}</div>
                                    ) : (
                                        <div>
                                            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                                <h3>Prediction: {getPredictionLabel(selectedModelResult.prediction)}</h3>
                                            </div>

                                            {selectedModelResult.probabilities && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                            <span>Negative (Healthy)</span>
                                                            <span>{formatPct(selectedModelResult.probabilities[0])}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '10px', background: '#eee', borderRadius: '5px', overflow: 'hidden' }}>
                                                            <div style={{ width: formatPct(selectedModelResult.probabilities[0]), height: '100%', background: '#27ae60' }}></div>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                            <span>Positive (Sick)</span>
                                                            <span>{formatPct(selectedModelResult.probabilities[1])}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '10px', background: '#eee', borderRadius: '5px', overflow: 'hidden' }}>
                                                            <div style={{ width: formatPct(selectedModelResult.probabilities[1]), height: '100%', background: '#e74c3c' }}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={() => setSelectedModelResult(null)}>Close</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Report Preview Modal */}
                    {showPreview && reportData && (
                        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>📄 Report Generated</h2>
                                    <button className="modal-close" onClick={() => setShowPreview(false)}>×</button>
                                </div>
                                <div className="modal-body">
                                    <div className="report-preview">
                                        <h3>Clinical Interpretation</h3>
                                        <p style={{ lineHeight: '1.6' }}>{reportData.analysis}</p>
                                    </div>
                                </div>
                                <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>Close</button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: 'auto' }}>
                                        {!isSpeaking ? (
                                            <button className="btn btn-primary" onClick={handleTextToSpeech}>▶️ Play</button>
                                        ) : (
                                            <>
                                                <button className="btn btn-primary" onClick={() => { if (audioRef.current) { isPaused ? audioRef.current.play() : audioRef.current.pause(); setIsPaused(!isPaused); } }}>
                                                    {isPaused ? '▶️' : '⏸️'}
                                                </button>
                                                <button className="btn btn-secondary" onClick={handleStop}>⏹️</button>
                                            </>
                                        )}
                                        <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} style={{ padding: '0.4rem', borderRadius: '4px' }}>
                                            <option value={0.5}>0.5x</option>
                                            <option value={1}>1x</option>
                                            <option value={1.5}>1.5x</option>
                                            <option value={2}>2x</option>
                                        </select>
                                    </div>
                                    <button className="btn btn-primary" onClick={() => { window.open(reportData.downloadUrl, '_blank'); setShowPreview(false); }}>
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
