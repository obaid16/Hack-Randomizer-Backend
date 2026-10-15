# Production Deployment Guide (Linux, PM2 & Nginx)

This guide walks you through deploying the Hackathon Team Randomizer Backend on an Ubuntu / Debian Linux server.

---

## 1. Prerequisites on Linux Server

Update system packages and install Node.js 20+ LTS, Git, and Nginx:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx

# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v
npm -v
```

Install PM2 globally:
```bash
sudo npm install -g pm2
```

---

## 2. MongoDB Installation & Setup

If using a local MongoDB instance:
```bash
# Import MongoDB public GPG key & install
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
sudo systemctl status mongod
```
*(Or use MongoDB Atlas and specify the `mongodb+srv://...` URI in `.env`)*

---

## 3. Clone and Setup Backend Project

```bash
# Create application directory
sudo mkdir -p /var/www/hackathon-backend
sudo chown -R $USER:$USER /var/www/hackathon-backend

# Clone your repository
git clone <YOUR_GIT_REPO_URL> /var/www/hackathon-backend
cd /var/www/hackathon-backend/Backend

# Install production dependencies
npm ci --only=production
```

Configure `.env`:
```bash
cp .env.example .env
nano .env
```
Ensure you set:
- `NODE_ENV=production`
- `PORT=5000`
- `HOST=127.0.0.1` (behind Nginx reverse proxy)
- `MONGODB_URI=mongodb://localhost:27017/hackathon_randomizer` (or Atlas connection string)
- `JWT_SECRET=<STRONG_RANDOM_SECRET_AT_LEAST_32_CHARACTERS>`
- `CORS_ORIGIN=https://hackathon.yourcollege.edu`
- `INITIAL_ADMIN_EMAIL=admin@yourcollege.edu`
- `INITIAL_ADMIN_PASSWORD=<STRONG_INITIAL_PASSWORD>`

Seed initial admin:
```bash
npm run seed:admin
```

---

## 4. Run with PM2 in Cluster Mode

We provide an `ecosystem.config.cjs` preconfigured for cluster mode:
```bash
# Start application via PM2
pm2 start ecosystem.config.cjs --env production

# Save PM2 process list so it restarts on system reboot
pm2 save
pm2 startup
```

Useful PM2 commands:
```bash
pm2 status
pm2 logs hackathon-randomizer-backend
pm2 restart hackathon-randomizer-backend
pm2 reload hackathon-randomizer-backend # Zero-downtime reload
```

---

## 5. Configure Nginx Reverse Proxy

Create an Nginx configuration file for the API:
```bash
sudo nano /etc/nginx/sites-available/hackathon-backend.conf
```

Add the following configuration:
```nginx
server {
    listen 80;
    server_name api.hackathon.yourcollege.edu; # Or your server's public IP / domain

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Client upload limits (match multer 5MB limit)
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}
```

Enable the configuration and test:
```bash
sudo ln -s /etc/nginx/sites-available/hackathon-backend.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Secure with SSL (Let's Encrypt Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.hackathon.yourcollege.edu
```
Certbot will automatically install the TLS certificate and configure automatic renewal.

---

## 7. Firewall (UFW) Security

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 8. Verification

Test the health check endpoint:
```bash
curl -i https://api.hackathon.yourcollege.edu/api/v1/health
```
Expected output:
```json
{
  "success": true,
  "message": "Hackathon Team Randomizer API is operational",
  "data": {
    "status": "UP",
    "timestamp": "2026-10-15T...",
    "uptimeSeconds": 120
  }
}
```
