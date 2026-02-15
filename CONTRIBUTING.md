# Contributing to CBCT Segmentation Platform

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Docker and Docker Compose
- Git

### Setup Development Environment

1. **Fork and clone the repository:**

```bash
git clone https://github.com/arameleheni/CBCT-Viz-Platform.git
cd CBCT-Viz-Platform
```

1. **Run the setup script:**

```bash
chmod +x setup.sh
./setup.sh
```

1. **Or set up manually:**

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Frontend:**

```bash
cd frontend
npm install
```

## 🔧 Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Production hotfixes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```html
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

**Examples:**

```bash
feat(segmentation): add DHU-Net model support
fix(upload): handle large file uploads correctly
docs(readme): update deployment instructions
```

### Pull Request Process

1. **Create a feature branch:**

```bash
git checkout -b feature/your-feature-name
```

1. **Make your changes:**

- Write clean, readable code
- Follow existing code style
- Add tests for new features
- Update documentation as needed

1. **Test your changes:**

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# Docker build test
docker-compose up --build
```

1. **Commit and push:**

```bash
git add .
git commit -m "feat(component): description"
git push origin feature/your-feature-name
```

1. **Create a Pull Request:**

- Fill out the PR template completely
- Link related issues
- Request reviews from maintainers

## 📝 Code Style Guidelines

### Python (Backend)

- Follow [PEP 8](https://peps.python.org/pep-0008/)
- Use type hints
- Maximum line length: 127 characters
- Use `black` for formatting:

```bash
black backend/
```

- Use `isort` for import sorting:

```bash
isort backend/
```

### TypeScript/React (Frontend)

- Follow React best practices
- Use functional components and hooks
- Use TypeScript for type safety
- Use Prettier for formatting:

```bash
npx prettier --write "src/**/*.{ts,tsx}"
```

### Documentation

- Use clear, concise language
- Include code examples
- Update README when adding features
- Add inline comments for complex logic

## 🧪 Testing

### Backend Testing

```bash
cd backend
pytest --cov=app --cov-report=html
```

### Frontend Testing

```bash
cd frontend
npm test
npm run test:coverage
```

### Integration Testing

```bash
docker-compose up
# Run integration tests
```

## 🔍 Code Review Guidelines

### For Contributors

- Ensure CI passes before requesting review
- Respond to feedback constructively
- Keep PRs focused and reasonably sized
- Update your PR based on feedback

### For Reviewers

- Be respectful and constructive
- Test the changes locally when possible
- Check for security implications
- Verify documentation is updated

## 📊 CI/CD Pipeline

Our GitHub Actions workflows automatically:

### ✅ On Pull Requests

- Run backend and frontend tests
- Check code quality and linting
- Build Docker images
- Run security scans

### 🚀 On Merge to Main

- Build and publish Docker images
- Run full test suite
- Update documentation

### 📦 On Release Tags

- Create release artifacts
- Deploy to production (manual approval)
- Update changelog

## 🐛 Bug Reports

Use the bug report template and include:

- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error logs/screenshots

## 💡 Feature Requests

Use the feature request template and include:

- Problem statement
- Proposed solution
- Use case and benefits
- Implementation considerations

## 🔒 Security

- Do not commit secrets or credentials
- Use environment variables for configuration
- Report security vulnerabilities privately
- Follow OWASP best practices

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🤝 Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) to understand what behavior is expected and what will not be tolerated.

By participating in this project, you agree to abide by its terms.

## 📞 Contact

- **Project Advisor**: Prof. Ana Messias, University of Coimbra
- **Issues**: Use GitHub Issues
- **Discussions**: Use GitHub Discussions

## 🎓 Academic Contributions

This is an academic research project. If you use this work in research:

- Cite the project appropriately
- Acknowledge contributors
- Share improvements back with the community

## 🙏 Thank You

Your contributions help make dental education more accessible and effective!

---

## Quick Reference

### Useful Commands

```bash
# Start development
docker-compose up

# Run tests
pytest  # Backend
npm test  # Frontend

# Format code
black backend/
prettier --write frontend/src/

# Check types
mypy backend/
npx tsc --noEmit  # Frontend

# Security scan
trivy fs .

# View logs
docker-compose logs -f
```

### Workflow Status

![CI](https://github.com/aramelheni/CBCT-Viz-Platform/workflows/CI/badge.svg)
![Docker](https://github.com/aramelheni/CBCT-Viz-Platform/workflows/Docker%20Build%20and%20Publish/badge.svg)
![Code Quality](https://github.com/aramelheni/CBCT-Viz-Platform/workflows/Code%20Quality/badge.svg)
