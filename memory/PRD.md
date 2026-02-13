# Expo Intelligence App - PRD

## Overview
Expo Intelligence is a B2B mobile app for sales reps attending trade shows/expos. It helps manage exhibitor data, create shortlists, schedule meetings, and track expo day activities.

## Tech Stack
- **Frontend**: Expo React Native (SDK 54) with expo-router
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: JWT email/password
- **AI (Low Priority)**: OpenAI Whisper (voice transcription) + GPT-4o (action items) via Emergent LLM Key

## Screens
1. **Login/Register** - JWT email/password auth with demo credentials
2. **Home/Browse** - Expo selector, multi-filter exhibitor search (HQ, industry, revenue, solutions), exhibitor cards
3. **Exhibitor Profile** - Full detail view with About/People tabs, LinkedIn links, Add to Shortlist/Expo Day
4. **Shortlists** - Create/manage lists, reorder, export CSV, remove items
5. **Expo Day** - Timeline with meetings, check-in flow, visiting card upload, notes, voice notes, export
6. **Admin** - CSV upload for expos/exhibitors, user role management

## Data Models
- **Users**: id, email, password_hash, name, role
- **Expos**: id, name, date, location
- **Exhibitors**: id, expo_id, company, hq, industry, revenue, team_size, booth, linkedin, website, solutions[], people[]
- **Shortlists**: id, user_id, expo_id, name, exhibitor_ids[]
- **ExpoDays**: id, user_id, expo_id, meetings[{id, exhibitor_id, time, agenda, status, notes, visiting_card_base64, voice_note_base64, voice_transcript, action_items}]

## Demo Credentials
- Admin: admin@expointel.com / admin123
- User: demo@expointel.com / demo123

## API Endpoints
All prefixed with `/api`:
- Auth: /auth/register, /auth/login, /auth/me
- Expos: /expos (GET, POST)
- Exhibitors: /exhibitors (GET+filters), /exhibitors/:id, /exhibitors/filters/options
- Shortlists: /shortlists (GET, POST), /:id/add, /:id/remove, /:id/reorder, /:id/export, DELETE
- ExpoDays: /expodays (GET, POST), /:id/meetings (POST), /:id/meetings/:mid (PUT, DELETE), /:mid/checkin, /:mid/upload-card, /:mid/upload-voice, /:id/export
- Admin: /admin/upload-csv, /admin/users, /admin/users/:id/role
- Utility: /seed, /health

## Status
- MVP Complete - All 5 screens functional
- Backend: 25/25 tests passing
- Frontend: All screens working
- AI Features: Placeholder ready (Whisper + GPT-4o integration code present, low priority)
