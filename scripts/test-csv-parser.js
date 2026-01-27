import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvContent = fs.readFileSync(path.join(__dirname, '../misc/test.csv'), 'utf8');

function parseCSV(text) {
    const lines = text.trim().split('\n');
    console.log(`Lines length: ${lines.length}`);
    if (lines.length < 2) {
        console.error('CSV must have at least 2 rows (header and data)');
        return null;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const values = lines[1].split(',').map(v => v.trim());

    console.log('Headers:', headers.map(h => `"${h}"`));
    console.log('Values:', values);

    if (headers.length !== values.length) {
        console.error('Header and data row must have the same number of columns');
        return null;
    }

    const data = { patientId: 'test-patient-id' };

    for (let i = 0; i < headers.length; i++) {
        let header = headers[i];

        const value = values[i];

        if (header === 'generationDate') {
            data[header] = value;
        } else if (['peakCounts', 'amplitude', 'auc', 'fwhm', 'frequency', 'snr', 'skewness', 'kurtosis'].includes(header)) {
            data[header] = parseFloat(value);
        }
    }

    return data;
}

const parsed = parseCSV(csvContent);
console.log('Parsed Data:', parsed);

const requiredFields = ['peakCounts', 'amplitude', 'auc', 'fwhm', 'frequency', 'snr', 'skewness', 'kurtosis', 'generationDate', 'patientId'];
const missingFields = requiredFields.filter(field => parsed[field] === undefined);

if (missingFields.length > 0) {
    console.error('❌ Missing fields:', missingFields);
} else {
    console.log('✅ All fields present');
}
