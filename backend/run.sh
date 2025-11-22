#!/bin/bash

# Risk Console Backend Runner Script
# This script sets up and runs the Risk Console backend

set -e  # Exit on error

echo "🚀 Risk Console Backend Setup & Runner"
echo "======================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from template..."
    cp env_template.txt .env
    echo ""
    echo "✏️  Please edit .env and add your API keys:"
    echo "   - OPENAI_API_KEY"
    echo "   - ELEVENLABS_API_KEY"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install/update dependencies
echo "📥 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "✅ Dependencies installed"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p static/audio
mkdir -p logs
echo "✅ Directories created"

# Check if API keys are set
echo ""
echo "🔑 Checking configuration..."
if grep -q "your_openai_api_key_here" .env; then
    echo "⚠️  WARNING: OPENAI_API_KEY not set in .env"
fi
if grep -q "your_elevenlabs_api_key_here" .env; then
    echo "⚠️  WARNING: ELEVENLABS_API_KEY not set in .env"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Starting Risk Console Backend..."
echo "   Server will be available at: http://localhost:8000"
echo "   WebSocket endpoint: ws://localhost:8000/ws"
echo "   Health check: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the server
python main.py

