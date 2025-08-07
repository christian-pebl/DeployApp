# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign in with GitHub (or create account)
4. Click "New Project"
5. Choose your organization
6. Set project name: "map-explorer" (or any name you prefer)
7. Set a secure database password
8. Choose a region close to you
9. Click "Create new project"

## 2. Get Your Project URLs and Keys

Once your project is created:

1. Go to **Settings** > **API** in your Supabase dashboard
2. Copy the following values:

```
Project URL: https://your-project-ref.supabase.co
anon public key: eyJ... (long key starting with eyJ)
```

## 3. Configure Google OAuth

1. In Supabase dashboard, go to **Authentication** > **Providers**
2. Find "Google" and click to configure
3. Enable Google provider
4. You'll need to set up Google OAuth credentials:

### Google Console Setup:
1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable "Google+ API"
4. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client IDs"
5. Set application type: "Web application"
6. Add authorized redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`
7. Copy the Client ID and Client Secret

### Back in Supabase:
1. Paste Google Client ID and Client Secret
2. Save the configuration

## 4. Update Environment Variables

Replace the values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

## 5. Test Authentication

After updating `.env.local`:
1. Restart your development server: `npm run dev`
2. Go to http://localhost:3050/login
3. Click "Continue with Google"
4. Complete Google OAuth flow
5. You should be redirected back to the map application
EOF < /dev/null
