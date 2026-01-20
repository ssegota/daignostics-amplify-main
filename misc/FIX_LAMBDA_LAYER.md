# Fix Lambda Layer PIL Import Error

## Problem
```
Unable to import module 'lambda_function': cannot import name '_imaging' from 'PIL'
```

This happens when the Lambda layer was built on the wrong architecture (e.g., macOS/Windows) instead of Amazon Linux.

## Solutions

### ✅ Solution 1: Rebuild with Docker (Recommended)

Build the layer using Amazon Linux container:

```bash
cd /home/sbs/Documents/daignostics/daignostics-amplify-main
chmod +x scripts/build-lambda-layer.sh
./scripts/build-lambda-layer.sh
```

Then upload:
```bash
aws lambda publish-layer-version \
  --layer-name reportlab-layer \
  --zip-file fileb://reportlab-layer.zip \
  --compatible-runtimes python3.11 \
  --region eu-north-1
```

Update your Lambda function with the new layer ARN.

---

### ✅ Solution 2: Minimal Layer (No PIL)

If you don't need image support in PDFs:

```bash
chmod +x scripts/build-simple-layer.sh
./scripts/build-simple-layer.sh
```

Then upload:
```bash
aws lambda publish-layer-version \
  --layer-name reportlab-minimal \
  --zip-file fileb://reportlab-layer-minimal.zip \
  --compatible-runtimes python3.11 \
  --region eu-north-1
```

---

### ✅ Solution 3: Use Public Layer ARN

Use a pre-built layer from AWS Klayers:

```bash
# For eu-north-1 region
LAYER_ARN="arn:aws:lambda:eu-north-1:770693421928:layer:Klayers-p311-Pillow:13"

# Update your Lambda function
aws lambda update-function-configuration \
  --function-name daignostics-report-generator \
  --layers $LAYER_ARN \
  --region eu-north-1
```

Find more regions here: https://github.com/keithrozario/Klayers

---

### ✅ Solution 4: Quick Manual Fix in AWS Console

1. Go to AWS Lambda Console → Layers
2. Click "Create layer"
3. Name: `reportlab-layer`
4. Upload: Use one of the built zip files from Solution 1 or 2
5. Compatible runtimes: Python 3.11
6. Create layer
7. Go to your Lambda function → Layers → Add layer
8. Select the layer you just created

---

## Which Solution to Use?

- **Use Solution 1** if you have Docker installed and want full functionality
- **Use Solution 2** if you don't need image embedding in PDFs (fastest)
- **Use Solution 3** if you trust public layers and want instant fix
- **Use Solution 4** if you prefer GUI over CLI

## Verify Fix

After updating the layer, test again with the same JSON:

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

You should get a successful response with a download URL.
