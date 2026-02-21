# ExpoIntel - B2B Expo Prospecting Dashboard

## Overview
ExpoIntel is a professional B2B expo prospecting mobile app for sales teams targeting exhibitors at trade shows. Dark slate/blue theme, production-ready.

## Tech Stack
- **Frontend**: Expo React Native (SDK 54) with expo-router, 5-tab navigation
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT email/password

## Data Model
- **users**: id, email, password_hash, name, role
- **expos**: id, name, region, industry, date
- **companies**: id, expo_id, name, hq, revenue, booth, industry, shortlist_stage, contacts[]
- **shortlists**: id, user_id, company_id, expo_id, notes
- **networks**: id, user_id, company_id, expo_id, contact_name, contact_role, status, meeting_type, scheduled_time, notes
- **expo_days**: id, user_id, expo_id, company_id, time_slot, status, meeting_type, booth, notes

## Stage Progression
prospecting → prospecting_complete → engaging → closed_won → closed_lost

## Network Status Flow
request_sent → meeting_scheduled → expo_day → completed

## Screens
1. **Home**: Expo cards grid, region/industry filters, company counts
2. **Expo Detail**: Company table with filters, shortlist buttons
3. **Shortlists**: 5-stage tab system (Prospecting | Complete | Engaging | Won | Lost)
4. **Networks**: Engagement tracking grouped by expo, status filters, scheduling
5. **Expo Day**: Timeline/agenda with check-in and follow-up flow
6. **Admin**: CSV upload with expo selector, user management

## Demo Credentials
- Admin: admin@expointel.com / admin123
- User (Sarah Mitchell): demo@expointel.com / demo123

## Seed Data
5 expos: IFA Berlin, CES Las Vegas, MWC Barcelona, Hannover Messe, GITEX Dubai
20 companies with real contacts

## API Endpoints (all /api prefixed)
- Auth: /auth/register, /auth/login, /auth/me
- Expos: /expos, /expos/:id, /expos/meta/filters
- Companies: /companies, /companies/:id, /companies/:id/stage, /companies/filters/options
- Shortlists: /shortlists, /shortlists/:id (PUT/DELETE)
- Networks: /networks, /networks/:id (PUT/DELETE)
- Expo Days: /expo-days, /expo-days/:id (PUT/DELETE)
- Admin: /admin/upload-csv, /admin/users
- Export: /export/shortlists, /export/networks, /export/expo-days
- Utility: /seed, /health

## Test Results
- Backend: 22/22 passing (100%)
- Frontend: All screens functional, all tabs working
