#!/bin/bash

# Build Lambda layer using Docker for correct Linux binary compilation
# This ensures reportlab and its dependencies work in AWS Lambda

set -e

echo "🔨 Building Lambda layer with Docker..."

# Create temporary directory
rm -rf lambda-layer
mkdir -p lambda-layer/python

# Build using Docker with Amazon Linux 2 (matches Lambda runtime)
docker run --rm \
  -v "$PWD/lambda-layer":/var/task \
  public.ecr.aws/lambda/python:3.11 \
  bash -c "pip install reportlab Pillow -t /var/task/python/"

# Create zip file
cd lambda-layer
zip -r ../reportlab-layer.zip python
cd ..

echo "✅ Layer built successfully: reportlab-layer.zip"
echo "📦 Size: $(du -h reportlab-layer.zip | cut -f1)"

# Clean up
rm -rf lambda-layer

echo ""
echo "Next steps:"
echo "1. Upload to AWS Lambda Layer:"
echo "   aws lambda publish-layer-version \\"
echo "     --layer-name reportlab-layer \\"
echo "     --zip-file fileb://reportlab-layer.zip \\"
echo "     --compatible-runtimes python3.11 \\"
echo "     --region eu-north-1"
echo ""
echo "2. Update Lambda function to use the new layer version"
