#!/bin/bash
set -e

echo "🔨 Building ReportLab Lambda Layer (NO PIL - using --no-deps)"
echo "=============================================================="

# Clean up previous builds (Docker creates files as root, need sudo)
if [ -d "python" ]; then
    echo "Cleaning up previous build..."
    sudo rm -rf python
fi
rm -f reportlab-layer-nodeps.zip

# Create layer directory structure
mkdir -p python

echo ""
echo "📦 Installing ReportLab with Docker (Amazon Linux) WITHOUT dependencies..."

# Use Docker with Amazon Linux 2 Python 3.11 (matches Lambda runtime)
# Use --no-deps to avoid pulling in PIL
docker run --rm \
  --entrypoint /bin/bash \
  -v "$PWD":/var/task \
  public.ecr.aws/lambda/python:3.11 \
  -c "pip install reportlab --no-deps -t /var/task/python/ --no-cache-dir"

echo ""
echo "📦 Creating layer zip file..."
zip -r reportlab-layer-nodeps.zip python > /dev/null

echo ""
echo "✅ Layer built successfully (NO PIL)!"
echo "📦 File: reportlab-layer-nodeps.zip"
echo "📊 Size: $(du -h reportlab-layer-nodeps.zip | cut -f1)"

# Clean up
sudo rm -rf python

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 UPLOADING TO AWS..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
