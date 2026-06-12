# Production Schema Audit Report

## Phase E Local Release Guard Update

Updated: 12 June 2026

Status: deployed to Apps Script production deployments on 12 June 2026.

- `getSchemaAudit` remains read-only by default.
- Schema repair remains blocked unless Script Property `SCHEMA_REPAIR_APPROVED=true`.
- Release checklist added at `docs/phase-e-production-release-guard.md`.
- Apps Script backend was pushed with `clasp push --force`, versioned as `38`, and redeployed to the existing production deployment URLs.
- Current Phase E local verification:
  - `npm.cmd run test` passed 78 tests.
  - `npm.cmd run build` passed.
  - `npm.cmd run lint` passed.

วันที่อัปเดต: 12 มิถุนายน 2569

## สถานะล่าสุด

ระบบ production กลับมาใช้งานได้ปกติแล้วหลังแก้ปัญหา Vercel deployment และปรับ Environment Variables `VITE_API_URL` ให้ชี้ไปยัง Apps Script Web App deployment ล่าสุด

- Frontend production: `https://dcg-smart-service-2026.vercel.app`
- Frontend status: ใช้งานได้ ตรวจแล้ว HTTP `200`
- Active Apps Script Web App URL: `https://script.google.com/macros/s/AKfycbyhXXtSjtMvbeGWB4VEsFFo_zLQJ_3BGfXNpX1MByDC3EpuWCkEk-5VfCrUjODm-4jSFg/exec`
- Fallback Apps Script Web App URL in `src/config.ts`: `https://script.google.com/macros/s/AKfycbwSosmXqRi1ByBBMo5h06JkIn0Zc1x4NI9at-btDns8obmcAHuNSCwTNFUwlgpNJqiczw/exec`
- Apps Script deployment: version `38`
- API health status: ใช้งานได้ ตรวจแล้ว HTTP `200`
- หมายเหตุ: `getHealth` ควรแสดง `backendVersion` เป็น `2026-06-12-v35-session-policy`; ค่านี้เป็น label ในโค้ด ไม่ใช่เลข Apps Script deployment version `38`

## สรุปคำตอบ

ใช่ ตอนนี้โค้ด schema guard ตรงกับตาราง production ปัจจุบันแล้ว

รายงาน mismatch เดิมเป็นข้อมูลเก่า ก่อน commit `fix(backend): align CRITICAL_SCHEMA_HEADERS with actual production database`

## ตารางที่ตรวจเทียบ

### 1. Master_Users

ชีทจริง:

```json
["UserID", "Email", "FullName", "Role", "Status"]
```

โค้ดปัจจุบันคาดหวัง:

```json
["UserID", "Email", "FullName", "Role", "Status"]
```

ผล: ตรงกัน

### 2. Master_Departments

ชีทจริง:

```json
["DeptID", "DeptName", "Building", "Floor", "RouteGroup", "BudgetOwner"]
```

โค้ดปัจจุบันคาดหวัง:

```json
["DeptID", "DeptName", "Building", "Floor", "RouteGroup", "BudgetOwner"]
```

ผล: ตรงกัน

### 3. Master_Services

ชีทจริง:

```json
["ServiceID", "ServiceName", "Description"]
```

โค้ดปัจจุบันคาดหวัง:

```json
["ServiceID", "ServiceName", "Description"]
```

ผล: ตรงกัน

### 4. Feedback_Reports

ชีทจริง:

```json
["Timestamp", "StaffEmail", "FeedbackType", "Severity", "Description"]
```

โค้ดปัจจุบันคาดหวัง:

```json
["Timestamp", "StaffEmail", "FeedbackType", "Severity", "Description"]
```

ผล: ตรงกัน

## Safety Guard

Phase 8 schema guard เป็น read-only โดยค่าเริ่มต้น

- `getSchemaAudit` อ่าน header เพื่อตรวจ schema เท่านั้น
- ไม่สร้างชีท
- ไม่แก้ header
- ไม่ลบ column
- self-healing ของ `Master_Users` ถูก block เป็นค่าเริ่มต้น
- ถ้าต้องการให้ระบบซ่อม schema จริง ต้องตั้ง Script Property `SCHEMA_REPAIR_APPROVED=true` ก่อน

## Verification ล่าสุด

- Vercel production ตอบ HTTP `200`
- Apps Script Web App v35 URL ตอบ HTTP `200`
- `src/config.ts` fallback `API_URL` ชี้ deployment v35 แล้ว
- `backend.gs` `CRITICAL_SCHEMA_HEADERS` ตรงกับ production schema ปัจจุบันแล้ว

## งานที่ยังควรทำ

หลัง deploy v38 แล้ว `BACKEND_VERSION` ใน `backend.gs` คือ `2026-06-12-v35-session-policy`; ยังควรใช้ smoke test จริงเพื่อยืนยันค่าจาก production response

## Apps Script Backend Deploy v38

- Deploy date: 12 June 2026
- `clasp push --force`: completed
- Apps Script version: `38`
- Production deployment `AKfycbyhXXtSjtMvbeGWB4VEsFFo_zLQJ_3BGfXNpX1MByDC3EpuWCkEk-5VfCrUjODm-4jSFg`: redeployed to `@38`
- Fallback deployment `AKfycbwSosmXqRi1ByBBMo5h06JkIn0Zc1x4NI9at-btDns8obmcAHuNSCwTNFUwlgpNJqiczw`: redeployed to `@38`
- Direct backend smoke test from PowerShell was inconclusive due `401`/remote connection errors; browser smoke test remains required before marking Phase E fully closed.
