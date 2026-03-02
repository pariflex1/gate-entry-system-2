# Gate Entry System — Deployment Guide

## Architecture Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Guard PWA       │     │  Admin Portal     │     │  Backend API     │
│  (React + Vite)  │     │  (React + Vite)   │     │  (Node + Express)│
│  Port: 5173      │────▶│  Port: 5174       │────▶│  Port: 5000      │
│                  │     │                   │     │                  │
│  Vercel/Netlify  │     │  Vercel/Netlify   │     │  Railway/Render  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                         │
                                                    ┌────▼────┐
                                                    │InsForge │
                                                    │(DB + S3)│
                                                    └─────────┘
```

## 1. Prerequisites

- Node.js 18+  
- npm 9+  
- InsForge account with project set up  
- Email SMTP credentials (Gmail App Password recommended)


## 2. Environment Variables

Copy `server/.env.example` to `server/.env` and fill in:

| Variable | Description |
|---|---|
| `INSFORGE_URL` | Your InsForge project URL |
| `INSFORGE_SERVICE_KEY` | InsForge service/admin key |
| `JWT_SECRET` | Random 32+ char string for JWT signing |
| `EMAIL_HOST` | SMTP host (e.g., smtp.gmail.com) |
| `EMAIL_PORT` | SMTP port (587 for TLS) |
| `EMAIL_USER` | SMTP username/email |
| `EMAIL_PASS` | SMTP password (use App Password for Gmail) |
| `SUPERADMIN_EMAIL` | Super admin notification email |
| `SUPERADMIN_WHATSAPP` | Super admin WhatsApp (with country code) |
| `CLIENT_URL` | Frontend URL for email links |
| `PORT` | Server port (default: 5000) |


## 3. Local Development

```bash
# Install backend dependencies
npm install

# Start backend server (with auto-reload)
npm run dev

# In a new terminal — start Guard PWA
cd client && npm install && npm run dev

# In a new terminal — start Admin Portal
cd admin && npm install && npm run dev
```

- **Guard PWA**: http://localhost:5173
- **Admin Portal**: http://localhost:5174
- **Backend API**: http://localhost:5000


## 4. Deploy Backend (Railway)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select this repo
4. Add environment variables in Railway dashboard
5. Railway will auto-detect `railway.toml` and use `node server/index.js`
6. Note the deployed URL (e.g., `https://gate-entry-api.up.railway.app`)


## 5. Deploy Guard PWA (Vercel)

1. In Vercel, import the `client/` directory
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variable:
   - `VITE_API_URL` = your Railway backend URL
5. Configure custom domain: `*.jhansiproperty.com` (wildcard for multi-tenancy)
6. Update `client/src/services/api.js` baseURL for production:
   ```js
   baseURL: import.meta.env.VITE_API_URL || '/api'
   ```


## 6. Deploy Admin Portal (Vercel)

1. Import `admin/` directory in Vercel
2. Same build settings as Guard PWA
3. Configure domain: `admin.jhansiproperty.com`
4. Add `VITE_API_URL` environment variable


## 7. Multi-Tenancy Setup

Each society gets a subdomain:
- `societyname.jhansiproperty.com` → Guard PWA
- `admin.jhansiproperty.com` → Admin Portal

The Guard PWA extracts the slug from the subdomain automatically via `useSociety()` hook.

### DNS Configuration
- Add wildcard CNAME: `*.jhansiproperty.com` → Vercel
- Add specific CNAME: `admin.jhansiproperty.com` → Vercel (Admin)
- API: `api.jhansiproperty.com` → Railway


## 8. Testing Checklist

- [ ] Admin can register a new society
- [ ] Admin receives verification email
- [ ] Admin can log in after verification + approval
- [ ] Admin can create guards with name/mobile/PIN
- [ ] Admin can create units
- [ ] Admin can generate QR code batches
- [ ] Guard can log in with mobile + PIN
- [ ] Guard can search persons by mobile
- [ ] Guard can create IN/OUT entries
- [ ] Guard can see currently inside visitors
- [ ] Guard can log exit for visitors
- [ ] Guard can assign QR codes
- [ ] Photos are compressed to WebP < 50KB
- [ ] WhatsApp link works after entry submission
- [ ] Offline banner shows when disconnected
- [ ] Admin dashboard shows correct KPI numbers
- [ ] Admin logs show entries and guard activity
