# Lambda Report Generation - Complete Setup Guide

This guide covers deploying the Lambda function for PDF report generation and integrating it with your React application.

## 📋 Overview

The Lambda function:
- Takes experiment measurements + patient/doctor info
- Sends data to AWS Bedrock for AI analysis
- Generates a formatted PDF report using ReportLab
- Uploads to S3 and returns a pre-signed download URL

## 🚀 Quick Deployment Steps

### Step 1: Build Lambda Layer (ReportLab without PIL)

```bash
cd /home/sbs/Documents/daignostics/daignostics-amplify-main
./scripts/build-layer.sh
```

This creates `reportlab-layer.zip` (~5MB) using Docker to ensure proper Linux binary compilation.

### Step 2: Upload Layer to AWS

**Option A: AWS Console**
1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/) → Layers
2. Click "Create layer"
3. Name: `reportlab-layer`
4. Upload `reportlab-layer.zip`
5. Compatible runtimes: Python 3.11
6. Click "Create"
7. Copy the Layer ARN (you'll need it next)

**Option B: AWS CLI**
```bash
aws lambda publish-layer-version \
  --layer-name reportlab-layer \
  --zip-file fileb://reportlab-layer.zip \
  --compatible-runtimes python3.11 \
  --region eu-north-1
```

### Step 3: Package Lambda Function Code

```bash
./scripts/package-lambda.sh
```

This creates `lambda-deployment.zip` containing `lambda_function.py`.

### Step 4: Deploy Function Code

**Option A: AWS Console**
1. Go to Lambda → Functions → `daignostics-report-generator`
2. In "Code source" section, click "Upload from" → ".zip file"
3. Upload `lambda-deployment.zip`
4. Click "Save"

**Option B: AWS CLI**
```bash
aws lambda update-function-code \
  --function-name daignostics-report-generator \
  --zip-file fileb://lambda-deployment.zip \
  --region eu-north-1
```

### Step 5: Add Layer to Function

In AWS Lambda Console:
1. Go to your function → Layers section
2. Click "Add a layer"
3. Choose "Custom layers"
4. Select `reportlab-layer` (version 1)
5. Click "Add"

### Step 6: Configure Environment Variable

Set the API URL in your local environment:

```bash
# Create .env file (if not exists)
cp .env.template .env

# Edit .env and add your API Gateway URL:
echo "VITE_REPORT_API_URL=https://YOUR_API_ID.execute-api.eu-north-1.amazonaws.com/generate-report" > .env
```

Replace `YOUR_API_ID` with your actual API Gateway ID.

### Step 7: Test the Integration

1. Start your React app: `npm run dev`
2. Login as a doctor
3. Navigate to a patient → experiment
4. Click "📄 Generate Report"
5. PDF should download automatically

## 🧪 Testing Lambda Directly

Test JSON (via AWS Console Test):
```json
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
```

Expected response:
```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "body": "{\"success\":true,\"downloadUrl\":\"https://...\",\"s3Uri\":\"s3://...\",\"fileName\":\"report_...\",\"message\":\"Report generated successfully\"}"
}
```

## 📝 Files Created

- `misc/lambda_function.py` - Main Lambda handler (no PIL dependencies)
- `scripts/build-layer.sh` - Builds ReportLab layer with Docker
- `scripts/package-lambda.sh` - Packages Lambda function code
- `src/components/ExperimentDetails.tsx` - Updated with API integration

## ⚠️ Troubleshooting

**"Report API URL not configured"**
- Make sure `.env` file exists and contains `VITE_REPORT_API_URL`
- Restart dev server after adding `.env`

**"PIL import error" (if it occurs)**
- Use the public layer ARN as described in the previous fix
- Or rebuild layer with `./scripts/build-layer.sh`

**CORS errors**
- Ensure API Gateway has CORS enabled
- Lambda returns proper CORS headers (already configured)

**Bedrock errors**
- Check Bedrock is enabled in your AWS account
- Verify model ID in `lambda_function.py` matches available models
- Ensure IAM role has Bedrock permissions

## 🎯 Next Steps

Once deployed:
1. Test with real experiment data
2. Customize PDF styling in `generate_pdf_report()` function
3. Adjust Bedrock prompt for better analysis
4. Consider adding email delivery option
