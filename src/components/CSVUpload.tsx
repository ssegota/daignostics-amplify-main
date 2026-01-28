import React, { useState, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

// Expected spectral feature names (39 features)
const SPECTRAL_FEATURES = [
    'ch0_total_power', 'ch0_peak_freq', 'ch0_peak_power', 'ch0_centroid', 'ch0_bandwidth',
    'ch0_rolloff95', 'ch0_flatness', 'ch0_entropy', 'ch0_slope', 'ch0_bp_uSlow',
    'ch0_bp_slow', 'ch0_bp_mid', 'ch0_bp_fast',
    'ch1_total_power', 'ch1_peak_freq', 'ch1_peak_power', 'ch1_centroid', 'ch1_bandwidth',
    'ch1_rolloff95', 'ch1_flatness', 'ch1_entropy', 'ch1_slope', 'ch1_bp_uSlow',
    'ch1_bp_slow', 'ch1_bp_mid', 'ch1_bp_fast',
    'ch2_total_power', 'ch2_peak_freq', 'ch2_peak_power', 'ch2_centroid', 'ch2_bandwidth',
    'ch2_rolloff95', 'ch2_flatness', 'ch2_entropy', 'ch2_slope', 'ch2_bp_uSlow',
    'ch2_bp_slow', 'ch2_bp_mid', 'ch2_bp_fast'
];

interface CSVUploadProps {
    patientId: string;
    patientCognitoId?: string;
    onUploadComplete: () => void;
}

interface MLResult {
    consensus_prediction: number;
    consensus_confidence: number;
    average_probabilities: number[];
    individual_results: {
        model: string;
        prediction: number | null;
        probabilities: number[] | null;
        error: string | null;
    }[];
    models_used: number;
}

const CSVUpload: React.FC<CSVUploadProps> = ({ patientId, patientCognitoId, onUploadComplete }) => {
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const parseCSV = (text: string): Record<string, number> | null => {
        // Remove Byte Order Mark (BOM) if present
        const cleanText = text.replace(/^\uFEFF/, '');
        const lines = cleanText.trim().split('\n');

        if (lines.length < 2) {
            setError('CSV must have at least 2 rows (header and data)');
            return null;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const values = lines[1].split(',').map(v => v.trim());

        const features: Record<string, number> = {};
        let foundFeatures = 0;

        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const value = values[i];

            // Skip 'y' label column if present
            if (header === 'y') continue;

            // Check if this is a spectral feature
            if (SPECTRAL_FEATURES.includes(header)) {
                const numVal = parseFloat(value);
                if (!isNaN(numVal)) {
                    features[header] = numVal;
                    foundFeatures++;
                }
            }
        }

        if (foundFeatures < 10) {
            setError(`Only found ${foundFeatures} spectral features. Expected 39 features.`);
            return null;
        }

        console.log(`Parsed ${foundFeatures} spectral features`);
        return features;
    };

    const callMLAPI = async (features: Record<string, number>): Promise<MLResult | null> => {
        try {
            setStatus('Calling ML models...');

            // Invoke the predictExperiment query via AppSync (authenticated)
            const { data, errors } = await client.queries.predictExperiment({
                features: JSON.stringify(features)
            });

            if (errors) {
                console.error("GraphQL errors:", errors);
                throw new Error(errors[0].message || 'Unknown GraphQL error');
            }

            if (!data) return null;

            // data is the JSON string returned by lambda_master
            return JSON.parse(data);
        } catch (err) {
            console.error('ML API error:', err);
            setError('Failed to get ML predictions');
            return null;
        }
    };

    const handleFile = async (file: File) => {
        if (uploading) {
            console.log('CSVUpload: Already uploading, ignoring file:', file.name);
            return;
        }

        console.log('CSVUpload: Processing file:', file.name);
        setError('');
        setStatus('Parsing CSV...');
        setUploading(true);

        try {
            const text = await file.text();
            const features = parseCSV(text);

            if (!features) {
                setUploading(false);
                setStatus('');
                return;
            }

            // Call ML API for predictions
            const mlResult = await callMLAPI(features);

            if (!mlResult) {
                setUploading(false);
                setStatus('');
                return;
            }

            setStatus('Saving experiment...');

            // Create experiment with spectral features and ML results
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            // Sanitize data to prevent NaN/Infinity issues which can crash AppSync
            const sanitizeNumber = (val: any) => {
                if (typeof val !== 'number') return null;
                if (!isFinite(val)) return null;
                return val;
            };

            const experimentData: any = {
                patientId,
                generationDate: new Date().toISOString(),
                spectralFeatures: JSON.stringify(features),
                consensusPrediction: sanitizeNumber(mlResult.consensus_prediction),
                consensusConfidence: sanitizeNumber(mlResult.consensus_confidence),
                averageProbabilities: JSON.stringify(mlResult.average_probabilities),
                individualResults: JSON.stringify(mlResult.individual_results),
                modelsUsed: sanitizeNumber(mlResult.models_used) || 0,
            };

            if (patientCognitoId) {
                experimentData.patientCognitoId = patientCognitoId;
            }

            console.log('CSVUpload: Creating experiment...', experimentData);

            try {
                await client.models.Experiment.create(experimentData);
                console.log('CSVUpload: Experiment created successfully');

                setUploading(false);
                setStatus('');
                if (inputRef.current) {
                    inputRef.current.value = '';
                }
                onUploadComplete();
            } catch (dbErr: any) {
                console.error('CSVUpload: Database save error:', dbErr);
                // Extract useful error message
                const errorMessage = dbErr.message || (dbErr.errors && dbErr.errors[0]?.message) || JSON.stringify(dbErr);
                setError(`Failed to save experiment: ${errorMessage}`);
                setUploading(false);
                setStatus('');
            }
        } catch (err) {
            console.error('CSVUpload: General error:', err);
            setError('An unexpected error occurred during upload');
            setUploading(false);
            setStatus('');
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleClick = () => {
        if (uploading) return;
        inputRef.current?.click();
    };

    return (
        <div className="csv-upload-container">
            <div
                className={`csv-drop-zone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleClick}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />
                {uploading ? (
                    <div style={{ textAlign: 'center' }}>
                        <span className="spinner"></span>
                        <p>{status || 'Processing...'}</p>
                    </div>
                ) : (
                    <>
                        <div className="csv-icon">🧬</div>
                        <p><strong>Drop spectral CSV here</strong> or click to browse</p>
                        <p className="csv-hint">Format: 39 spectral features (ch0-ch2)</p>
                    </>
                )}
            </div>
            {error && <div className="form-error mt-sm">{error}</div>}
        </div>
    );
};

export default CSVUpload;
