# Quick Deployment Guide

## Prerequisites
1. AWS CLI installed and configured (`aws configure`)
2. Python 3.11+ with pip
3. Sufficient AWS permissions (Lambda, IAM, API Gateway, S3, Bedrock)

## Deploy in 1 Command

```bash
./scripts/deploy-lambda.sh
```

This script will:
1. ✅ Create S3 bucket `daignostics-reports`
2. ✅ Create IAM role with necessary permissions
3. ✅ Build and publish Lambda layer (reportlab)
4. ✅ Deploy Lambda function
5. ✅ Create HTTP API Gateway
6. ✅ Output API endpoint
7. ✅ Save endpoint to `.env.local`

## After Deployment

### Test the API
```bash
# The script outputs a test curl command - run it to verify
curl -X POST https://YOUR_API_ID.execute-api.eu-north-1.amazonaws.com/generate-report \
  -H 'Content-Type: application/json' \
  -d '{"doctorUsername":"drjones","patientName":"Test Patient","measurements":{...}}'
```

### Expected Response
```json
{
  "success": true,
  "downloadUrl": "https://s3-presigned-url...",
  "s3Uri": "s3://daignostics-reports/test_reports/report_Test_Patient_20260120.pdf"
}
```

### Use in React App
The API endpoint is automatically saved to `.env.local`. Just access it via:
```typescript
const apiUrl = import.meta.env.VITE_REPORT_API_URL;
```

## Troubleshooting

**Permission Denied**
```bash
chmod +x scripts/deploy-lambda.sh
```

**AWS CLI not configured**
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

**Bedrock not available**
- Enable Bedrock in your AWS console
- Check model availability in your region
- Adjust `BEDROCK_MODEL_ID` in the Lambda code if needed

**Need to redeploy**
```bash
./scripts/deploy-lambda.sh  # Script is idempotent
```

## Clean Up (Optional)
```bash
# Delete API Gateway
aws apigatewayv2 delete-api --api-id YOUR_API_ID --region eu-north-1

# Delete Lambda
aws lambda delete-function --function-name daignostics-report-generator --region eu-north-1

# Delete S3 bucket (remove contents first)
aws s3 rm s3://daignostics-reports --recursive
aws s3 rb s3://daignostics-reports
```
