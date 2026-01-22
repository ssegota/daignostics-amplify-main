"""
AWS Lambda function for generating medical reports using Amazon Bedrock and storing in S3.

This function:
1. Receives experiment measurements, doctor username, and patient name via API Gateway
2. Sends data to Amazon Bedrock (DeepSeek) for analysis
3. Generates a formatted PDF report
4. Saves to S3 bucket
5. Returns pre-signed download URL

Dependencies (add to Lambda layer):
- boto3 (included in Lambda runtime)
- reportlab (for PDF generation - NO PIL required)
"""

import json
import boto3
import os
from datetime import datetime, timedelta
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

# AWS clients
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')
s3_client = boto3.client('s3')

# Configuration
S3_BUCKET = os.environ.get('S3_BUCKET', 'daignostics-reports')
S3_PREFIX = 'reports/'
BEDROCK_MODEL_ID = 'us.anthropic.claude-3-haiku-20240307-v1:0'  # Claude 3 Haiku inference profile

def lambda_handler(event, context):
    """
    Main Lambda handler function.
    
    Expected event structure (direct invocation):
    {
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
    
    Or via API Gateway (body as string):
    {
        "body": "{\"doctorUsername\":...}"
    }
    """
    try:
        # Parse request body (handle both API Gateway and direct invocation)
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event
        
        doctor_username = body.get('doctorUsername')
        patient_name = body.get('patientName')
        measurements = body.get('measurements')
        
        # Validate inputs
        if not all([doctor_username, patient_name, measurements]):
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Missing required fields: doctorUsername, patientName, or measurements'})
            }
        
        # Step 1: Get analysis from Amazon Bedrock
        bedrock_response = get_bedrock_analysis(measurements)
        
        # Step 2: Generate PDF report
        pdf_buffer = generate_pdf_report(
            doctor_username,
            patient_name,
            measurements,
            bedrock_response
        )
        
        # Step 3: Upload to S3
        file_name = f"report_{patient_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        s3_key = f"{S3_PREFIX}{file_name}"
        
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=pdf_buffer.getvalue(),
            ContentType='application/pdf'
        )
        
        # Step 4: Generate pre-signed URL (valid for 1 hour)
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
                'fileName': file_name,
                'analysis': bedrock_response,  # Include AI analysis for preview
                'message': 'Report generated successfully'
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }


def get_bedrock_analysis(measurements):
    """
    Send measurements to Amazon Bedrock (Claude) for AI analysis with ALS-specific context.
    
    Args:
        measurements (dict): Dictionary of Ca²⁺ imaging measurements
        
    Returns:
        str: Clinical analysis text from Claude
    """
    # Format measurements for context
    measurements_text = "\n".join([
        f"- {key}: {value}" for key, value in measurements.items()
        if key != 'generationDate'
    ])
    
    # Build ALS-specific context prompt
    context = (
        "Context: Astrocytes treated with sporadic ALS patient IgG exhibit three Ca²⁺ transient patterns:\n\n"
        "• Single: solitary, rapid transient (time_to_peak ≈ 20 s), driven by ER IP₃R release with minimal extracellular Ca²⁺ involvement.\n"
        "• Bursting: high-frequency repetitive transients (dominant_freq ≈ 0.11 Hz; intervals ≈ 9 s), reflecting cycles of ER release and partial store‐operated Ca²⁺ entry.\n"
        "• Repetitive: isolated transients (>20 s apart), consistent with episodic IP₃ production and delayed ER refill.\n\n"
        "Classification is based on event count, inter‐event interval, and dominant frequency within the first 50 s post‐onset.\n\n"
        "Please generate a medical‐style report (findings, interpretation, and brief diagnostic comment). "
        "Be concise and give final judgement if the patient has possibility of ALS.\n\n"
        f"Metrics:\n{measurements_text}"
    )
    
    # Prepare request for Bedrock (Anthropic Messages API format)
    request_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1000,
        "temperature": 0.7,
        "system": "You are a clinical laboratory specialist report system. Write concise, formal medical reports of Ca²⁺ imaging findings in astrocytes.",
        "messages": [
            {
                "role": "user",
                "content": context
            }
        ]
    }
    
    try:
        response = bedrock_runtime.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(request_body),
            contentType='application/json',
            accept='application/json'
        )
        
        response_body = json.loads(response['body'].read())
        
        # Extract text from Anthropic response
        analysis = response_body.get('content', [{}])[0].get('text', 'No analysis generated')
        
        return analysis
        
    except Exception as e:
        print(f"Bedrock error: {str(e)}")
        return f"AI analysis temporarily unavailable. Please review measurements manually."


def generate_pdf_report(doctor_username, patient_name, measurements, analysis):
    """
    Generate a PDF medical report using ReportLab (NO PIL required).
    
    Args:
        doctor_username (str): Doctor's username
        patient_name (str): Patient's full name
        measurements (dict): Experiment measurements
        analysis (str): Bedrock analysis text
        
    Returns:
        BytesIO: PDF file buffer
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#E31E24'),
        spaceAfter=30,
        alignment=1  # Center
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#E31E24'),
        spaceAfter=12
    )
    
    # Title
    story.append(Paragraph("dAIgnostics", title_style))
    story.append(Paragraph("Neurological Analysis Report", styles['Heading2']))
    story.append(Spacer(1, 0.3 * inch))
    
    # Report metadata
    report_date = datetime.now().strftime("%B %d, %Y at %I:%M %p")
    story.append(Paragraph(f"<b>Report Date:</b> {report_date}", styles['Normal']))
    story.append(Paragraph(f"<b>Physician:</b> Dr. {doctor_username}", styles['Normal']))
    story.append(Paragraph(f"<b>Patient:</b> {patient_name}", styles['Normal']))
    story.append(Spacer(1, 0.3 * inch))
    
    # Experiment measurements
    story.append(Paragraph("Measurement Results", heading_style))
    
    measurement_labels = {
        'peakCounts': ('Peak Counts', ''),
        'amplitude': ('Amplitude', 'mV'),
        'auc': ('Area Under Curve', ''),
        'fwhm': ('FWHM', 'ms'),
        'frequency': ('Frequency', 'Hz'),
        'snr': ('Signal-to-Noise Ratio', 'dB'),
        'skewness': ('Skewness', ''),
        'kurtosis': ('Kurtosis', ''),
        'generationDate': ('Test Date', '')
    }
    
    table_data = [['Measurement', 'Value', 'Unit']]
    for key, value in measurements.items():
        label, unit = measurement_labels.get(key, (key, ''))
        if key == 'generationDate':
            formatted_value = datetime.fromisoformat(value.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M')
        else:
            formatted_value = f"{float(value):.2f}" if isinstance(value, (int, float)) else str(value)
        table_data.append([label, formatted_value, unit])
    
    table = Table(table_data, colWidths=[3*inch, 1.5*inch, 1*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E31E24')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    story.append(table)
    story.append(Spacer(1, 0.3 * inch))
    
    # AI Analysis
    story.append(Paragraph("Clinical Interpretation", heading_style))
    story.append(Paragraph(analysis, styles['Normal']))
    story.append(Spacer(1, 0.5 * inch))
    
    # Footer
    story.append(Paragraph(
        "<i>This report was generated using AI-assisted analysis and should be reviewed by a qualified medical professional.</i>",
        styles['Italic']
    ))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    return buffer
