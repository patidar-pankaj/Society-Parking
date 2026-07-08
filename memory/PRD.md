# Shiv Sampada Parking — PRD

## Original Problem Statement
Create a web app for mobile users, for a society parking. Each member can add their contact details along with vehicle detail. So that when a car is stuck behind any other member's car, they can call them and inform.

## User Choices
- Auth: Simple phone/name based (no login)
- Search: By vehicle number + browse full directory
- Call: Native phone dialer (tel: link)
- Extra field: Flat/Apartment number
- Brand: "Shiv Sampada Parking"

## Architecture
- Backend: FastAPI + MongoDB (Motor), routes under `/api/vehicles`, plate normalization for de-dup.
- Frontend: React + Tailwind + shadcn/ui, mobile-first (`max-w-md`), Swiss/brutalist theme with Manrope + IBM Plex Sans / Mono, sonner toasts.
- Ownership tracking: localStorage (`ssp_owned`) — no accounts needed.

## Implemented (Feb 2026 — iteration 1)
- CRUD API for vehicles with duplicate-plate protection (409) and case/space insensitive matching.
- `?search=` partial substring lookup on normalized plate.
- Mobile UI with 3 tabs: Search, Directory, My Cars.
- Big yellow plate-style search input, hero copy, "How it works" empty state.
- Vehicle cards with plate badge, owner, flat, giant green tel: Call button.
- Add + Edit dialog (shadcn Dialog) with validation and toast feedback.
- Delete confirmation (shadcn AlertDialog).
- "YOU" badge + Edit/Delete on cards for vehicles added by the current browser.

## Backlog / Next
- P1: Society-wide multi-tenant support (join by society code).
- P1: SMS OTP for phone verification to prevent spam entries.
- P2: Vehicle photo + make/model.
- P2: In-app messaging fallback if user cannot answer call.
- P2: Push notifications (WhatsApp/SMS) when someone tries to reach a car owner.
