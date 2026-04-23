# Wazuh AI X - Deployment Guide

## Architecture Overview
This is a **full-stack application**:
- **Frontend**: React + Vite (deployed to Vercel)
- **Backend**: Python FastAPI (needs separate deployment)

## Step 1: Deploy Python Backend

### Using Render.com (Recommended)
1. Create account at [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Go to GitHub and authorize Render
4. Select this repository
5. Configure:
   - **Name**: `wazuh-ai-backend`
   - **Environment**: Python 3.11
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port 10000`
6. Click "Deploy"
7. **Copy the URL** (e.g., `https://wazuh-ai-backend.onrender.com`)

### Using Railway.app
1. Go to [railway.app](https://railway.app)
2. Create new project → Connect GitHub repo
3. Railway auto-detects Python apps
4. Set environment variables if needed
5. Deploy and copy URL

## Step 2: Update Frontend Configuration

After backend is deployed, create `.env.local` in project root:

```
VITE_API_URL=https://your-backend-url
```

Example:
```
VITE_API_URL=https://wazuh-ai-backend.onrender.com
```

## Step 3: Update Vercel Deployment

### Option A: Add Environment Variable (Recommended)
1. Go to [vercel.com](https://vercel.com)
2. Select your project
3. Settings → Environment Variables
4. Add: `VITE_API_URL = https://your-backend-url`
5. Redeploy (or push to trigger auto-deploy)

### Option B: Update Code
Edit `vercel.json` to add environment variables, then redeploy.

## Step 4: Test the Deployment

1. Open your Vercel URL (e.g., `wazuh-1-2g8r.vercel.app`)
2. Should see the Wazuh AI X dashboard now
3. Settings tab should work if you have API keys configured
4. AI Threat Hunter should connect to the backend

## Troubleshooting

- **Still seeing black screen?**
  - Check browser console (F12 → Console tab)
  - Look for CORS errors
  - Verify backend URL is correct in `.env`

- **Backend deployment shows errors?**
  - Check logs in Render/Railway dashboard
  - Verify `backend/main.py` has all dependencies
  - Check for missing environment variables

- **API calls failing?**
  - Ensure `VITE_API_URL` is set correctly
  - Backend must have CORS enabled (already configured in FastAPI)
  - Check network tab in browser dev tools

## Local Development

### Run Both Frontend & Backend Locally
```bash
# Terminal 1 - Start Backend
cd backend
pip install -r ../requirements.txt
uvicorn main:app --reload

# Terminal 2 - Start Frontend
npm run dev
```

Frontend will auto-proxy to localhost:8000 via vite.config.js

## Environment Variables

### Frontend (.env.local)
- `VITE_API_URL`: Backend URL (optional, defaults to localhost:8000 in dev)

### Backend (.env)
Add these when deploying:
- `WAZUH_API_URL`: Your Wazuh instance URL
- `WAZUH_API_KEY`: Your Wazuh API key
- Any other backend-specific configs

## Security Notes

1. **Never commit `.env` files** - Add to `.gitignore` ✅ (already done)
2. **Use environment variables** for sensitive data
3. **Enable CORS only for your domains** - Already configured
4. **API keys** should be set in Vercel/Render environment settings, not in code

---

**Need help?** Check the backend logs in your deployment dashboard or browser console (F12).
