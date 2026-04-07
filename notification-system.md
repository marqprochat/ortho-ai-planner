# Notification System Plan

## Overview
Implement a notification system where the Superadmin can send global messages to users of specific clinics, configure automations for past-due appointments and treatment expiration, and users can view and mark notifications as read in the Planner app.
Delivery Method: Polling/On-load
Automations Trigger: CRON Job
Read Control: Individual Rigorous Control

## Project Type
WEB & BACKEND

## Success Criteria
- Superadmin can broadcast messages.
- Superadmin can configure automations (active/inactive, days before/after, select clinics).
- CRON job runs daily to trigger automations.
- Users receive notifications via Polling/On-load.
- Individual rigorous read control (each user marks their notification as read).

## Tech Stack
- Frontend: UI in React / Next.js
- Backend: API in NodeJS / Express / DB in Prisma
- Tasks: node-cron

## File Structure
- `backend/prisma/schema.prisma`
- `backend/src/routes/notifications.ts`
- `backend/src/controllers/NotificationController.ts`
- `backend/src/jobs/notificationCron.ts`
- `apps/portal/app/notificacoes/page.tsx`
- `apps/planner/components/NotificationBell.tsx`

## Task Breakdown
- [ ] TASK 1: Database schema updates (Prisma) -> [database-architect]
- [ ] TASK 2: Backend API for CRUD and Mark as Read -> [backend-specialist]
- [ ] TASK 3: Backend CRON Jobs for automations -> [backend-specialist]
- [ ] TASK 4: Portal app UI for Superadmin Configuration -> [frontend-specialist]
- [ ] TASK 5: Planner app UI for Notification Bell and Listing -> [frontend-specialist]
- [ ] TASK 6: End to End test -> [test-engineer]

## Phase X Verification
- Lint: [ ]
- Security: [ ]
- Build: [ ]
