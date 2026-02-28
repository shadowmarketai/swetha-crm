# VoiceFlow Marketing AI - Frontend Dashboard

React dashboard for the VoiceFlow Marketing AI platform.

## 📁 Installation in Your Project

### Step 1: Extract to Your Project Folder

Extract this `frontend` folder to your VoiceFlow project:

```
D:\social eagle AI\voiceflow-marketing-ai-complete\
├── app/                    # FastAPI backend (existing)
├── frontend/               # ⬅️ PLACE THIS FOLDER HERE
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── docker-compose.yml
└── ...
```

### Step 2: Install Dependencies

```bash
cd "D:\social eagle AI\voiceflow-marketing-ai-complete\frontend"
npm install
```

### Step 3: Configure Environment

```bash
# Copy the example env file
cp .env.example .env.local

# Edit .env.local with your settings
# VITE_API_URL=http://localhost:8000
```

### Step 4: Run Development Server

```bash
npm run dev
# Opens at http://localhost:3000
```

## 🔗 Backend API Connection

The frontend is pre-configured to connect to your FastAPI backend at `http://localhost:8000`.

### API Endpoints Expected

The frontend expects these API routes (already in your backend):

| Module | Endpoints |
|--------|-----------|
| Auth | `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/me` |
| Calls | `/api/v1/calls`, `/api/v1/calls/{id}`, `/api/v1/calls/live` |
| Leads | `/api/v1/leads`, `/api/v1/leads/pipeline` |
| Assistants | `/api/v1/assistants`, `/api/v1/assistants/voices` |
| Campaigns | `/api/v1/campaigns`, `/api/v1/campaigns/{id}/start` |
| Surveys | `/api/v1/surveys`, `/api/v1/surveys/{id}/responses` |
| Tickets | `/api/v1/tickets`, `/api/v1/tickets/stats` |
| Analytics | `/api/v1/analytics/dashboard`, `/api/v1/analytics/emotions` |

## 📂 Project Structure

```
frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/           # Reusable UI components
│   │   └── common.jsx        # Spinner, Modal, Alert, Badge, etc.
│   ├── hooks/
│   │   └── index.js          # Custom hooks (useFetch, useForm, etc.)
│   ├── layouts/
│   │   └── DashboardLayout.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── VoiceCalls.jsx
│   │   ├── Leads.jsx
│   │   ├── Assistants.jsx
│   │   ├── Campaigns.jsx
│   │   ├── Surveys.jsx
│   │   ├── HelpDesk.jsx
│   │   ├── Analytics.jsx
│   │   └── Settings.jsx
│   ├── services/
│   │   └── api.js            # API client with all endpoints
│   ├── styles/
│   │   └── globals.css
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## 🎨 Features

### Pages
- **Dashboard** - KPIs, live calls, emotion charts, recent calls
- **Voice Calls** - Call list, transcripts, audio player
- **Leads** - CRM with pipeline, lead scoring
- **AI Assistants** - Create/manage voice bots, Tamil dialect support
- **Campaigns** - Auto-dialer (Preview/Power/Predictive/Progressive)
- **Surveys** - NPS/CSAT with voice capability
- **Help Desk** - Ticketing with AI emotion-based priority
- **Analytics** - Charts, dialect usage, conversions
- **Settings** - Profile, billing, integrations, API keys

### Technical
- React 18 + Vite 5
- Tailwind CSS for styling
- Recharts for visualizations
- Axios for API calls
- React Router for navigation
- Custom hooks for data fetching

## 🔧 Connecting Real Data

Replace mock data in pages with API calls:

```jsx
// Example: Dashboard.jsx
import { useState, useEffect } from 'react';
import { analyticsAPI, callsAPI } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [liveCalls, setLiveCalls] = useState([]);
  
  useEffect(() => {
    // Fetch dashboard stats
    analyticsAPI.getDashboard().then(res => setStats(res.data));
    
    // Fetch live calls
    callsAPI.getLiveCalls().then(res => setLiveCalls(res.data));
  }, []);
  
  // ... rest of component
}
```

## 🚀 Production Build

```bash
# Build for production
npm run build

# Files will be in frontend/dist/
# Deploy to your server or CDN
```

## 🐳 Docker Integration

Add to your `docker-compose.yml`:

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://backend:8000
    depends_on:
      - backend
```

Create `frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
```

## 📝 Customization

### Brand Colors
Edit `tailwind.config.js`:

```js
colors: {
  brand: {
    500: '#8b5cf6', // Change your brand color
    600: '#7c3aed',
    700: '#6d28d9',
  }
}
```

### Logo
Replace logo in `DashboardLayout.jsx`

### Add New Pages
1. Create page in `src/pages/NewPage.jsx`
2. Add route in `src/App.jsx`
3. Add nav item in `src/layouts/DashboardLayout.jsx`

---

**Shadow Market / VoiceFlow Marketing AI**
