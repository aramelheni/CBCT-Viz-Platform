# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of CBCT Segmentation Platform seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do Not** Open a Public Issue

Please do not open a public GitHub issue for security vulnerabilities, as this could put users at risk.

### 2. Report Privately

Send an email to the project maintainers with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Contact**: [Your email or security contact]

### 3. What to Expect

- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Assessment**: We'll assess the vulnerability and severity
- **Updates**: We'll keep you informed of progress
- **Fix**: We'll work on a fix and coordinate disclosure
- **Credit**: We'll credit you in the security advisory (unless you prefer anonymity)

## Security Best Practices

### For Developers

1. **Never commit secrets**
   - Use environment variables
   - Add `.env` to `.gitignore`
   - Use `.env.example` for templates

2. **Keep dependencies updated**
   - Review Dependabot PRs weekly
   - Run `npm audit` and `pip-audit` regularly
   - Monitor security advisories

3. **Input validation**
   - Validate all file uploads
   - Sanitize user inputs
   - Enforce file size limits

4. **API security**
   - Use CORS properly
   - Implement rate limiting
   - Validate request parameters

### For Deployment

1. **Use HTTPS/TLS**
   - Enable SSL certificates
   - Force HTTPS redirects
   - Use secure cookies

2. **Environment isolation**
   - Separate dev/staging/production
   - Use different credentials per environment
   - Restrict network access

3. **Regular updates**
   - Keep Docker images updated
   - Update base images regularly
   - Apply security patches promptly

4. **Access control**
   - Limit SSH access
   - Use strong passwords/keys
   - Enable 2FA where possible

5. **Monitoring**
   - Enable logging
   - Monitor for suspicious activity
   - Set up alerts for failures

## Security Features

### Current Implementation

- ✅ File type validation (DICOM, NIfTI only)
- ✅ File size limits (500MB maximum)
- ✅ CORS configuration
- ✅ Input sanitization
- ✅ Docker security best practices
- ✅ Automated dependency scanning
- ✅ CodeQL security analysis

### Planned Security Enhancements

- 🔄 User authentication (JWT)
- 🔄 Rate limiting per user/IP
- 🔄 Audit logging
- 🔄 Data encryption at rest
- 🔄 RBAC (Role-Based Access Control)

## Known Security Considerations

### Medical Data Handling

This platform may process medical imaging data (CBCT scans). If deploying for production use:

1. **HIPAA Compliance** (US)
   - Implement proper access controls
   - Enable audit logging
   - Encrypt data at rest and in transit
   - Sign Business Associate Agreements (BAA)

2. **GDPR Compliance** (EU)
   - Implement data anonymization
   - Provide data export functionality
   - Enable data deletion
   - Maintain consent records

3. **Data Retention**
   - Define retention policies
   - Implement automatic cleanup
   - Provide backup/restore procedures

### File Upload Security

- Maximum file size enforced (500MB)
- File type validation
- Content type verification
- Virus scanning recommended for production
- Upload folder isolation

### API Security

- CORS configured for development
- **Production**: Restrict CORS origins
- **Production**: Add authentication
- **Production**: Implement rate limiting
- **Production**: Use API keys

## Security Scanning

### Automated Scans

GitHub Actions runs security scans on:

- Every push
- Every pull request
- Weekly schedule

**Tools used:**

- Trivy (vulnerabilities)
- CodeQL (code analysis)
- Safety (Python dependencies)
- npm audit (Node dependencies)
- TruffleHog (secret detection)

### Manual Security Audit

```bash
# Run Trivy scan locally
trivy fs .

# Python dependencies
pip install safety
safety check -r backend/requirements.txt

# Node dependencies
cd frontend && npm audit

# Check for secrets
docker run --rm -it -v $(pwd):/repo trufflesecurity/trufflehog:latest filesystem /repo
```

## Incident Response

If a security incident occurs:

1. **Assess** the scope and impact
2. **Contain** the vulnerability
3. **Notify** affected users (if applicable)
4. **Patch** the vulnerability
5. **Document** the incident
6. **Review** and improve processes

## Security Checklist for Production

Before deploying to production:

- [ ] HTTPS/SSL enabled
- [ ] Environment variables secured
- [ ] Secrets not in code/containers
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Authentication implemented
- [ ] Logging enabled
- [ ] Monitoring set up
- [ ] Backups configured
- [ ] Incident response plan ready
- [ ] Security scan passed
- [ ] Dependency audit clean
- [ ] HIPAA/GDPR compliance reviewed (if applicable)

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)

---

**Last Updated**: February 15, 2026
