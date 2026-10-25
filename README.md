# Bangla QR Generator

সুন্দর Glassmorphism UI সহ Dynamic Bangla QR Generator।  
Amount দিলে CRC অটো ক্যালকুলেট হয় এবং প্রিমিয়াম QR ডাউনলোড করা যায়।

## Features

- Google Login (Supabase Auth)
- QR স্ক্যান → প্রোফাইল অটো তৈরি
- কাস্টম Amount দিয়ে Dynamic QR
- CRC-16 অটো ক্যালকুলেট
- প্রিমিয়াম QR ডিজাইন (নাম + Amount + Branding)
- PNG ডাউনলোড
- Fully Responsive (Mobile + Desktop)
- Glassmorphism UI

## Quick Start

```bash
npm install
npm run dev
```

## Environment Variables (Vercel)

Vercel Dashboard → Project → Settings → Environment Variables:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |

Local dev-এর জন্য চাইলে `.env.local`ও ব্যবহার করতে পারো (optional)।

## Supabase Setup

1. [supabase.com](https://supabase.com) এ প্রজেক্ট তৈরি
2. **SQL Editor**-এ `supabase-schema.sql` রান করো
3. **Authentication → Providers → Google** চালু করো
4. Google Cloud Console থেকে OAuth Client বানিয়ে Client ID/Secret দাও
5. Redirect URLs:
   - `https://YOUR_REF.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback` (local)
   - `https://your-app.vercel.app/auth/callback` (production)

## Google OAuth Setup

1. [Google Cloud Console](https://console.cloud.google.com/) → Credentials → OAuth Client ID
2. Type: **Web application**
3. Authorized redirect URI:
   ```
   https://YOUR_SUPABASE_REF.supabase.co/auth/v1/callback
   ```
4. Client ID + Secret → Supabase Google Provider-এ পেস্ট

## Deploy (Vercel)

1. GitHub-এ push করো
2. Vercel → Import Repository
3. Environment Variables যোগ করো
4. Deploy

## Tech Stack

- Next.js 14 (App Router)
- Supabase (Auth + Database)
- Tailwind CSS
- html5-qrcode
- qrcode
