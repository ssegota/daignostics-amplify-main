# AWS Lambda Deployment Guide for Report Generation

## Overview
This Lambda function generates medical reports using Amazon Bedrock (DeepSeek) and stores them in S3.

## Prerequisites
- AWS Account with permissions for Lambda, Bedrock, and S3
- S3 bucket: `daignostics-reports` (create if doesn't exist)
- Amazon Bedrock access with DeepSeek model enabled

## Deployment Steps

### 1. Create S3 Bucket
```bash
aws s3 mb s3://daignostics-reports
aws s3api put-bucket-cors --bucket daignostics-reports --cors-configuration file://cors.json
```

**cors.json**:
```json
{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}
```

### 2. Create Lambda Layer (for reportlab)
```bash
mkdir python
pip install -r lambda_requirements.txt -t python/
zip -r reportlab-layer.zip python/
aws lambda publish-layer-version \
  --layer-name reportlab \
  --zip-file fileb://reportlab-layer.zip \
  --compatible-runtimes python3.11
```

### 3. Create Lambda Function
```bash
zip function.zip generate_report_lambda.py
aws lambda create-function \
  --function-name daignostics-report-generator \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-s3-bedrock-role \
  --handler generate_report_lambda.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 60 \
  --memory-size 512 \
  --layers arn:aws:lambda:REGION:ACCOUNT:layer:reportlab:1
```

### 4. Create IAM Role
The Lambda needs these permissions:
- `AmazonBedrockFullAccess` (or scoped to DeepSeek model)
- `AmazonS3FullAccess` (or scoped to daignostics-reports bucket)
- `AWSLambdaBasicExecutionRole`

**IAM Policy Example**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:*:*:model/deepseek-r1"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::daignostics-reports/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### 5. Create API Gateway
```bash
aws apigatewayv2 create-api \
  --name daignostics-report-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:REGION:ACCOUNT:function:daignostics-report-generator
```

### 6. Environment Variables
Set in Lambda configuration:
- `BEDROCK_MODEL_ID`: `deepseek-r1` (update based on actual model ID)
- `S3_BUCKET`: `daignostics-reports`

## API Usage

### Request
```bash
curl -X POST https://YOUR_API_ID.execute-api.REGION.amazonaws.com/ \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### Response
```json
{
  "success": true,
  "downloadUrl": "https://daignostics-reports.s3.amazonaws.com/...",
  "s3Uri": "s3://daignostics-reports/test_reports/report_John_Doe_20260120_130500.pdf",
  "message": "Report generated successfully"
}
```

## Testing Locally
```bash
python generate_report_lambda.py
```

## Notes
- Pre-signed URLs expire after 1 hour
- Adjust `BEDROCK_MODEL_ID` based on actual DeepSeek model ID in your region
- PDF includes dAIgnostics branding with red color scheme (#E31E24)
- Reports are stored in `s3://daignostics-reports/test_reports/`

## Troubleshooting
- **Bedrock errors**: Ensure model is enabled in your AWS account
- **S3 errors**: Check bucket exists and Lambda has permissions
- **Timeout**: Increase Lambda timeout if Bedrock takes longer
