# Deployment Guide - Trip Transportation Workflow System

## Production Deployment

### Prerequisites

**System Requirements:**
- Node.js 20+ with npm
- PostgreSQL 14+ database server
- Minimum 2GB RAM, 20GB storage
- SSL certificate for HTTPS (recommended)

**External Services:**
- OpenRouteService API account and key
- Email service (optional, for notifications)

### Environment Setup

#### 1. Environment Variables
Create production environment file with secure values:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database_name
PGHOST=localhost
PGPORT=5432
PGDATABASE=transport_workflow
PGUSER=transport_user
PGPASSWORD=secure_database_password

# External APIs
OPENROUTESERVICE_API_KEY=your_openrouteservice_api_key

# Security
SESSION_SECRET=your_very_long_random_session_secret_min_32_chars
NODE_ENV=production

# Application
PORT=3000
UPLOAD_DIR=/var/uploads/transport-system
```

#### 2. Database Setup
```bash
# Create production database
createdb transport_workflow

# Create dedicated user
createuser -P transport_user

# Grant permissions
psql -d transport_workflow -c "GRANT ALL PRIVILEGES ON DATABASE transport_workflow TO transport_user;"

# Apply schema
npm run db:push
```

#### 3. File Permissions
```bash
# Create uploads directory
mkdir -p /var/uploads/transport-system
chown -R app:app /var/uploads/transport-system
chmod 755 /var/uploads/transport-system
```

### Application Deployment

#### Option 1: Direct Deployment
```bash
# Clone repository
git clone <repository-url>
cd trip-transportation-system

# Install dependencies
npm ci --only=production

# Build frontend
npm run build

# Start application
npm start
```

#### Option 2: PM2 Process Manager
```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'transport-workflow',
    script: 'server/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/transport-workflow/error.log',
    out_file: '/var/log/transport-workflow/out.log',
    log_file: '/var/log/transport-workflow/combined.log'
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Option 3: Docker Deployment
```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build frontend
RUN npm run build

# Create uploads directory
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 3000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://transport_user:password@db:5432/transport_workflow
      - OPENROUTESERVICE_API_KEY=${OPENROUTESERVICE_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
    volumes:
      - uploads:/app/uploads
    depends_on:
      - db

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=transport_workflow
      - POSTGRES_USER=transport_user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
  uploads:
```

### Reverse Proxy Configuration

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # File upload size limit
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Security Configuration

#### 1. Firewall Setup
```bash
# Allow SSH, HTTP, HTTPS
ufw allow ssh
ufw allow 80
ufw allow 443

# Allow database access (internal only)
ufw allow from 10.0.0.0/8 to any port 5432

ufw enable
```

#### 2. SSL Certificate
```bash
# Using Let's Encrypt
certbot --nginx -d yourdomain.com

# Set up auto-renewal
crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 3. Database Security
```sql
-- Revoke public access
REVOKE ALL ON SCHEMA public FROM public;

-- Create application-specific permissions
GRANT USAGE ON SCHEMA public TO transport_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO transport_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO transport_user;
```

### Monitoring and Logging

#### 1. Application Monitoring
```bash
# Install monitoring tools
npm install -g clinic

# Health check endpoint (add to routes.ts)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});
```

#### 2. Log Management
```bash
# Log rotation configuration
cat > /etc/logrotate.d/transport-workflow << EOF
/var/log/transport-workflow/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 app app
    postrotate
        pm2 reload transport-workflow
    endscript
}
EOF
```

#### 3. Database Monitoring
```sql
-- Performance monitoring queries
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public';

-- Index usage monitoring
SELECT 
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes;
```

### Backup and Recovery

#### 1. Database Backup
```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/var/backups/transport-workflow"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/transport_workflow_$DATE.sql"

mkdir -p $BACKUP_DIR

pg_dump -h localhost -U transport_user transport_workflow > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

#### 2. File Backup
```bash
#!/bin/bash
# backup-files.sh

rsync -av --delete /var/uploads/transport-system/ /var/backups/uploads/
tar -czf /var/backups/uploads_$(date +%Y%m%d).tar.gz -C /var/backups uploads/
```

#### 3. Automated Backups
```bash
# Add to crontab
0 2 * * * /usr/local/bin/backup-db.sh
0 3 * * * /usr/local/bin/backup-files.sh
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Create performance indexes
CREATE INDEX CONCURRENTLY idx_trip_requests_user_id ON trip_requests(user_id);
CREATE INDEX CONCURRENTLY idx_trip_requests_status ON trip_requests(status);
CREATE INDEX CONCURRENTLY idx_workflow_steps_request_id ON workflow_steps(trip_request_id);
CREATE INDEX CONCURRENTLY idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Enable query optimization
ANALYZE;
VACUUM ANALYZE;
```

#### 2. Application Optimization
```javascript
// Add to server configuration
const compression = require('compression');
app.use(compression());

// Enable connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Maintenance Procedures

#### 1. Regular Maintenance Tasks
```bash
#!/bin/bash
# maintenance.sh

# Update system packages
apt update && apt upgrade -y

# Clean old log files
journalctl --vacuum-time=30d

# Database maintenance
psql -d transport_workflow -c "VACUUM ANALYZE;"

# Clear temporary files
find /tmp -type f -atime +7 -delete

# Restart application
pm2 restart transport-workflow
```

#### 2. Health Checks
```bash
#!/bin/bash
# health-check.sh

# Check application status
curl -f http://localhost:3000/health || exit 1

# Check database connectivity
pg_isready -h localhost -p 5432 -U transport_user || exit 1

# Check disk space
df -h | awk '$5 > 80 {print "Disk space warning: " $0}'

echo "System healthy"
```

### Troubleshooting

#### Common Issues

**Application Won't Start:**
- Check environment variables are set correctly
- Verify database connectivity
- Check file permissions for uploads directory
- Review error logs in /var/log/transport-workflow/

**Database Connection Errors:**
- Verify PostgreSQL service status: `systemctl status postgresql`
- Check connection string format
- Verify user permissions
- Test manual connection: `psql -h host -U user -d database`

**Performance Issues:**
- Monitor resource usage: `htop`, `iotop`
- Check database query performance
- Review application logs for slow operations
- Verify adequate disk space and memory

**File Upload Issues:**
- Check upload directory permissions
- Verify disk space availability
- Review nginx client_max_body_size setting
- Check application upload limits

This deployment guide ensures a secure, scalable, and maintainable production environment for the Trip Transportation Workflow System.