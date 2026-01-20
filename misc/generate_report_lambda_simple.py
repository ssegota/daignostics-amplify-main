"""
Simplified AWS Lambda for generating medical reports with WeasyPrint (fewer dependencies)
Or use this minimal version without PDF - just return text
"""

import json
import boto3
from datetime import datetime, timedelta

# AWS clients
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')
s3_client = boto3.client('s3')

S3_BUCKET = 'daignostics-reports'
S3_PREFIX = 'test_reports/'

def lambda_handler(event, context):
    """Main handler - simplified without PDF for now"""
    try:
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event
        
        doctor_username = body.get('doctorUsername')
        patient_name = body.get('patientName')
        measurements = body.get('measurements')
        
        if not all([doctor_username, patient_name, measurements]):
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Missing required fields'})
            }
        
        # Get analysis (or skip for testing)
        analysis = f"Analysis for {patient_name} by Dr. {doctor_username}"
        
        # For now, return text instead of PDF
        report_text = generate_text_report(doctor_username, patient_name, measurements, analysis)
        
        # Save as text file to S3
        file_name = f"report_{patient_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        s3_key = f"{S3_PREFIX}{file_name}"
        
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=report_text,
            ContentType='text/plain'
        )
        
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': s3_key},
            ExpiresIn=3600
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'downloadUrl': download_url,
                's3Uri': f"s3://{S3_BUCKET}/{s3_key}",
                'message': 'Report generated successfully (text format)'
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }


def generate_text_report(doctor_username, patient_name, measurements, analysis):
    """Generate plain text report"""
    report = f"""
========================================
dAIgnostics - Medical Analysis Report
========================================

Report Date: {datetime.now().strftime("%B %d, %Y at %I:%M %p")}
Physician: Dr. {doctor_username}
Patient: {patient_name}

----------------------------------------
Measurement Results
----------------------------------------
Peak Counts: {measurements.get('peakCounts', 'N/A')}
Amplitude: {measurements.get('amplitude', 'N/A')} mV
AUC: {measurements.get('auc', 'N/A')}
FWHM: {measurements.get('fwhm', 'N/A')} ms
Frequency: {measurements.get('frequency', 'N/A')} Hz
SNR: {measurements.get('snr', 'N/A')} dB
Skewness: {measurements.get('skewness', 'N/A')}
Kurtosis: {measurements.get('kurtosis', 'N/A')}
Test Date: {measurements.get('generationDate', 'N/A')}

----------------------------------------
Clinical Interpretation
----------------------------------------
{analysis}

========================================
This report was generated using AI-assisted analysis.
========================================
"""
    return report


if __name__ == "__main__":
    test_event = {
        "doctorUsername": "drjones",
        "patientName": "John Doe",
        "measurements": {
            "peakCounts": 45.0,
            "amplitude": 5.23,
            "auc": 750.5,
            "fwhm": 2.1,
            "frequency": 50.3,
            "snr": 35.8,
            "skewness": 0.5,
            "kurtosis": 3.2,
            "generationDate": "2026-01-15T10:30:00.000Z"
        }
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))
