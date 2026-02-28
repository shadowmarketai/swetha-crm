# VoiceFlow Marketing AI - Deployment Guide

## Option 1: Railway (Recommended - 10 minutes)

### Backend (Railway)
1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Railway auto-detects `railway.json`
5. Set environment variables (copy from `.env.example`):
   - `SECRET_KEY` (generate: `openssl rand -hex 32`)
   - `DATABASE_URL` (Railway provides PostgreSQL free)
   - `OPENAI_API_KEY` (optional)
   - `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`
6. Deploy → Get URL like `https://voiceflow-xxx.up.railway.app`

### Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import GitHub repo → Set **Root Directory** to `frontend/`
3. Framework: Vite (auto-detected)
4. Environment variable: `VITE_API_URL=https://your-railway-url.up.railway.app`
5. Deploy → Get URL like `https://voiceflow.vercel.app`

---

## Option 2: Docker (Self-hosted VPS)

### Quick Start (SQLite, no GPU)
```bash
# Clone repo
git clone https://github.com/yourorg/voiceflow.git
cd voiceflow

# Configure environment
cp .env.example .env.production
nano .env.production  # Fill in your values

# Build and run
docker-compose -f docker-compose.simple.yml up -d

# Check status
docker-compose -f docker-compose.simple.yml ps
docker-compose -f docker-compose.simple.yml logs -f api
```

Access: http://your-vps-ip

### Full Stack (PostgreSQL + Redis + n8n)
```bash
cp .env.example .env
nano .env  # Fill in values, change DATABASE_URL to postgresql://...

docker-compose up -d
```

---

## Option 3: Render.com (Free Tier)

1. Create `render.yaml` in project root (already done)
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect GitHub repo
4. Deploy

---

## Environment Variables (Required)

| Variable | Description | Where to get |
|----------|-------------|--------------|
| `SECRET_KEY` | JWT signing key | `openssl rand -hex 32` |
| `DATABASE_URL` | Database connection | Railway/Render provides |
| `RAZORPAY_KEY_ID` | Payments | dashboard.razorpay.com |
| `RAZORPAY_KEY_SECRET` | Payments | dashboard.razorpay.com |
| `OPENAI_API_KEY` | AI responses | platform.openai.com |

---

## Post-Deploy Checklist

- [ ] Backend health check: `GET /health` returns `{"status": "healthy"}`
- [ ] API docs: `/docs` (Swagger UI)
- [ ] Demo login works: admin@shadowmarket.ai / admin123
- [ ] Frontend connects to backend (check Network tab)
- [ ] Razorpay test payment works
- [ ] CORS configured for your frontend domain
