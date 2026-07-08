# แผน Staging/Testing และ Production Release Runbook สำหรับ DCG Smart Service

## Summary
สร้าง release runbook เป็นเอกสารหลักของโปรเจกต์ก่อนเริ่ม staging/testing เพื่อให้ทุกครั้งที่ปล่อยระบบมี checklist เดียวกัน ใช้ลดความเสี่ยงกับผู้ใช้จริง และบังคับผ่าน local, staging, schema, rollback และ smoke test ก่อน production

---

## Step 0: Create Deployment Runbook
- ไฟล์นี้ `docs/STAGING_RELEASE_PLAN.md` เป็นเอกสารหลักของโปรเจกต์
- เนื้อหาเป็น checklist ทำตามได้ทีละขั้น ไม่ใช่แค่บทสรุป
- Phase 3.5 Split Backend ยังไม่ทำในรอบนี้
- Policy สำคัญ:
  - ห้าม deploy production ถ้า local/staging ยังไม่เขียว
  - Playwright mock ต้องใช้ network layer
  - ห้ามเปิด mock token ใน production
  - ต้องมี rollback version ก่อน production
  - ต้องตรวจ schema `SessionTokenHash` ก่อนเปิดใช้งานจริง

---

## Phase A: Local Verification

### A1. รันและบันทึกผล
```bash
npm test                    # ต้องผ่านทั้งหมด
npm run lint                # ต้องไม่มี error
npx tsc --noEmit            # TypeScript ต้องผ่าน
npm run build               # Production build ต้องสำเร็จ
npm run test:coverage       # Coverage report-only ยังไม่ enforce threshold
```

### A2. ทดสอบ localhost ด้วยมือ
- [ ] login/mock flow ต้องใช้ network mock เท่านั้น
- [ ] บันทึกงาน (run/sort/ext)
- [ ] รายงาน 1 เดือน/3 เดือน ต้องยอดตรงกัน
- [ ] department search เดิม (default)
- [ ] budget_owner search ใหม่
- [ ] export/delete ใช้ข้อมูลเต็ม ไม่ใช่เฉพาะ virtualized rows
- [ ] virtualized list scroll แล้วไม่เลื่อน/ซ้อนกัน

---

## Phase B: Staging Backend

### B1. ตั้งค่า Staging
- [ ] สร้าง Google Sheets staging แยกจาก production
- [ ] ตั้งค่า Apps Script staging ชี้ staging sheet เท่านั้น
- [ ] `clasp push` ไป staging project/deployment

### B2. ตรวจ Schema
- [ ] `Tx_OTPStore` มีคอลัมน์ `SessionTokenHash`
- [ ] `Tx_SelfServiceOTPStore` มี `SessionTokenHash` ถ้า self-service ใช้งานจริง

### B3. Smoke Test Backend
- [ ] request OTP → verify OTP → login
- [ ] save transaction (run/sort/ext)
- [ ] search report แบบ department
- [ ] search report แบบ budget_owner
- [ ] deleteLog
- [ ] archive/rollover เฉพาะ Admin หรือตรวจ log-only warning

---

## Phase C: Frontend Staging

### C1. Deploy
- [ ] Deploy frontend preview/staging โดยชี้ API ไป staging backend
- [ ] ห้ามแก้ URL มือในโค้ด ใช้ env/config เท่านั้น

### C2. ทดสอบ Full Flow
- [ ] login → บันทึก → sync → รายงาน → export
- [ ] pending/offline logs ทั้ง timestamp เก่าและใหม่
- [ ] sidebar/progress วันนี้
- [ ] virtualized list ตอน scroll
- [ ] default search mode ยังเป็น `department`

---

## Phase D: E2E Testing

### D1. รัน E2E
```bash
npm run test:e2e
```

### D2. ตรวจสอบ Mock Flow
- [ ] Mock ต้อง intercept ด้วย `page.route()` เท่านั้น ไม่พึ่ง `mock-token-123`
- [ ] login success/fail
- [ ] create transaction
- [ ] report range 1 เดือน/3 เดือน
- [ ] department search
- [ ] budget_owner search
- [ ] delete flow
- [ ] export flow ถ้ามี fixture

---

## Phase E: Pre-Production Gate

### E1. GAS Rollback Gate
- [ ] บันทึก current production `Deployment ID`
- [ ] บันทึก current production `Version`
- [ ] สร้าง candidate version ใหม่ก่อน deploy
- [ ] เตรียม rollback ผ่าน Apps Script Manage Deployments

### E2. Schema Migration Gate
- [ ] backup หรือยืนยัน production sheet ก่อนแก้ schema
- [ ] ตรวจ `Tx_OTPStore.SessionTokenHash`
- [ ] ตรวจ `Tx_SelfServiceOTPStore.SessionTokenHash` ถ้าใช้งานจริง
- [ ] ถ้า column ยังไม่มี ให้เพิ่มผ่าน schema audit/repair ก่อนเปิดใช้งาน

### E3. Security Gate
- [ ] production ไม่มี `ALLOW_MOCK_TOKEN=true`
- [ ] backend reject `mock-token-123`
- [ ] Mock Login button ไม่แสดงนอก localhost

### E4. Rollout Gate
- [ ] เลือกช่วง deploy ที่กระทบผู้ใช้น้อย
- [ ] เตรียมบัญชี Admin สำหรับ smoke test
- [ ] เตรียม rollback owner และขั้นตอนตัดสินใจ

---

## Phase F: Production Deploy

### F1. Deploy
- [ ] Deploy GAS production เป็น version ใหม่
- [ ] Deploy frontend production หลัง backend พร้อม

### F2. Production Smoke Test
- [ ] login จริง
- [ ] บันทึก/ตรวจรายการทดสอบ
- [ ] เปิดรายงานวันนี้/เดือนนี้
- [ ] ตรวจ department search
- [ ] ตรวจ budget_owner search
- [ ] ตรวจ delete/admin flow

### F3. Rollback ถ้า fail รุนแรง
- [ ] rollback GAS ไป version เดิม
- [ ] rollback frontend ไป previous deployment
- [ ] หยุด token cleanup/migration เพิ่มเติม

---

## Post-Deploy Follow-Up

### 7 วันแรก
- [ ] เฝ้าดู RBAC log-only
- [ ] ถ้าไม่มี false positive ค่อยวางแผน strict block

### 7-14 วัน หลัง session เก่าหมดอายุ
- [ ] หยุดเขียน plain text token
- [ ] อ่านเฉพาะ hash
- [ ] เคลียร์ plain token column

### Phase 3.5 Split Backend
- [ ] ทำหลังรอบนี้นิ่งแล้ว
- [ ] ต้องทดสอบบน staging isolation ก่อน production

---

## Assumptions
- ยังไม่ deploy production จนกว่า checklist ผ่านครบ
- Coverage ยังเป็น report-only ไม่ enforce threshold
- Staging ใช้ Google Sheets และ Apps Script แยกจาก production
- Phase 3.5 Split Backend แยกเป็นรอบถัดไป

---

## Rollback Notes

| สถานการณ์ | วิธีแก้ |
|-----------|--------|
| Backend bug | Redeploy Apps Script version ก่อนหน้า ผ่าน Manage Deployments |
| Frontend bug | Revert PR ใน GitHub หรือ rollback Vercel deployment |
| Data issue | ตรวจสอบ Google Sheets โดยตรง |
| Schema issue | ย้อนกลับ schema ด้วย schema audit/repair |
