#!/bin/bash
set -e

echo "📦 Creating Lambda Deployment Package"
echo "======================================"

cd "$(dirname "$0")/.."

# Clean up previous builds
rm -f lambda-deployment.zip

echo ""
echo "📁 Packaging Lambda function code..."

# Create deployment package (just the Python file)
cd misc
zip ../lambda-deployment.zip lambda_function.py

cd ..

echo ""
echo "✅ Deployment package created successfully!"
echo "📦 File: lambda-deployment.zip"
echo "📊 Size: $(du -h lambda-deployment.zip | cut -f1)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 DEPLOYMENT INSTRUCTIONS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "OPTION 1: Deploy via AWS Console"
echo "---------------------------------"
echo "1. Go to AWS Lambda Console"
echo "2. Select your function: daignostics-report-generator"
echo "3. In 'Code source' section, click 'Upload from'"
echo "4. Select '.zip file'"
echo "5. Upload: lambda-deployment.zip"
echo "6. Click 'Save'"
echo ""
echo "OPTION 2: Deploy via AWS CLI"
echo "-----------------------------"
echo "aws lambda update-function-code \\"
echo "  --function-name daignostics-report-generator \\"
echo "  --zip-file fileb://lambda-deployment.zip \\"
echo "  --region eu-north-1"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
