# CBCT Segmentation and Visualization Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![CI Status](https://github.com/arameleheni/CBCT-Viz-Platform/workflows/CI%20-%20Build%20and%20Test/badge.svg)](https://github.com/arameleheni/CBCT-Viz-Platform/actions)

Integration of Automated CBCT Segmentation for Dental Education

## Project Overview

This platform enables:

- Upload and visualize CBCT scans in 3D
- Interactive 3D navigation (rotate, pan, zoom)
- Automated segmentation of dental structures (enamel, dentin, pulp, bone)
- Individual visualization of segmented parts
- AI-based prediction of internal structures from STL files

## Architecture

- **Frontend**: React + TypeScript + Three.js (react-three-fiber)
- **Backend**: Python FastAPI + PyTorch + SimpleITK
- **Segmentation Models**: nnU-Net, DHU-Net

## Project Structure

```text
├── backend/                 # Python FastAPI server
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── models/         # AI segmentation models
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   ├── requirements.txt
│   └── main.py
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   ├── utils/          # Utilities
│   │   └── App.tsx
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Setup Instructions

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

## Docker Deployment

### Prerequisites

- Docker 20.10 or higher
- Docker Compose 2.0 or higher

### Quick Start with Docker Compose

The easiest way to run the entire platform:

```bash
# Build and start both services
docker-compose up --build

# Or run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Access the application:**

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:8000>
- API Documentation: <http://localhost:8000/docs>

### Building Individual Containers

#### Backend Container

```bash
cd backend
docker build -t cbct-backend .
docker run -p 8000:8000 -v $(pwd)/uploads:/app/uploads cbct-backend
```

#### Frontend Container

```bash
cd frontend
docker build -t cbct-frontend .
docker run -p 3000:3000 cbct-frontend
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Backend
PYTHONUNBUFFERED=1
MAX_FILE_SIZE_MB=500
MODEL_PATH=/app/models

# Frontend
REACT_APP_API_URL=http://localhost:8000
```

### Data Persistence

Upload data is persisted using Docker volumes:

```bash
# List volumes
docker volume ls

# Inspect uploads volume
docker volume inspect untitled-folder_uploads

# Backup uploads
docker run --rm -v untitled-folder_uploads:/data -v $(pwd):/backup ubuntu tar czf /backup/uploads-backup.tar.gz /data

# Restore uploads
docker run --rm -v untitled-folder_uploads:/data -v $(pwd):/backup ubuntu tar xzf /backup/uploads-backup.tar.gz -C /
```

### Docker Commands Reference

```bash
# Rebuild after code changes
docker-compose up --build

# View running containers
docker-compose ps

# Access backend shell
docker-compose exec backend bash

# Access frontend shell
docker-compose exec frontend sh

# View backend logs
docker-compose logs backend

# View frontend logs
docker-compose logs frontend

# Restart specific service
docker-compose restart backend

# Remove all containers and volumes
docker-compose down -v
```

### Memory Optimization for Docker

Add resource limits to `docker-compose.yml`:

```yaml
services:
  backend:
    mem_limit: 4g
    mem_reservation: 2g
    cpus: 2.0
```

### Troubleshooting Docker Issues

**Port already in use:**

```bash
# Find process using port 8000
lsof -ti:8000 | xargs kill -9

# Or change port in docker-compose.yml
ports:
  - "8001:8000"
```

**Permission denied on volumes:**

```bash
# Fix permissions
sudo chown -R $USER:$USER backend/uploads
```

**Container won't start:**

```bash
# Check logs
docker-compose logs backend

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

**Out of disk space:**

```bash
# Clean up Docker
docker system prune -a
docker volume prune
```

## Production Deployment

### Using Docker in Production

For production deployment, create a `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "8000:8000"
    volumes:
      - uploads:/app/uploads
      - models:/app/models
    environment:
      - PYTHONUNBUFFERED=1
      - MAX_FILE_SIZE_MB=500
      - MODEL_PATH=/app/models
    mem_limit: 4g
    cpus: 2.0

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    restart: always
    ports:
      - "80:80"
    environment:
      - REACT_APP_API_URL=https://your-api-domain.com
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend

volumes:
  uploads:
  models:
```

### Security Considerations

1. **Enable HTTPS**: Use Let's Encrypt or SSL certificates
2. **Set environment variables**: Never commit secrets to git
3. **Configure CORS**: Restrict allowed origins in production
4. **Add authentication**: Implement user authentication for uploads
5. **Rate limiting**: Add rate limiting to prevent abuse
6. **File validation**: Already implemented - max 500MB, DICOM/NIfTI only

### Performance Optimization

1. **Memory limits**: Set container memory limits (4GB backend recommended)
2. **Auto-downsampling**: Already enabled for files > 256³ voxels
3. **CDN**: Use CDN for frontend static assets
4. **Database**: Replace in-memory storage with PostgreSQL/MongoDB
5. **Caching**: Implement Redis for session/result caching

### Monitoring

```bash
# Container health
docker-compose ps

# Resource usage
docker stats

# Application logs
docker-compose logs -f --tail=100
```

### Backup Strategy

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker run --rm \
  -v untitled-folder_uploads:/data \
  -v $(pwd)/backups:/backup \
  ubuntu tar czf /backup/uploads_$DATE.tar.gz /data

# Keep last 7 days
find ./backups -name "uploads_*.tar.gz" -mtime +7 -delete
```

## Features

### Current Implementation

- ✅ CBCT file upload (DICOM, NIfTI formats)
- ✅ 3D volume rendering with adjustable windowing
- ✅ Interactive 3D controls (rotate, pan, zoom)
- ✅ Automated segmentation with deep learning
- ✅ Multi-class visualization (color-coded)
- ✅ Individual segment isolation and viewing

### Planned Features

- 🔄 STL to CBCT prediction
- 🔄 CBCT-IOS co-registration
- 🔄 Haptic simulation integration
- 🔄 Partial edentulous case handling

## Technology Stack

- **Frontend**: React 18, Three.js, react-three-fiber, TypeScript, Tailwind CSS
- **Backend**: FastAPI, PyTorch, SimpleITK, NumPy, OpenCV
- **AI Models**: nnU-Net for segmentation
- **File Formats**: DICOM, NIfTI (.nii, .nii.gz), STL
- **Deployment**: Docker, Docker Compose
- **DevOps**: Automated memory optimization, file size validation

## Usage

### Option 1: Using Docker (Recommended)

```bash
docker-compose up
```

Then open <http://localhost:3000>

### Option 2: Manual Setup

1. Start the backend server (default: <http://localhost:8000>)
2. Start the frontend development server (default: <http://localhost:3000>)

### Using the Platform

1. Upload a CBCT scan (DICOM series or NIfTI file)
   - Maximum file size: 500MB
   - Large files will be auto-downsampled to prevent crashes
2. Interact with the 3D visualization (rotate, pan, zoom)
3. Click "Segment" to perform automated segmentation
4. Toggle individual segments to view specific structures

## API Endpoints

- `POST /api/upload` - Upload CBCT scan
- `POST /api/segment` - Perform segmentation
- `GET /api/volume/{id}` - Get volume data
- `GET /api/segments/{id}` - Get segmentation results

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on how to contribute to this project.

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing. We are committed to providing a welcoming and inclusive environment for all contributors.

Co-advised by Prof. Ana Messias, Dentistry School, University of Coimbra

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment.

### Automated Workflows

#### 🔄 Continuous Integration (CI)

Runs on every push and pull request:

- **Backend Tests**: Python linting, type checking, unit tests
- **Frontend Tests**: TypeScript checking, ESLint, React tests
- **Docker Builds**: Validates both development and production Dockerfiles
- **Security Scans**: Trivy vulnerability scanning, secret detection

#### 🚀 Docker Publishing

Automatically builds and publishes Docker images:

- Triggers on pushes to `main` branch and version tags
- Publishes to GitHub Container Registry (ghcr.io)
- Multi-architecture support (amd64, arm64)
- Automated tagging: `latest`, `v1.0.0`, `main-<sha>`

#### 🔒 Code Quality

Weekly automated checks:

- **Python**: flake8, black, isort, pylint, mypy
- **TypeScript**: ESLint, Prettier, TypeScript compiler
- **Security**: Trivy, Safety (Python), npm audit
- **CodeQL**: Advanced security analysis

#### 📦 Dependency Management

- **Dependabot**: Automated weekly dependency updates
- Separate PRs for backend (pip), frontend (npm), Docker, and GitHub Actions
- Automatic security patches

### Workflow Status

![CI Status](https://github.com/aramelheni/CBCT-Viz-Platform/workflows/CI%20-%20Build%20and%20Test/badge.svg)
![Docker](https://github.com/aramelheni/CBCT-Viz-Platform/workflows/Docker%20Build%20and%20Publish/badge.svg)
![Code Quality](https://github.com/aramelheni/CBCT-Viz-Platform/workflows/Code%20Quality/badge.svg)

### Manual Deployment

Production deployment requires manual approval:

```bash
# Trigger via GitHub Actions UI
# Go to Actions → Deploy to Production → Run workflow
```

### Setting Up CI/CD

1. **Fork the repository**
2. **Enable GitHub Actions** in your repository settings
3. **Configure secrets** (if using external deployments):
   - `DEPLOY_HOST`: Your server hostname
   - `DEPLOY_USER`: SSH username
   - `DEPLOY_SSH_KEY`: SSH private key
   - `DOCKERHUB_USERNAME`: Docker Hub username (optional)
   - `DOCKERHUB_TOKEN`: Docker Hub access token (optional)

4. **Update configuration**:
   - Replace `YOUR_USERNAME` in workflow files with your GitHub username
   - Update `dependabot.yml` with your username
   - Customize deployment targets in `deploy.yml`

### Local CI Testing

Test workflows locally with [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run CI workflow
act -j backend-test
act -j frontend-test
act -j docker-build
```

## Quick Reference

### Docker Commands

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Stop everything
docker-compose down

# Rebuild after changes
docker-compose up --build

# Clean restart
docker-compose down -v && docker-compose up --build

# Check status
docker-compose ps

# View resource usage
docker stats
```

### Local Development Commands

```bash
# Backend
cd backend
source venv/bin/activate
python main.py

# Frontend
cd frontend
npm start

# Check ports
lsof -i :8000  # Backend
lsof -i :3000  # Frontend
```

### Useful URLs

- **Frontend**: <http://localhost:3000>
- **Backend API**: <http://localhost:8000>
- **API Docs (Swagger)**: <http://localhost:8000/docs>
- **API Docs (ReDoc)**: <http://localhost:8000/redoc>

### File Size Limits

- **Maximum upload**: 500MB
- **Auto-downsampling threshold**: 256³ voxels (~17M voxels)
- **Recommended volume size**: 64³-128³ voxels for smooth rendering

### Supported File Formats

- **Input**: DICOM (.dcm), NIfTI (.nii, .nii.gz)
- **Output**: 3D meshes (JSON), segmentation masks

### Memory Optimization

- Files >100MB show warning
- Files >500MB rejected
- Volumes >256³ auto-downsampled
- Default rendering: 64³ (low quality, fast)
- Available qualities: low (64³), medium (96³), high (128³)

## License

This project is licensed under the MIT License with an academic use notice - see the [LICENSE](LICENSE) file for details.

**Academic Research Project**  
Co-advised by Prof. Ana Messias, Dentistry School, University of Coimbra

**Important**: This software is intended for educational and research purposes only. It is not FDA-approved or CE-marked for clinical diagnosis or treatment.
