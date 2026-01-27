import React, { useState, useRef } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface CSVUploadProps {
    patientId: string;
    onUploadComplete: () => void;
}

const CSVUpload: React.FC<CSVUploadProps> = ({ patientId, onUploadComplete }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const parseCSV = (text: string): any | null => {
        // Remove Byte Order Mark (BOM) if present
        const cleanText = text.replace(/^\uFEFF/, '');
        const lines = cleanText.trim().split('\n');

        if (lines.length < 2) {
            setError('CSV must have at least 2 rows (header and data)');
            return null;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const values = lines[1].split(',').map(v => v.trim());

        if (headers.length !== values.length) {
            setError(`Header count (${headers.length}) does not match value count (${values.length})`);
            return null;
        }

        const data: any = { patientId };
        let hasValidField = false;

        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const value = values[i];

            // Convert to appropriate types
            if (header === 'generationDate') {
                data[header] = value;
                hasValidField = true;
            } else if (['peakCounts', 'amplitude', 'auc', 'fwhm', 'frequency', 'snr', 'skewness', 'kurtosis'].includes(header)) {
                const numVal = parseFloat(value);
                if (!isNaN(numVal)) {
                    data[header] = numVal;
                    hasValidField = true;
                }
            }
        }

        if (!hasValidField) {
            setError('No valid fields found in CSV. Check headers.');
            return null;
        }

        return data;
    };

    const handleFile = async (file: File) => {
        setError('');
        setUploading(true);

        try {
            const text = await file.text();
            const experimentData = parseCSV(text);

            if (!experimentData) {
                setUploading(false);
                return;
            }

            // Create experiment
            await client.models.Experiment.create(experimentData);

            setUploading(false);
            onUploadComplete();
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to upload experiment data');
            setUploading(false);
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
                        <p>Uploading experiment...</p>
                    </div>
                ) : (
                    <>
                        <div className="csv-icon">📊</div>
                        <p><strong>Drop CSV file here</strong> or click to browse</p>
                        <p className="csv-hint">Format: Header row (field names), Data row (values)</p>
                    </>
                )}
            </div>
            {error && <div className="form-error mt-sm">{error}</div>}
        </div>
    );
};

export default CSVUpload;
