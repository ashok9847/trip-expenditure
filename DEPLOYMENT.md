# TripSplit Deployment Guide

Complete deployment to GitHub + Vercel in 5 steps.

## Prerequisites
- Your code is ready (✓ already done)
- Supabase project is set up (✓ already done)
- GitHub account at https://github.com/ashok9847
- Vercel account (free, sign up with GitHub at https://vercel.com)

---

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: **trip-expenditure**
3. Make it **Public**
4. **Don't** check any boxes (no README, no .gitignore, no license)
5. Click **Create repository**

---

## Step 2: Push Code to GitHub

Run this in PowerShell from your project folder:

```powershell
.\deploy.ps1
```

Or manually:
```powershell
git branch -M main
git remote add origin https://github.com/ashok9847/trip-expenditure.git
git push -u origin main
```

✓ Your code is now at https://github.com/ashok9847/trip-expenditure

---

## Step 3: Deploy to Vercel

### Option A: Via Vercel Dashboard (Easiest)

1. Go to https://vercel.com/new
2. Click **Import Git Repository**
3. Select **GitHub** and find `ashok9847/trip-expenditure`
4. Configure project:
   - **Framework Preset:** Vite
   - **Root Directory:** `./`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
5. Add environment variables:
   - `VITE_SUPABASE_URL` = `https://vkxlpmadwoqdiyeeoxub.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGc...` (your anon key)
6. Click **Deploy**

### Option B: Via Vercel CLI

```powershell
npm install -g vercel
vercel login
vercel --prod
```

When prompted:
- Set up and deploy: **Y**
- Scope: (your account)
- Link to existing project: **N**
- Project name: **trip-expenditure**
- Directory: **.**
- Want to modify settings: **N**

Then add environment variables:
```powershell
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

---

## Step 4: Configure Supabase for Production

1. Go to your Supabase dashboard: https://vkxlpmadwoqdiyeeoxub.supabase.co
2. Go to **Authentication → URL Configuration**
3. Add your Vercel URL to:
   - **Site URL:** `https://trip-expenditure.vercel.app` (or your custom domain)
   - **Redirect URLs:** Add `https://trip-expenditure.vercel.app/**`

---

## Step 5: Enable Google OAuth

1. In Supabase dashboard: **Authentication → Providers → Google**
2. Toggle **Enable Google provider**
3. You'll need a Google OAuth client from https://console.cloud.google.com/apis/credentials
4. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `https://vkxlpmadwoqdiyeeoxub.supabase.co/auth/v1/callback`
     - `https://trip-expenditure.vercel.app` (your production URL)
5. Copy the Client ID and Secret to Supabase Google provider settings
6. Save

---

## Step 6: Run the Database Schema

If you haven't already:

1. In Supabase dashboard: **SQL Editor**
2. Copy all SQL from `supabase/schema.sql`
3. Click **Run**

This creates the `trips`, `expenses`, and `media` tables with Row Level Security.

---

## ✓ Done!

Your app is now live at: **https://trip-expenditure.vercel.app**

Every time you push to the `main` branch on GitHub, Vercel will automatically redeploy.

---

## Updating the App

```powershell
git add .
git commit -m "Your changes"
git push
```

Vercel deploys automatically within 30 seconds.

---

## Custom Domain (Optional)

In Vercel dashboard → Settings → Domains:
1. Add your custom domain
2. Update DNS records as shown
3. Add the custom domain to Supabase redirect URLs

---

## Troubleshooting

**"Sign in failed"**
→ Check Supabase redirect URLs include your Vercel domain

**"Network error"**
→ Check environment variables are set in Vercel dashboard

**"Permission denied" when creating trip**
→ Run the schema.sql in Supabase SQL Editor

**Changes not showing**
→ Clear browser cache or open in incognito mode
