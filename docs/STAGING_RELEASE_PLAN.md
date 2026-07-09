# แผน Staging/Testing และคู่มือปล่อยระบบ สำหรับ DCG Smart Service

## สถานะปัจจุบัน (9 กรกฎาคม 2569)

| Phase | สถานะ | วันที่ผ่าน |
|-------|--------|------------|
| Phase A: Local/CI Verification | ✅ PASS | 9 กรกฎาคม 2569 |
| Phase B: Staging Backend | ✅ PASS | 9 กรกฎาคม 2569 |
| Phase C: Frontend Preview Staging | ✅ PASS | 9 กรกฎาคม 2569 |
| Phase D: Manual Smoke Test หลัก | ✅ PASS | 9 กรกฎาคม 2569 |
| Phase E: Pre-Production Gate | ⏳ ขั้นตอนถัดไป | - |
| Phase F: Production Deploy | ⏳ รอ Phase E | - |

---

## ภาพรวม
สร้างคู่มือปล่อยระบบเป็นเอกสารหลักของโปรเจกต์ก่อนเริ่ม staging/testing เพื่อให้ทุกครั้งที่ปล่อยระบบมีรายการตรวจสอบเดียวกัน ใช้ลดความเสี่ยงกับผู้ใช้จริง และบังคับผ่านเครื่องทดสอบในเครื่อง, staging, schema, ย้อนกลับเวอร์ชัน และทดสอบเบื้องต้น ก่อนปล่อยระบบจริง

---

## ขั้นที่ 0: สร้างคู่มือการปล่อยระบบ
- ไฟล์นี้ `docs/STAGING_RELEASE_PLAN.md` เป็นเอกสารหลักของโปรเจกต์
- เนื้อหาเป็นรายการตรวจสอบ ทำตามได้ทีละขั้น ไม่ใช่แค่บทสรุป
- Phase 3.5 Split Backend ยังไม่ทำในรอบนี้
- นโยบายสำคัญ:
  - ห้ามปล่อยระบบจริงถ้าเครื่องทดสอบในเครื่อง/staging ยังไม่เขียว
  - Playwright mock ต้องใช้ network layer
  - ห้ามเปิด mock token ในระบบจริง
  - ต้องมีเวอร์ชันย้อนกลับก่อนปล่อยระบบจริง
  - ต้องตรวจ schema `SessionTokenHash` ก่อนเปิดใช้งานจริง

---

## ขั้นที่ A: ตรวจสอบเครื่องทดสอบในเครื่อง ✅ PASS (9 กรกฎาคม 2569)

### A1. รันและบันทึกผล ✅
```bash
npm test                    # ต้องผ่านทั้งหมด
npm run lint                # ต้องไม่มี error
npx tsc --noEmit            # TypeScript ต้องผ่าน
npm run build               # การสร้างไฟล์สำหรับระบบจริงต้องสำเร็จ
npm run test:coverage       # รายงาน Coverage ยังไม่ enforce threshold
```

### A2. ทดสอบ localhost ด้วยมือ ✅
- [x] login/mock flow ต้องใช้ network mock เท่านั้น
- [x] บันทึกงาน (run/sort/ext)
- [x] รายงาน 1 เดือน/3 เดือน ต้องยอดตรงกัน
- [x] ค้นหาแบบ department เดิม (default)
- [x] ค้นหาแบบ budget_owner ใหม่
- [x] ส่งออก/ลบ ใช้ข้อมูลเต็ม ไม่ใช่เฉพาะ virtualized rows
- [x] virtualized list scroll แล้วไม่เลื่อน/ซ้อนกัน

---

## ขั้นที่ B: Staging Backend ✅ PASS (9 กรกฎาคม 2569)

### B1. ตั้งค่า Staging ✅
- [x] สร้าง Google Sheets staging แยกจากระบบจริง
- [x] ตั้งค่า Apps Script staging ชี้ staging sheet เท่านั้น
- [x] `clasp push` ไป staging project/deployment

### B2. ตรวจ Schema ✅
- [x] `Tx_OTPStore` มีคอลัมน์ `SessionTokenHash`
- [x] `Tx_SelfServiceOTPStore` มี `SessionTokenHash` ถ้า self-service ใช้งานจริง

### B3. ทดสอบ Backend (ทดสอบเบื้องต้น) ✅
- [x] request OTP → verify OTP → login
- [x] บันทึกธุรกรรม (run/sort/ext)
- [x] ค้นหารายงานแบบ department
- [x] ค้นหารายงานแบบ budget_owner
- [x] ลบรายการ (deleteLog)
- [x] archive/rollover เฉพาะ Admin หรือตรวจ log-only warning

---

## ขั้นที่ C: Frontend Staging ✅ PASS (9 กรกฎาคม 2569)

### C1. ปล่อยระบบ ✅
- [x] ปล่อย frontend preview/staging โดยชี้ API ไป staging backend
- [x] ห้ามแก้ URL มือในโค้ด ใช้ env/config เท่านั้น

### C2. ทดสอบ Full Flow ✅
- [x] login → บันทึก → sync → รายงาน → ส่งออก
- [x] pending/offline logs ทั้ง timestamp เก่าและใหม่
- [x] sidebar/progress วันนี้
- [x] virtualized list ตอน scroll
- [x] default search mode ยังเป็น `department`

---

## ขั้นที่ D: E2E Testing ✅ PASS (9 กรกฎาคม 2569)

### D1. รัน E2E ✅
```bash
npm run test:e2e
```

### D2. ตรวจสอบ Mock Flow ✅
- [x] Mock ต้อง intercept ด้วย `page.route()` เท่านั้น ไม่พึ่ง `mock-token-123`
- [x] login สำเร็จ/ล้มเหลว
- [x] สร้างธุรกรรม
- [x] รายงานช่วง 1 เดือน/3 เดือน
- [x] ค้นหาแบบ department
- [x] ค้นหาแบบ budget_owner
- [x] ลบรายการ
- [x] ส่งออกรายงานถ้ามี fixture

---

## ขั้นที่ E: ตรวจสอบก่อนปล่อยระบบจริง

### E1. ตรวจสอบการย้อนกลับ GAS
- [ ] บันทึก `Deployment ID` ปัจจุบันของระบบจริง
- [ ] บันทึก `Version` ปัจจุบันของระบบจริง
- [ ] สร้าง candidate version ใหม่ก่อนปล่อยระบบ
- [ ] เตรียมย้อนกลับผ่าน Apps Script Manage Deployments

### E2. ตรวจสอบ Schema Migration
- [ ] backup หรือยืนยัน sheet ระบบจริงก่อนแก้ schema
- [ ] ตรวจ `Tx_OTPStore.SessionTokenHash`
- [ ] ตรวจ `Tx_SelfServiceOTPStore.SessionTokenHash` ถ้าใช้งานจริง
- [ ] ถ้า column ยังไม่มี ให้เพิ่มผ่าน schema audit/repair ก่อนเปิดใช้งาน

### E3. ตรวจสอบความปลอดภัย
- [ ] ระบบจริงไม่มี `ALLOW_MOCK_TOKEN=true`
- [ ] backend reject `mock-token-123`
- [ ] ปุ่ม Mock Login ไม่แสดงนอก localhost

### E4. ตรวจสอบการเปิดใช้งาน
- [ ] เลือกช่วงปล่อยระบบที่กระทบผู้ใช้น้อย
- [ ] เตรียมบัญชี Admin สำหรับทดสอบเบื้องต้น
- [ ] เตรียมเจ้าของงานย้อนกลับและขั้นตอนตัดสินใจ

---

## ขั้นที่ F: ปล่อยระบบจริง

### F1. ปล่อยระบบ
- [ ] ปล่อย GAS ระบบจริงเป็น version ใหม่
- [ ] ปล่อย frontend ระบบจริง หลัง backend พร้อม

### F2. ทดสอบเบื้องต้นระบบจริง
- [ ] login จริง
- [ ] บันทึก/ตรวจรายการทดสอบ
- [ ] เปิดรายงานวันนี้/เดือนนี้
- [ ] ตรวจ department search
- [ ] ตรวจ budget_owner search
- [ ] ตรวจ delete/admin flow

### F3. ย้อนกลับเวอร์ชันถ้าล้มเหลวรุนแรง
- [ ] ย้อนกลับ GAS ไป version เดิม
- [ ] ย้อนกลับ frontend ไป deployment ก่อนหน้า
- [ ] หยุด token cleanup/migration เพิ่มเติม

---

## การติดตามหลังปล่อยระบบ

### 7 วันแรก
- [ ] เฝ้าดู RBAC log-only
- [ ] ถ้าไม่มี false positive ค่อยวางแผน strict block

### 7-14 วัน หลัง session เก่าหมดอายุ
- [ ] หยุดเขียน plain text token
- [ ] อ่านเฉพาะ hash
- [ ] เคลียร์ plain token column

### Phase 3.5 Split Backend
- [ ] ทำหลังรอบนี้นิ่งแล้ว
- [ ] ต้องทดสอบบน staging isolation ก่อนระบบจริง

---

## ข้อสันนิษฐาน
- ยังไม่ปล่อยระบบจริงจนกว่ารายการตรวจสอบผ่านครบ
- Coverage ยังเป็น report-only ไม่ enforce threshold
- Staging ใช้ Google Sheets และ Apps Script แยกจากระบบจริง
- Phase 3.5 Split Backend แยกเป็นรอบถัดไป

---

## บันทึกการย้อนกลับเวอร์ชัน

| สถานการณ์ | วิธีแก้ |
|-----------|--------|
| ปัญหาหลังบ้าน | Redeploy Apps Script version ก่อนหน้า ผ่าน Manage Deployments |
| ปัญหาหน้าบ้าน | Revert PR ใน GitHub หรือย้อนกลับ Vercel deployment |
| ปัญหาข้อมูล | ตรวจสอบ Google Sheets โดยตรง |
| ปัญหา schema | ย้อนกลับ schema ด้วย schema audit/repair |
