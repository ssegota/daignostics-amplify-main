#!/bin/bash
set -e

echo "🔨 Building ReportLab Lambda Layer (No PIL)"
echo "=============================================="

# Clean up previous builds (Docker creates files as root, need sudo)
if [ -d "python" ]; then
    echo "Cleaning up previous build..."
    sudo rm -rf python
fi
rm -f reportlab-layer.zip

# Create layer directory structure
mkdir -p python

echo ""
echo "📦 Installing ReportLab with Docker (Amazon Linux)..."

# Use Docker with Amazon Linux 2 Python 3.11 (matches Lambda runtime)
docker run --rm \
  --entrypoint /bin/bash \
  -v "$PWD":/var/task \
  public.ecr.aws/lambda/python:3.11 \
  -c "pip install reportlab -t /var/task/python/ --no-cache-dir"

echo ""
echo "📦 Creating layer zip file..."
zip -r reportlab-layer.zip python > /dev/null

echo ""
echo "✅ Layer built successfully!"
echo "📦 File: reportlab-layer.zip"
echo "📊 Size: $(du -h reportlab-layer.zip | cut -f1)"

# Clean up
sudo rm -rf python

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 UPLOAD INSTRUCTIONS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to AWS Lambda Console → Layers"
echo "2. Click 'Create layer'"
echo "3. Name: reportlab-layer"
echo "4. Upload: reportlab-layer.zip"
echo "5. Compatible runtimes: Python 3.11"
echo "6. Click 'Create'"
echo ""
echo "Or use AWS CLI:"
echo ""
echo "aws lambda publish-layer-version \\"
echo "  --layer-name reportlab-layer \\"
echo "  --zip-file fileb://reportlab-layer.zip \\"
echo "  --compatible-runtimes python3.11 \\"
echo "  --region eu-north-1"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
