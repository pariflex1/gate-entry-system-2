# Gate Entry & Visitor Management System

**Product Requirements Document — v1.0**

| Field | Value |
|---|---|
| **Version** | v1.0 |
| **Status** | Antigravity-Ready — Multi-Tenant SaaS |
| **Updated** | February 2026 |
| **Stack** | React (Vite) + Node.js (Express) + InsForge |
| **Guard App** | `entry.jhansiproperty.com` |
| **Admin Portal** | `entry.jhansiproperty.com/admin` |
| **Super Admin** | pariflex@gmail.com · WhatsApp +91 9198433007 |
| **Code Generator** | Google Antigravity + InsForge MCP |

> **v1.0 changes:** Photos → WebP < 50KB · Node.js + React stack · 3-phase Antigravity prompts · Multi-tenant multi-society SaaS · jhansiproperty.com

---

## 1. Product Overview

 Gate Entry System is a multi-tenant SaaS platform that provides visitor management for multiple housing societies — Society X, Society Y, Society Z, and any future societies. Each society gets its own isolated workspace with its own guards, residents, units, and entry logs, all running on one shared codebase and database.

Society admins self-register, go through super admin approval, then manage their society via an admin portal. Guards use a mobile PWA on a per-society subdomain. A super admin (platform owner) is notified by email and WhatsApp and manages approvals directly via the InsForge dashboard.

| Field | Value |
|---|---|
| **Platform URL** | jhansiproperty.com |
| **Guard App** | `{slug}.jhansiproperty.com` (e.g. societyx.jhansiproperty.com) |
| **Admin Portal** | jhansiproperty.com/admin |
| **Super Admin** | pariflex@gmail.com + WhatsApp +91 9198433007 |
| **Stack** | React (Vite) + Tailwind + PWA · Node.js (Express) · InsForge (PostgreSQL + S3 + JWT) |
| **Target Device** | Mid-range Android, 3 GB RAM, 4G / WiFi |
| **Offline Support** | IndexedDB + background sync |
| **Multi-tenancy** | `society_id` on all tables; JWT-scoped queries |

---

## 2. User Roles

| Role | Login Method | Access | URL |
|---|---|---|---|
| **Super Admin** | Email only (no login UI) | Approves via InsForge dashboard | pariflex@gmail.com |
| **Society Admin** | Email + Password | Own society only | jhansiproperty.com/admin |
| **Guard** | Mobile + 4-digit PIN | Own society entry form | `{slug}.jhansiproperty.com` |

### 2.1 Super Admin (pariflex@gmail.com)

- No custom dashboard — manages approvals and data directly via InsForge dashboard
- Receives **email** to pariflex@gmail.com AND **WhatsApp** to +91 9198433007 on every new signup
- Approves by setting `society_admins.status = active` in InsForge dashboard
- Rejects by setting `status = rejected`
- Suspends a society by setting `societies.status = suspended`

### 2.2 Society Admin

- Self-registers at `jhansiproperty.com/admin/register`
- Account is `pending` until super admin approves via InsForge dashboard
- Logs in with **email + password** after approval
- Manages only their own society data
- Password reset via email link (self-service)

### 2.3 Guard (Mobile PWA)

- Logs in with **mobile number + 4-digit PIN** at `{slug}.jhansiproperty.com`
- Created and managed by their society admin
- Sees only their own society's data
- No email required

---

## 3. Multi-Tenant Architecture

Every table (except `app_settings`) has a `society_id` column. JWT tokens contain the `society_id` claim. The server always reads `society_id` from the JWT — never from the client request body.

### 3.1 Society Subdomain Routing

| Society | Guard App URL |
|---|---|
| Society X | societyx.jhansiproperty.com |
| Society Y | societyy.jhansiproperty.com |
| Society Z | societyz.jhansiproperty.com |
| Any new | `{slug}.jhansiproperty.com` |

> Wildcard DNS: `*.jhansiproperty.com` → Vercel deployment. React app reads `window.location.hostname` to extract the slug and identify the society.

---

## 4. Database Schema (InsForge / PostgreSQL)

> All tables: UUID primary keys, `timestamptz` with `DEFAULT now()`. Use InsForge MCP to create tables. Every table has `society_id` for tenant isolation.

### 4.1 societies

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PRIMARY KEY |
| `name` | text | NOT NULL |
| `slug` | text | NOT NULL, UNIQUE — auto-generated from name |
| `address` | text | Nullable |
| `status` | text | CHECK IN ('pending','active','rejected','suspended'), DEFAULT 'pending' |
| `created_at` | timestamptz | DEFAULT now() |

### 4.2 society_admins

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PRIMARY KEY |
| `society_id` | uuid | NOT NULL, FK → societies.id |
| `name` | text | NOT NULL |
| `email` | text | NOT NULL, UNIQUE — login credential |
| `password_hash` | text | NOT NULL — bcrypt, never plain text |
| `mobile` | text | NOT NULL — WhatsApp contact |
| `email_verified` | boolean | DEFAULT false |
| `status` | text | CHECK IN ('pending','active','rejected','suspended'), DEFAULT 'pending' |
| `approved_by` | text | Nullable — email of approver |
| `approved_at` | timestamptz | Nullable |
| `created_at` | timestamptz | DEFAULT now() |

> ⚠️ `password_hash` is always bcrypt. Never store or log plain passwords. Reset via email link only.

### 4.3 known_persons

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PRIMARY KEY |
| `society_id` | uuid | NOT NULL, FK → societies.id — tenant isolation |
| `name` | text | NOT NULL |
| `mobile` | text | NOT NULL — UNIQUE(society_id, mobile). Same mobile OK in different societies. |
| `unit` | text | Nullable |
| `qr_code` | text | Nullable — FK → qr_codes.qr_code |
| `qr_status` | text | CHECK IN ('active','inactive'), DEFAULT 'inactive' |
| `person_photo_url` | text | Nullable — InsForge S3 signed URL. WebP format < 50KB. |
| `created_at` | timestamptz | DEFAULT now() |

### 4.4 person_vehicles

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PRIMARY KEY |
| `society_id` | uuid | NOT NULL, FK → societies.id |
| `person_id` | uuid | NOT NULL, FK → known_persons.id ON DELETE CASCADE |
| `vehicle_number` | text | NOT NULL — UNIQUE(society_id, vehicle_number) |
| `vehicle_photo_url` | text | Nullable — InsForge S3 signed URL. WebP format < 50KB. |
| `created_at` | timestamptz | DEFAULT now() |

**Vehicle Number Format:** `AA-00-AA-0000` (e.g. `MH-12-AB-1234`)

- Regex: `^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$`
- Auto-format as guard types: lowercase → uppercase; hyphens at positions 3, 6, 9
- DB `CHECK` constraint enforces format server-side
- UNIQUE per society — same plate can exist in different societies

**Duplicate vehicle number response:**

| Scenario | System Response |
|---|---|
| Unique within society | Accepted — save on submit |
| Duplicate, same person | Auto-select that vehicle in dropdown. No insert. |
| Duplicate, different person | Warning: "MH-12-AB-1234 registered to [Name]. Link or cancel?" |
| Invalid format | Inline error: "Format must be AA-00-AA-0000" |

### 4.5 units

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PRIMARY KEY |
| `society_id` | uuid | NOT NULL, FK → societies.id |
| `unit_number` | text | NOT NULL — UNIQUE(society_id, unit_number) |
| `owner_name` | text | Nullable |
| `owner_mobile` | text | Nullable — WhatsApp notification target |

### 4.6 guards

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PRIMARY KEY |
| `society_id` | uuid | NOT NULL, FK → societies.id |
| `name` | text | NOT NULL |
| `mobile` | text | NOT NULL — UNIQUE(society_id, mobile) |
| `pin_hash` | text | NOT NULL — bcrypt hash of 4-digit PIN |
| `active` | boolean | DEFAULT true |
| `created_at` | timestamptz | DEFAULT now() |

### 4.7 qr_codes

| Column | Type | Constraints / Notes |
|---|---|---|
| `qr_code` | text | NOT NULL — PRIMARY KEY (qr_code, society_id) |
| `society_id` | uuid | NOT NULL, FK → societies.id |
| `assigned_person_id` | uuid | Nullable — FK → known_persons.id |
| `status` | text | CHECK IN ('free','assigned','inactive') |
| `assigned_at` | timestamptz | Nullable |

### 4.8 gate_entries

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PRIMARY KEY |
| `society_id` | uuid | NOT NULL, FK → societies.id |
| `person_id` | uuid | NOT NULL, FK → known_persons.id |
| `unit` | text | Denormalised for log readability |
| `purpose` | text | |
| `vehicle_id` | uuid | Nullable, FK → person_vehicles.id |
| `entry_type` | text | CHECK IN ('IN','OUT') |
| `entry_method` | text | CHECK IN ('QR','MOBILE') |
| `entry_time` | timestamptz | DEFAULT now() |
| `guard_id` | uuid | FK → guards.id |
| `synced_at` | timestamptz | Nullable — set when offline entry is synced |

### 4.9 guard_activity

| Column | Type | Constraints / Notes |
|---|---|---|
| `id` | uuid | PRIMARY KEY |
| `society_id` | uuid | NOT NULL, FK → societies.id |
| `guard_id` | uuid | FK → guards.id |
| `action` | text | LOGIN \| ENTRY_IN \| ENTRY_OUT \| ASSIGN_QR \| DEACTIVATE_QR |
| `detail` | text | Person name + mobile, QR code, or vehicle number |
| `created_at` | timestamptz | DEFAULT now() |

### 4.10 app_settings

| Key | Default | Description |
|---|---|---|
| `superadmin_email` | pariflex@gmail.com | Receives new signup notifications |
| `superadmin_whatsapp` | 919198433007 | WhatsApp for new signup notifications |
| `photo_max_kb` | 50 | Max photo size in KB (WebP format) |
| `photo_format` | webp | Output format for all photos |
| `approval_required` | true | Set false to auto-activate after email verification |
| `default_alert_mobile` | 9198433007 | Fallback WhatsApp for visitor notifications |

---

## 5. Uniqueness & Duplicate Prevention

### 5.1 Mobile Number (known_persons)

- DB: `UNIQUE(society_id, mobile)` — same mobile OK in different societies
- Client: on blur after 10 digits, query within society scope
- Match → autofill form. No match → new-person mode.
- Submit: `INSERT … ON CONFLICT (society_id, mobile) DO UPDATE`

### 5.2 Vehicle Number (person_vehicles)

- DB: `UNIQUE(society_id, vehicle_number)` + `CHECK` constraint for format
- Auto-format: uppercase + hyphens while typing
- Duplicate check on blur (scoped to society)
- See response table in Section 4.4

### 5.3 Guard Mobile

- DB: `UNIQUE(society_id, mobile)` on guards
- Admin panel: duplicate check before create

### 5.4 Admin Email

- DB: global `UNIQUE` on `society_admins.email`
- Registration: check before insert

---

## 6. Photo Specification

> **All person and vehicle photos must be WebP format, under 50KB.**

### 6.1 Client-Side Compression (React Guard App)

```js
// Using browser-image-compression
import imageCompression from 'browser-image-compression';

const compressed = await imageCompression(file, {
  fileType: 'image/webp',
  maxSizeMB: 0.05,          // 50KB
  maxWidthOrHeight: 1024,
  useWebWorker: true
});
// Upload compressed WebP blob to POST /api/upload/person/:id
```

### 6.2 Server-Side Conversion (Node.js)

```js
// npm install sharp
const sharp = require('sharp');

// Convert any incoming image to WebP < 50KB
const webpBuffer = await sharp(buffer)
  .webp({ quality: 80 })
  .resize({ width: 1024, withoutEnlargement: true })
  .toBuffer();

await db.storage.from('gate-photos')
  .upload(path, webpBuffer, { contentType: 'image/webp' });
```

### 6.3 Storage Paths (InsForge S3 — Private Bucket)

```
Bucket: gate-photos (PRIVATE)

{society_id}/persons/{person_id}/person.webp
{society_id}/persons/{person_id}/vehicles/{vehicle_id}.webp
```

- Bucket is **private** — never public
- Display via **signed URLs** with 1-hour expiry
- Reuse stored URL on repeat visits
- Guard can tap **Update Photo** to retake

### 6.4 Settings

| Setting | Value |
|---|---|
| Format | WebP |
| Max size | 50KB (configurable via `app_settings.photo_max_kb`) |
| Max dimension | 1024px on longest side |
| Quality | 80% WebP quality |

---

## 7. Admin Signup & Approval Flow

### 7.1 Registration (`jhansiproperty.com/admin/register`)

| Field | Validation |
|---|---|
| Society Name | Required. Min 3 chars. Slug auto-generated and previewed. |
| Society Address | Optional |
| Your Name | Required |
| Email | Required. UNIQUE. Valid format. |
| Password | Min 8 chars, at least one number |
| Confirm Password | Must match |
| Mobile | 10-digit Indian mobile |

**On submit:**
1. Insert `societies` (status = pending)
2. Insert `society_admins` (status = pending, email_verified = false)
3. Send email verification link to admin

### 7.2 Email Verification

Admin clicks link → `email_verified = true` → system sends:

**Email to pariflex@gmail.com:**
```
Subject: [] New Society Signup — Approval Required

Society: Green Park Society
Admin:   Ramesh Kumar (ramesh@email.com)
Mobile:  9876543210
Action:  InsForge dashboard → society_admins → set status = active
```

**WhatsApp to +91 9198433007:**
```
New Signup - 
Society: Green Park Society
Admin: Ramesh Kumar
Email: ramesh@email.com
Mobile: 9876543210
Approve: InsForge dashboard → society_admins → status = active
```

### 7.3 Approval (via InsForge Dashboard)

| Action | How |
|---|---|
| Approve | InsForge → `society_admins` → `status = active` |
| Reject | InsForge → `society_admins` → `status = rejected` |
| Suspend later | InsForge → `societies` → `status = suspended` |

> App checks `status` on every admin login — no webhook needed. Change takes effect on next login attempt.

### 7.4 Admin Login (`entry.jhansiproperty.com/admin/login`)

- Email + password → check `status = active` AND `email_verified = true`
- JWT issued: `{ role: 'admin', admin_id, society_id, exp: now+8h }`
- `pending` → "Your account is awaiting approval"
- `rejected` → "Your registration was rejected"
- `suspended` → "Your account has been suspended"

### 7.5 Password Reset

1. Admin clicks "Forgot Password"
2. Enters email → system sends reset link (expires 1 hour)
3. Clicks link → enters new password → bcrypt hash saved
4. All existing sessions invalidated

---

## 8. Guard App — Screens

> Guard app URL: `entry.jhansiproperty.com`. App reads subdomain to identify society. All queries scoped to that `society_id`.

### 8.1 Login

| Element | Behaviour |
|---|---|
| Mobile | 10-digit number |
| PIN | 4-digit masked input |
| Submit | Validate against `guards` WHERE `society_id` from subdomain |
| Session | 12 hours |
| Lockout | 5 failures → 10-minute lockout |

### 8.2 Entry Screen (Main)

**Visitor Search:**

| Method | Action | Response |
|---|---|---|
| Mobile | Types 10 digits | Match → autofill + vehicle dropdown. No match → new-person mode. |
| QR Scan | Scans barcode | Match → autofill. Free QR → assign flow. Unknown → error. |
| QR Manual | Types code | Same as scan. |

**Entry Form Fields:**

| Field | Input Type | Behaviour |
|---|---|---|
| Mobile | Text (10 digits) | Primary search key. UNIQUE check on blur. |
| Name | Text | Auto-filled or manual. Required. |
| Unit | Dropdown + Other | 01–207 preloaded. "Other" reveals free-text (max 20 chars). |
| Purpose | Text | Free text. Required. |
| Vehicle Number | Dropdown + Add New | From `person_vehicles`. Format AA-00-AA-0000. UNIQUE check on Add New. |
| Entry Type | Toggle IN / OUT | Default: IN. |
| Person Photo | Camera | WebP < 50KB. Thumbnail if cached. Retake option. |
| Vehicle Photo | Camera (optional) | WebP < 50KB. Optional. |
| Guard | Read-only | From session. |
| Entry Time | Read-only | Server timestamp. |

**Vehicle Dropdown:**
- Loads all `person_vehicles` for matched person, ordered by `created_at DESC`
- Each option: vehicle number + thumbnail photo
- Last option always: ➕ Add New Vehicle
- Add New: inline input with AA-00-AA-0000 auto-format + duplicate check on blur

**After Submission:**
- Buttons: **Send WhatsApp** | **New Entry**
- WhatsApp: `wa.me/91{owner_mobile}?text={message}` (fallback: `default_alert_mobile`)
- Message: `Visitor Entry Alert
Name:{n}
Unit:{u}
Purpose:{p}
Vehicle:{v}
Photo:{url}`

### 8.3 Currently Inside

- Lists all open IN entries (no matching OUT for same `person_id` since last IN)
- Columns: name, unit, vehicle number, entry time
- **Log Exit** → pre-fill OUT form → one-tap submit

### 8.4 Photo Capture

- Compress with `browser-image-compression` → WebP, maxSizeMB: 0.05
- Upload to `POST /api/upload/person/:id` or `/api/upload/vehicle/:id`
- Store signed URL (1-hour expiry) in DB
- Reuse on repeat visits. Guard taps **Update Photo** to retake.

### 8.5 QR Assign

- Enter mobile → find/create person
- Enter QR (type or scan) → validate in `qr_codes` (status = free)
- Confirm → update `qr_codes` + `known_persons`
- Deactivate option on same screen

### 8.6 Offline Mode

- All entry functionality works without connectivity
- Entries stored in IndexedDB; photos stored as Blob URLs
- Offline banner shown at top of screen
- Background sync fires on reconnect
- **Dedup:** skip if same `person_id` + `entry_time` within 60 seconds already exists
- Photo sync fail → save entry without photo URL; notify guard on next login
- Set `synced_at` on successful sync

### 8.7 Guard Navigation

| Screen | Route |
|---|---|
| Login | `/` |
| Entry | `/entry` |
| Currently Inside | `/inside` |
| Assign QR | `/assign-qr` |
| History (last 8h) | `/history` |
| Logout | Clears JWT |

---

## 9. Admin Portal — `entry.jhansiproperty.com/admin`

> All queries scoped by `society_id` from JWT. Admin sees only their own society.

### 9.1 Dashboard

- KPI cards: Entries Today, Currently Inside count, Active Guards, Free QR Codes
- Society name and slug in header

### 9.2 Persons

- Search by mobile → live results within society
- View: name, mobile, unit, QR status, all linked vehicles with thumbnails
- Assign/change unit (01–207 + Other)
- Assign/remove QR code
- Add vehicle: AA-00-AA-0000 + UNIQUE check + optional photo
- Edit vehicle number; Delete vehicle (blocked if `gate_entries` references it)
- Entry history: paginated

### 9.3 Guards

| Action | Behaviour |
|---|---|
| Create | Name + mobile (UNIQUE check) + 4-digit PIN (bcrypt server-side). WhatsApp to guard. |
| Activate/Deactivate | Toggle `active`. Takes effect immediately. |
| Reset PIN | Admin sets new PIN → bcrypt → WhatsApp to guard. |
| Delete | Only if zero rows in `guard_activity` and `gate_entries`. |

### 9.4 Units

- List / add / edit units for this society (01–207 or custom, max 20 chars)
- Set `owner_name` and `owner_mobile` for WhatsApp notifications

### 9.5 QR Inventory

- List QR codes with status badges (free / assigned / inactive)
- **Batch create:** enter start (Q1001) and end (Q1100) → all created as `status = free`
- Assign, deactivate, reassign

### 9.6 Entry Logs

- Filters: person mobile/name, unit, guard, entry type (IN/OUT), date range
- Columns: person, unit, vehicle, guard, type, method, time
- Offline-synced entries: grey **Synced** badge with `synced_at`

### 9.7 Activity Logs

- Filters: guard, action type, date range

### 9.8 Account Settings

- Update name and mobile
- Change password (requires current password)

---

## 10. Super Admin — Email + WhatsApp Notification Only

> No custom dashboard. Super admin manages everything via InsForge dashboard.

### 10.1 Contact Details

| Channel | Value |
|---|---|
| Email | pariflex@gmail.com |
| WhatsApp | +91 9198433007 |
| Approval method | InsForge dashboard → `society_admins` table |

### 10.2 InsForge Dashboard Actions

| Task | InsForge Action |
|---|---|
| Approve admin | `society_admins` → set `status = active` |
| Reject admin | `society_admins` → set `status = rejected` |
| Suspend society | `societies` → set `status = suspended` |
| Reactivate | `societies` → set `status = active` |
| View all entries | `gate_entries` → filter by `society_id` |
| Reset admin password | `society_admins` → update `password_hash` with new bcrypt hash |
| Query platform data | InsForge query runner (SQL) |

---

## 11. Technology Stack

### 11.1 Architecture Overview

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend (Guard) | React (Vite) + Tailwind + vite-plugin-pwa | Guard PWA — entry form, offline, QR, photos |
| Frontend (Admin) | React (Vite) + Tailwind | Admin portal — dashboard, persons, guards, logs |
| Backend | Node.js + Express | API server — auth, JWT, email, WhatsApp, InsForge |
| Database | InsForge (PostgreSQL) | All data — multi-tenant via society_id |
| File Storage | InsForge S3 | Person + vehicle photos (WebP < 50KB, private bucket) |
| Deployment | Vercel (frontend) + Railway (backend) | Auto-deploy from GitHub |

> React never calls InsForge directly. All InsForge access goes through the Node.js server. The InsForge service key lives **only** on the server.

### 11.2 Backend Packages (Node.js + Express)

| Package | Purpose |
|---|---|
| `express` | API framework |
| `@insforge/sdk` | InsForge database + storage (server-side only) |
| `bcrypt` | Hash guard PINs and admin passwords |
| `jsonwebtoken` | Issue and verify JWTs |
| `nodemailer` | Send email to pariflex@gmail.com |
| `axios` | WhatsApp notification to +91 9198433007 |
| `sharp` | Convert uploaded images to WebP server-side |
| `multer` | Handle multipart photo uploads |
| `dotenv` | Environment variables |
| `cors` | Allow React frontend to call API |
| `helmet` | HTTP security headers |

### 11.3 Frontend Packages (React)

| Package | Purpose |
|---|---|
| `react` + `vite` | UI framework + bundler |
| `tailwindcss` | Mobile-first styling |
| `react-router-dom` | Client-side routing |
| `vite-plugin-pwa` | Service worker, offline, installable PWA |
| `idb` | IndexedDB wrapper for offline entries |
| `html5-qrcode` | QR scanner in guard app |
| `browser-image-compression` | Compress + convert photos to WebP < 50KB |
| `axios` | HTTP client — calls Node.js API |
| `react-hook-form` | Form handling in admin portal |
| `date-fns` | Date formatting in logs |

### 11.4 Project Folder Structure

```
jhansiproperty-gate/
├── client/                       ← React (Vite)
│   └── src/
│       ├── guard/                ← Guard PWA screens
│       │   ├── Login.jsx
│       │   ├── Entry.jsx         ← Main entry form + vehicle dropdown
│       │   ├── CurrentlyInside.jsx
│       │   ├── AssignQR.jsx
│       │   └── History.jsx
│       ├── admin/                ← Society admin portal
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Persons.jsx
│       │   ├── Guards.jsx
│       │   ├── Units.jsx
│       │   ├── QRInventory.jsx
│       │   ├── EntryLogs.jsx
│       │   └── ActivityLogs.jsx
│       ├── shared/
│       │   ├── VehicleDropdown.jsx
│       │   ├── PhotoCapture.jsx
│       │   └── OfflineBanner.jsx
│       ├── hooks/
│       │   ├── useOfflineSync.js
│       │   └── useSociety.js     ← Reads subdomain → society slug
│       └── services/
│           └── api.js            ← All axios calls to Node.js API
│
├── server/                       ← Node.js + Express
│   ├── routes/
│   │   ├── auth.js               ← Guard login, admin register/login
│   │   ├── entries.js            ← Gate entries CRUD
│   │   ├── persons.js            ← Persons + vehicles
│   │   ├── admin.js              ← Admin management
│   │   └── upload.js             ← Photo upload → WebP → InsForge S3
│   ├── middleware/
│   │   └── auth.js               ← JWT verify + inject society_id
│   ├── services/
│   │   ├── insforge.js           ← InsForge SDK (service key here only)
│   │   ├── email.js              ← Nodemailer → pariflex@gmail.com
│   │   └── whatsapp.js           ← wa.me → +91 9198433007
│   └── index.js
│
├── .env                          ← INSFORGE_KEY, JWT_SECRET, email creds
└── package.json
```

### 11.5 Deployment

| What | Where | Notes |
|---|---|---|
| React frontend | Vercel | GitHub integration. Auto-deploy on push. Free tier. |
| Node.js backend | Railway | GitHub integration. Auto-deploy on push. Free tier. |
| Wildcard subdomain | Domain DNS + Vercel | Add `*.jhansiproperty.com` CNAME to Vercel URL |
| Environment vars | Vercel + Railway dashboards | Set `INSFORGE_KEY`, `JWT_SECRET`, email creds — never in code |

---

## 12. Antigravity — 3-Phase Generation Prompts

> Generate in **three separate Antigravity sessions in this order.** Do not combine — focused prompts produce cleaner code.

| Phase | What Gets Generated | When |
|---|---|---|
| **Phase 1** | Node.js + Express backend — all routes, auth, InsForge, email, WhatsApp | First. Test API before touching UI. |
| **Phase 2** | React Guard PWA — entry form, vehicle dropdown, offline, QR, photos | After Phase 1 is deployed. |
| **Phase 3** | React Admin Portal — register, login, dashboard, persons, guards, QR, logs | After Phase 2 is working. |

### Phase 1 — Backend (Node.js + Express)

```
Build a Node.js + Express REST API backend for a multi-tenant gate entry SaaS.

=== FIRST: InsForge MCP Setup ===
Use InsForge MCP 'fetch-docs' tool to read InsForge documentation.
Then use InsForge MCP to:
  - Create all database tables (schema below)
  - Create private S3 bucket named 'gate-photos'
  - Seed app_settings with default values

=== PACKAGES ===
express, @insforge/sdk, bcrypt, jsonwebtoken, nodemailer,
axios, sharp, multer, dotenv, cors, helmet

=== DATABASE SCHEMA ===
societies: id uuid PK, name text, slug text UNIQUE, address text,
           status text CHECK IN ('pending','active','rejected','suspended'),
           created_at timestamptz DEFAULT now()

society_admins: id uuid PK, society_id uuid FK→societies, name text,
  email text UNIQUE, password_hash text, mobile text,
  email_verified boolean DEFAULT false,
  status text CHECK IN ('pending','active','rejected','suspended') DEFAULT 'pending',
  approved_by text, approved_at timestamptz, created_at timestamptz DEFAULT now()

known_persons: id uuid PK, society_id uuid FK→societies, name text,
  mobile text, UNIQUE(society_id,mobile), unit text, qr_code text,
  qr_status text CHECK IN ('active','inactive') DEFAULT 'inactive',
  person_photo_url text, created_at timestamptz DEFAULT now()

person_vehicles: id uuid PK, society_id uuid FK→societies,
  person_id uuid FK→known_persons ON DELETE CASCADE,
  vehicle_number text, UNIQUE(society_id,vehicle_number),
  CHECK(vehicle_number ~ '^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$'),
  vehicle_photo_url text, created_at timestamptz DEFAULT now()

units: id uuid PK, society_id uuid FK→societies,
  unit_number text, UNIQUE(society_id,unit_number),
  owner_name text, owner_mobile text

guards: id uuid PK, society_id uuid FK→societies,
  name text, mobile text, UNIQUE(society_id,mobile),
  pin_hash text, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()

qr_codes: qr_code text, society_id uuid FK→societies,
  PRIMARY KEY(qr_code,society_id), assigned_person_id uuid,
  status text CHECK IN ('free','assigned','inactive'), assigned_at timestamptz

gate_entries: id uuid PK, society_id uuid FK→societies,
  person_id uuid FK→known_persons, unit text, purpose text,
  vehicle_id uuid nullable FK→person_vehicles,
  entry_type text CHECK IN ('IN','OUT'),
  entry_method text CHECK IN ('QR','MOBILE'),
  entry_time timestamptz DEFAULT now(),
  guard_id uuid FK→guards, synced_at timestamptz

guard_activity: id uuid PK, society_id uuid FK→societies,
  guard_id uuid FK→guards, action text, detail text,
  created_at timestamptz DEFAULT now()

app_settings: key text PK, value text
  SEED: ('superadmin_email','pariflex@gmail.com'),
        ('superadmin_whatsapp','919198433007'),
        ('photo_max_kb','50'),
        ('photo_format','webp'),
        ('approval_required','true'),
        ('default_alert_mobile','9198433007')

=== PHOTOS ===
All photos: WebP format, max 50KB.
Server-side conversion using sharp:
  const webpBuf = await sharp(buffer).webp({ quality: 80 }).resize({ width: 1024 }).toBuffer()
  Upload to InsForge S3 with contentType: 'image/webp'
Storage paths:
  {society_id}/persons/{person_id}/person.webp
  {society_id}/persons/{person_id}/vehicles/{vehicle_id}.webp
Bucket: gate-photos (PRIVATE). Generate signed URLs (3600s) for display.

=== AUTH ROUTES ===
POST /api/auth/guard-login
  Body: { mobile, pin, society_slug }
  Find society by slug → guard by mobile+society_id → bcrypt.compare
  JWT: { role:'guard', guard_id, society_id, exp:12h }
  Log LOGIN in guard_activity. 5 failures → 10-min lockout.

POST /api/auth/admin-register
  Body: { society_name, society_address, name, email, password, mobile }
  Check email unique → generate slug → bcrypt.hash(password)
  Insert societies(pending) + society_admins(pending, email_verified=false)
  Send email verification link to admin

GET /api/auth/verify-email?token=xxx
  Validate JWT (email, exp:24h) → email_verified=true
  Send email to pariflex@gmail.com:
    Subject: [] New Society Signup — Approval Required
    Body: Society name, admin name, email, mobile
          Action: InsForge dashboard → society_admins → set status=active
  Send WhatsApp to +91 9198433007:
    'New Signup - 
Society:{name}
Admin:{n}
Email:{e}
Mobile:{m}
     
Approve: InsForge dashboard → society_admins → status=active'

POST /api/auth/admin-login
  Find by email → check status=active AND email_verified=true
  pending→403 awaiting_approval | rejected→403 | suspended→403
  bcrypt.compare → JWT: { role:'admin', admin_id, society_id, exp:8h }

POST /api/auth/forgot-password → send reset link (exp:1h)
POST /api/auth/reset-password  → validate token → bcrypt.hash → update

=== AUTH MIDDLEWARE ===
Verify JWT → inject req.society_id, req.role, req.guard_id / req.admin_id
CRITICAL: NEVER read society_id from req.body — always from JWT only

=== PERSON + VEHICLE ROUTES ===
GET  /api/persons/search?mobile=xxx  → within society_id, include vehicles array
GET  /api/persons/search-qr?code=xxx → by qr_code within society_id
POST /api/persons                    → upsert ON CONFLICT (society_id, mobile)
GET  /api/persons/:id/vehicles       → ORDER BY created_at DESC
POST /api/persons/:id/vehicles       → validate format + UNIQUE, return existing if dup

=== ENTRY ROUTES (guard JWT) ===
POST /api/entries          → insert gate_entries + guard_activity log
GET  /api/entries/inside   → open IN entries, no OUT, scoped to society
GET  /api/entries/history?hours=8

=== UPLOAD ROUTES ===
POST /api/upload/person/:person_id  → sharp WebP → S3 → update DB → return signedUrl
POST /api/upload/vehicle/:vehicle_id → sharp WebP → S3 → update DB → return signedUrl

=== ADMIN ROUTES (admin JWT) ===
GET    /api/admin/dashboard
GET    /api/admin/persons (paginated)
PUT    /api/admin/persons/:id
GET/POST /api/admin/guards
PUT    /api/admin/guards/:id
PUT    /api/admin/guards/:id/reset-pin (bcrypt + WhatsApp guard)
DELETE /api/admin/guards/:id (only if zero activity)
GET/POST /api/admin/units
PUT    /api/admin/units/:id
GET    /api/admin/qr
POST   /api/admin/qr/batch
PUT    /api/admin/qr/:code
GET    /api/admin/logs/entries (filters: person, unit, guard, type, date)
GET    /api/admin/logs/activity (filters: guard, action, date)

POST /api/qr/assign  → validate QR free → update qr_codes + known_persons

=== ENV VARIABLES ===
INSFORGE_URL, INSFORGE_SERVICE_KEY, JWT_SECRET,
EMAIL_HOST, EMAIL_USER, EMAIL_PASS,
SUPERADMIN_EMAIL=pariflex@gmail.com,
SUPERADMIN_WHATSAPP=919198433007,
CLIENT_URL=https://jhansiproperty.com
```

> ⚠️ Test every route in Postman/Insomnia before starting Phase 2.

---

### Phase 2 — Guard PWA (React)

```
Build the React Guard PWA for the  gate entry system.
API base URL: https://api.jhansiproperty.com (Phase 1 Node.js backend)

=== PACKAGES ===
vite, react, tailwindcss, vite-plugin-pwa,
react-router-dom, axios, idb, html5-qrcode, browser-image-compression

=== SUBDOMAIN DETECTION ===
On load: extract slug from window.location.hostname
  e.g. 'societyx.jhansiproperty.com' → slug = 'societyx'
Pass slug to /api/auth/guard-login. Store society_id from JWT.

=== SCREENS ===

LOGIN (/)
  mobile + 4-digit PIN → POST /api/auth/guard-login
  Store JWT in localStorage. Show lockout countdown if locked.

ENTRY (/entry)
  Step 1 — Visitor identification:
    Mobile (10 digits) on blur → GET /api/persons/search?mobile=xxx
      Match → autofill name, unit, vehicle dropdown
      No match → new-person mode
    QR scan (html5-qrcode) or manual input
      → GET /api/persons/search-qr?code=xxx

  Step 2 — Vehicle dropdown:
    GET /api/persons/:id/vehicles → order by created_at DESC
    Each option: vehicle_number + thumbnail photo
    Last option: '+ Add New Vehicle'
    Add New inline:
      Auto-format: uppercase + hyphens at pos 3,6,9 as user types
      On blur: POST /api/persons/:id/vehicles
        Duplicate same person → auto-select (no insert)
        Duplicate diff person → warning toast with name
        Invalid format → inline error

  Step 3 — Form fields:
    mobile, name, unit (GET /api/admin/units + Other free-text),
    purpose, vehicle (dropdown), entry_type (IN/OUT toggle, default IN),
    person_photo (camera), vehicle_photo (camera, optional)

  Step 4 — Photo capture:
    browser-image-compression: { fileType:'image/webp', maxSizeMB:0.05, maxWidthOrHeight:1024 }
    POST /api/upload/person/:id or /api/upload/vehicle/:id
    Show WebP thumbnail. 'Update Photo' to retake.

  Step 5 — Submit: POST /api/entries
    Success: [Send WhatsApp] [New Entry]
    WhatsApp: wa.me/91{owner_mobile}?text={encoded_message}
      Fallback: default_alert_mobile from app_settings
      Message: Visitor Entry Alert
Name:{n}
Unit:{u}
Purpose:{p}
Vehicle:{v}
Photo:{url}

CURRENTLY INSIDE (/inside)
  GET /api/entries/inside
  'Log Exit' → POST /api/entries (OUT) → refresh

ASSIGN QR (/assign-qr)
  Mobile → person. QR input. POST /api/qr/assign.

HISTORY (/history)
  GET /api/entries/history?hours=8 — read-only

=== OFFLINE MODE ===
vite-plugin-pwa service worker for app caching
idb IndexedDB for offline entry storage
Orange offline banner when navigator.onLine=false
On reconnect: sync pending entries → 409 = skip (duplicate)
Photo blobs: upload → update entry URL. Set synced_at.

=== PWA MANIFEST ===
name:  Gate Entry
short_name: Gate Entry
theme_color: #1F4E8C
display: standalone
icons: 192x192 and 512x512

=== UI ===
Mobile-first. Touch targets min 44px. Font min 16px.
IN: green badge. OUT: red badge. Offline: orange banner.
Loading spinner on all API calls. Toast notifications.
```

> ⚠️ Test on a real Android phone — camera, WebP compression, and offline mode differ from desktop.

---

### Phase 3 — Admin Portal (React)

```
Build the React Admin Portal for the  gate entry system.
URL: jhansiproperty.com/admin
API base URL: https://api.jhansiproperty.com
No PWA needed — standard web dashboard.

=== PACKAGES ===
vite, react, tailwindcss, react-router-dom, axios,
react-hook-form, date-fns

All protected routes: Authorization: Bearer {jwt} header.

=== AUTH SCREENS ===

REGISTER (/admin/register)
  Fields: society_name (slug preview), society_address, name,
          email, password, confirm_password, mobile
  POST /api/auth/admin-register
  Success: 'Check your email to verify your address.'

LOGIN (/admin/login)
  email + password → POST /api/auth/admin-login
  awaiting_approval → 'Your account is awaiting super admin approval.'
  rejected → 'Your registration was rejected.'
  suspended → 'Your account has been suspended.'
  Success: store JWT, redirect /admin/dashboard

FORGOT PASSWORD + RESET PASSWORD screens

=== ADMIN SCREENS ===

DASHBOARD (/admin/dashboard)
  GET /api/admin/dashboard
  KPI cards: Entries Today, Currently Inside, Active Guards, Free QR Codes

PERSONS (/admin/persons)
  Search by mobile → view/edit person
  Assign unit/QR. Manage vehicles (add AA-00-AA-0000, edit, delete).
  Entry history paginated.

GUARDS (/admin/guards)
  List, create (bcrypt PIN), toggle active, reset PIN, delete.

UNITS (/admin/units)
  List, add, edit owner name/mobile.

QR INVENTORY (/admin/qr)
  List, batch create, assign, deactivate, reassign.

ENTRY LOGS (/admin/logs/entries)
  Filters: person, unit, guard, type, date range.
  Offline entries: grey 'Synced' badge.

ACTIVITY LOGS (/admin/logs/activity)
  Filters: guard, action, date.

ACCOUNT SETTINGS (/admin/settings)
  Update name, mobile. Change password.

=== UI ===
Sidebar navigation. Responsive — desktop/tablet optimised.
Confirm dialogs for destructive actions.
Loading skeletons on data tables.
Toast notifications. Logout → /admin/login.
```

---

## 13. Error States Reference

| Action | Success | Error / Edge Case |
|---|---|---|
| Admin registration | Row inserted; verification email sent | Duplicate email → "Email already registered" |
| Email verification | `email_verified = true`; notifications sent | Link expired → resend option |
| Admin login (pending) | — | "Your account is awaiting approval" |
| Admin login (suspended) | — | "Account suspended. Contact support." |
| Password reset | New hash saved; old sessions invalidated | Link expired → "Request new link" |
| Mobile search | Autofill + vehicle dropdown | Not found → new-person mode |
| Vehicle number (blur) | Unique + valid → accepted | Dup same person → auto-select. Dup diff → warning. Invalid → inline error. |
| QR lookup | Autofill person | Free → assign. Unknown → "QR not found, contact admin" |
| Photo upload | WebP URL saved; thumbnail shown | Fail → entry saved without photo; guard notified |
| Entry submit (online) | Row in `gate_entries` | Error → retry ×3; then save offline |
| Offline sync | Row inserted; `synced_at` set | Dup (60s window) → skip. Photo fail → save entry. |
| Guard login (lockout) | — | 5 failures → 10-min lockout |
| Society suspended | — | All logins for that society immediately rejected |

---

## 14. Security Checklist

| Requirement | Implementation |
|---|---|
| Tenant isolation | `society_id` on all tables. JWT contains claim. Server reads from token only. |
| Password + PIN storage | bcrypt always. Never plain text in DB or logs. |
| Admin auth | Email + password → JWT. Reset via email link only. |
| Storage | Private InsForge S3 bucket. Signed URLs (1-hour expiry) only. |
| Society suspension | Suspend → all JWT validation for that `society_id` fails immediately. |
| Guard brute-force | 10-min lockout after 5 failed PIN attempts. |
| Mobile uniqueness | `UNIQUE(society_id, mobile)` + client pre-check. |
| Vehicle uniqueness | `UNIQUE(society_id, vehicle_number)` + format CHECK + client pre-check. |
| Admin email | Global `UNIQUE` on `society_admins.email`. |
| InsForge service key | Never exposed to frontend. Server-side only. |

---

## 15. Performance Requirements

| Metric | Target | Context |
|---|---|---|
| Visitor lookup (mobile/QR) | < 1 second | 4G, indexed InsForge query |
| Vehicle duplicate check | < 500 ms | On blur — single indexed query |
| Entry submission | < 5 seconds | Includes WebP photo upload on 4G |
| Photo compression (WebP) | < 2 seconds | Client-side on mid-range Android |
| PWA load | < 3 seconds | After service worker cache |
| Offline entry | Immediate | IndexedDB write only |
| Admin dashboard | < 2 seconds | Cached KPI queries |

---

## 16. Acceptance Criteria

### Multi-Tenant Isolation
- Society X admin cannot see any data from Society Y or Z
- Same mobile number in two societies = two independent person records
- Suspending Society X immediately blocks all logins
- All queries include `society_id` filter — verified by code review

### Admin Auth & Approval
- Registration creates society and admin with `status = pending`
- Email verification triggers email to pariflex@gmail.com AND WhatsApp to +91 9198433007
- Super admin sets `status = active` in InsForge dashboard → admin can log in
- Pending/rejected/suspended accounts cannot log in
- Password reset works; old sessions rejected

### Photo Rules
- All photos saved as WebP format
- All photos compressed under 50KB before upload
- Photos reused on repeat visits; guard can update
- Thumbnails shown in guard app and admin panel

### Vehicle Format & Duplicates
- Vehicle input auto-formats: uppercase + hyphens
- Invalid format blocks submit with inline error
- Duplicate same person → auto-select; no duplicate row
- Duplicate different person → warning with name
- Uniqueness scoped per society

### Core Guard Flows
- Mobile search autofills in < 1 second
- IN and OUT entries recorded with correct `entry_type`
- Currently Inside view accurate; Log Exit creates correct OUT
- Offline entries stored; sync on reconnect; 60-second dedup

---

## 17. Future Scope

> Flagged to ensure current schema does not preclude these features.

- Multiple admins per society (add `role` field to `society_admins`)
- Billing / subscription per society (`plan`, `active_until` on `societies`)
- Resident portal: view visitor history, pre-register guests
- Pre-authorised visitor pass: one-time QR generated by resident
- Automated WhatsApp via Business API (removes manual guard tap)
- Society-level analytics: occupancy heatmaps, peak entry times
- Mobile app (React Native) for better camera / offline experience
