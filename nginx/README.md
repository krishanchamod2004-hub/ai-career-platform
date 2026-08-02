# Nginx Configuration for AI Career Platform

This directory contains Nginx reverse proxy configurations for production deployment.

## Files

- `ai-career-web.conf` - Frontend (yourdomain.com) configuration
- `ai-career-api.conf` - API (api.yourdomain.com) configuration
- `setup-nginx.sh` - Automated Nginx installation and configuration
- `setup-ssl.sh` - SSL certificate setup with Let's Encrypt

## Quick Start

### 1. Prepare Environment Variables

Before running the setup scripts, export your domain names:

```bash
export DOMAIN="yourdomain.com"
export API_DOMAIN="api.yourdomain.com"
export EMAIL="admin@yourdomain.com"
```

### 2. Install and Configure Nginx

```bash
cd nginx
sudo bash setup-nginx.sh
```

This script will:
- Install Nginx
- Configure sites for your domains
- Setup firewall rules
- Enable and start Nginx

### 3. Setup SSL Certificates

After verifying HTTP access works, setup SSL:

```bash
cd nginx
sudo bash setup-ssl.sh
```

This script will:
- Install Certbot
- Generate Diffie-Hellman parameters
- Obtain Let's Encrypt certificates
- Configure automatic renewal
- Reload Nginx with SSL

### 4. Verify SSL

Test your SSL configuration:

```bash
# Check certificate
curl -I https://yourdomain.com

# Check API
curl https://api.yourdomain.com/api/health

# Test SSL rating
# Visit: https://www.ssllabs.com/ssltest/
```

## Manual Setup

If you prefer manual setup:

### 1. Install Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### 2. Configure Sites

```bash
# Copy configurations
sudo cp ai-career-web.conf /etc/nginx/sites-available/ai-career-web
sudo cp ai-career-api.conf /etc/nginx/sites-available/ai-career-api

# Update domain names
sudo sed -i 's/yourdomain.com/your-actual-domain.com/g' /etc/nginx/sites-available/ai-career-web
sudo sed -i 's/api.yourdomain.com/api.your-actual-domain.com/g' /etc/nginx/sites-available/ai-career-api

# Enable sites
sudo ln -s /etc/nginx/sites-available/ai-career-web /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/ai-career-api /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 3. Setup SSL with Certbot

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Generate DH parameters
sudo openssl dhparam -out /etc/nginx/dhparam.pem 2048

# Obtain certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com

# Test renewal
sudo certbot renew --dry-run
```

## Configuration Details

### Security Headers

Both configurations include:
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

### SSL/TLS

- Protocols: TLSv1.2, TLSv1.3
- Modern cipher suites
- OCSP stapling enabled
- Session caching

### Performance

- Gzip compression
- Static asset caching
- Proxy buffering optimized
- Connection keep-alive

### Logging

Logs are stored in:
- `/var/log/nginx/ai-career-web-access.log`
- `/var/log/nginx/ai-career-web-error.log`
- `/var/log/nginx/ai-career-api-access.log`
- `/var/log/nginx/ai-career-api-error.log`

## Troubleshooting

### 502 Bad Gateway

Check if Docker containers are running:
```bash
docker compose -f docker-compose.prod.yml ps
```

Check Nginx error logs:
```bash
sudo tail -f /var/log/nginx/ai-career-api-error.log
```

### SSL Certificate Issues

Check certificate status:
```bash
sudo certbot certificates
```

Renew manually:
```bash
sudo certbot renew --force-renewal
```

### Configuration Test Failed

Validate configuration:
```bash
sudo nginx -t
```

Check for syntax errors in the configuration files.

## Maintenance

### Certificate Renewal

Certificates auto-renew via systemd timer:
```bash
# Check timer status
sudo systemctl status certbot.timer

# Manual renewal
sudo certbot renew
```

### Reload Configuration

After making changes:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### View Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/ai-career-*-access.log

# Error logs
sudo tail -f /var/log/nginx/ai-career-*-error.log

# All logs
sudo tail -f /var/log/nginx/*.log
```

## Advanced Configuration

### Rate Limiting

Uncomment rate limiting in the API configuration:
```nginx
limit_req zone=api_limit burst=20 nodelay;
```

### Basic Auth for API Docs

Protect Swagger docs in production:
```bash
# Create password file
sudo htpasswd -c /etc/nginx/.htpasswd admin

# Uncomment in ai-career-api.conf
auth_basic "API Documentation";
auth_basic_user_file /etc/nginx/.htpasswd;
```

### Custom Error Pages

Add custom error pages in the server block:
```nginx
error_page 404 /404.html;
error_page 500 502 503 504 /50x.html;
```
