#!/bin/bash

# Build a minimal Lambda layer WITHOUT PIL/Pillow
# This avoids binary compatibility issues

set -e

echo "🔨 Building minimal Lambda layer (no PIL)..."

# Create temporary directory
rm -rf lambda-layer
mkdir -p lambda-layer/python

# Install only reportlab without image support dependencies
docker run --rm \
  -v "$PWD/lambda-layer":/var/task \
  public.ecr.aws/lambda/python:3.11 \
  bash -c "pip install reportlab --no-deps -t /var/task/python/ && \
           pip install fonttools defusedxml -t /var/task/python/"

# Create zip file
cd lambda-layer
zip -r ../reportlab-layer-minimal.zip python
cd ..

echo "✅ Layer built successfully: reportlab-layer-minimal.zip"
echo "📦 Size: $(du -h reportlab-layer-minimal.zip | cut -f1)"

# Clean up
rm -rf lambda-layer

echo ""
echo "Upload this layer:"
echo "aws lambda publish-layer-version \\"
echo "  --layer-name reportlab-minimal \\"
echo "  --zip-file fileb://reportlab-layer-minimal.zip \\"
echo "  --compatible-runtimes python3.11 \\"
echo "  --region eu-north-1"
