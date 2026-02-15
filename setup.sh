#!/bin/bash

# CBCT Segmentation Platform - Setup Script
# This script sets up both backend and frontend

echo "================================================"
echo "CBCT Segmentation Platform - Setup"
echo "================================================"
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Backend Setup
echo "================================================"
echo "Setting up Backend..."
echo "================================================"

cd backend

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "✓ Backend setup complete!"
echo ""

# Return to root
cd ..

# Frontend Setup
echo "================================================"
echo "Setting up Frontend..."
echo "================================================"

cd frontend

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

echo "✓ Frontend setup complete!"
echo ""

# Return to root
cd ..

# Create uploads directory
mkdir -p backend/uploads

echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "To start the application:"
echo ""
echo "Backend:"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  python main.py"
echo ""
echo "Frontend (in a new terminal):"
echo "  cd frontend"
echo "  npm start"
echo ""
echo "The application will be available at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo ""
echo "================================================"
