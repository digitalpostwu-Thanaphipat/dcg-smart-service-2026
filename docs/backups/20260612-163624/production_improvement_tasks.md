# Production Improvement Plan and Task Backlog

วันที่อัปเดต: 12 มิถุนายน 2569

## สถานะตั้งต้น

- Production frontend: `https://dcg-smart-service-2026.vercel.app`
- Active Apps Script Web App: version `35`
- Active API URL: `https://script.google.com/macros/s/AKfycbwSosmXqRi1ByBBMo5h06JkIn0Zc1x4NI9at-btDns8obmcAHuNSCwTNFUwlgpNJqiczw/exec`
- Schema guard ใน `backend.gs` ตรงกับ production sheet ปัจจุบันแล้ว
- `Tx_SelfServiceLog` ตรวจแล้วมี 21 คอลัมน์
- `BACKEND_VERSION` ใน `getHealth` ยังเป็น `2026-06-11-v31-schema-audit` เพราะเป็นค่าคงที่ในโค้ด ไม่ใช่เลข Apps Script deployment

## หลักการตัดสินใจ

- แผนงานระยะยาวเก็บในเอกสารนี้
- `docs/log.md` ใช้เป็นบันทึกสถานะและเหตุการณ์ ไม่ใช้เป็น task backlog ยาว
- ไม่ deploy backend เพื่อแก้ `BACKEND_VERSION` อย่างเดียวระหว่าง production ใช้งานจริง
- การค้นข้อมูล archive ทำได้จากหน้าเว็บเดียว แต่เป็น read/report mode เท่านั้น
- งานเขียนข้อมูลจริงต้องผ่าน backend auth ทุกครั้ง

## Skills ที่ใช้กับงานนี้

- `grill-me`: ใช้ pressure-test decision เช่น token lifetime, archive policy, rollout risk
- `caveman`: ใช้เขียนสรุปและ task ให้สั้น ชัด ไม่ปน noise
- `diagnose`: ใช้เมื่อเกิด production incident เช่น Vercel/API/Apps Script ใช้งานไม่ได้
- `review`: ใช้ตรวจ diff ก่อน deploy production
- `tdd`: ใช้กับ logic สำคัญ เช่น token expiry, archive routing, sync queue
- `playwright`: ใช้ตรวจ flow สำคัญบน browser หลังแก้ frontend
- `gws-sheets`: ใช้ตรวจ sheet/schema แบบ read-only เมื่อจำเป็น
- `handoff`: ใช้ทำเอกสารส่งต่องานหลังจบ phase ใหญ่

## Phase A: Session Policy Alignment

เป้าหมาย: ลดการขอ OTP ซ้ำของพนักงาน แต่ยังคุม write ด้วย backend auth

สถานะ local: เสร็จและตรวจผ่านแล้ว ยังไม่ push GitHub และยังไม่ deploy Apps Script

Tasks:

- [x] แยก policy ชัดเจนระหว่าง staff session และ self-service session
- [x] Staff token: เปลี่ยนจากหมดอายุสิ้นวันเป็นหมดอายุปลายวันศุกร์ของสัปดาห์เดียวกัน
- [x] Staff write: backend ยังต้องตรวจ token ทุก write ผ่าน `verifySessionToken`
- [x] Weekend guard: ยังใช้ `shouldRestrictWorkdays` เพื่อห้ามใช้งานวันเสาร์-อาทิตย์ ถ้า config เปิดไว้
- [x] Self-service token: เลือก policy สุดท้ายเป็นหมดอายุสิ้นวันสำหรับผู้ใช้หน่วยงาน
- [x] อัปเดตข้อความ OTP email/UI ให้ตรงกับอายุ session จริง
- [x] เพิ่ม tests สำหรับ staff weekly token และ self-service daily token
- [x] อัปเดต `BACKEND_VERSION` ใน backend change เดียวกันเป็น `2026-06-12-v35-session-policy`

Verification:

- `npm.cmd run test -- src/test/backend.test.ts` ผ่าน 15 tests
- `npm.cmd run test` ผ่าน 66 tests
- `npm.cmd run build` ผ่าน
- `npm.cmd run lint` ผ่าน

Acceptance:

- พนักงานขอ OTP ครั้งเดียวแล้วใช้บันทึกงานได้ถึงวันศุกร์
- ผู้ใช้หน่วยงานเห็นข้อความ session ตรงกับ policy จริง
- Token หมดอายุแล้ว write ไม่ผ่าน
- ไม่มี backend deploy เพื่อแก้ version string อย่างเดียว

Risk:

- เป็น backend deploy กระทบ production ต้องทำช่วงคนใช้น้อย
- ต้อง verify Apps Script Web App URL หลัง deploy ทุกครั้ง

## Phase B: Offline Session Caching and Sync Safety

เป้าหมาย: อินเทอร์เน็ตไม่เสถียรแล้วข้อมูลพนักงานไม่หาย และไม่บังคับขอ OTP ใหม่ทันทีถ้าแค่อ่าน cache

สถานะ local: เสร็จและตรวจผ่านแล้ว ยังไม่ push GitHub และยังไม่ deploy Apps Script

Tasks:

- [x] ระบุ state ของ sync queue ให้ชัด: `pending`, `syncing`, `synced`, `auth_required`, `failed`
- [x] ถ้า offline: บันทึกลง IndexedDB ต่อได้ และแสดง pending sync
- [x] ถ้า online แต่ token หมดอายุ: หยุด sync, เก็บ queue, แจ้งให้ OTP ใหม่ก่อนส่งขึ้น backend
- [x] หลัง login/OTP ใหม่: sync queue เดิมต่อ ไม่ลบงานค้าง
- [x] เพิ่ม UI badge: offline, pending sync, auth required, failed
- [x] เก็บสถานะ failure ฝั่ง client เมื่อ sync ล้มเหลวเพราะ auth/network ผ่าน local sync status และ toast
- [x] เพิ่ม tests ให้ `syncEngine` ไม่ logout แล้วทิ้ง queue เมื่อเจอ auth error

Verification:

- `npm.cmd run test -- src/services/syncEngine.test.ts src/test/backend.test.ts` ผ่าน 20 tests
- `npm.cmd run test` ผ่าน 71 tests
- `npm.cmd run build` ผ่าน
- `npm.cmd run lint` ผ่าน

Acceptance:

- งานที่บันทึกตอนเน็ตหลุดอยู่ในเครื่อง
- Token หมดอายุไม่ทำให้ pending logs หาย
- Re-auth แล้ว sync ต่อได้
- Read/report cache ใช้ต่อได้แบบ read-only

Risk:

- เครื่องพนักงานเป็นเครื่องส่วนตัว จึงต้องไม่ cache ข้อมูลอ่อนไหวเกินจำเป็น
- ต้องมีปุ่ม/วิธี clear local data เมื่อออกจากระบบ

## Phase C: Active Spreadsheet Rollover

เป้าหมาย: ให้ active spreadsheet เล็กและเร็ว โดยย้ายข้อมูลเก่าไป archive ทุกปีงบประมาณ

สถานะ local: เสร็จเฉพาะ dry-run/copy-only safety scaffold และตรวจผ่านแล้ว ยังไม่ push GitHub, ยังไม่ deploy Apps Script, ยังไม่ลบข้อมูล active

Tasks:

- [x] สร้าง `Archive_Index` สำหรับ mapping `fiscalYear`, `spreadsheetId`, sheet name, row count, checksum
- [x] สร้าง script dry-run ตรวจจำนวนแถวที่จะ archive ก่อนย้ายจริง
- [x] Copy-only pilot: คัดลอกข้อมูลปีเก่าไป archive spreadsheet โดยยังไม่ลบจาก active
- [x] Verify row count/checksum หลัง copy
- [x] เมื่อ pilot ผ่านแล้วค่อยเปิด deletion mode ด้วย flag เช่น `ARCHIVE_DELETE_APPROVED=true`
- [ ] ตั้งรอบ archive ทุกวันที่ 1 ตุลาคม
- [ ] ออกแบบ restore/rollback plan ก่อนลบข้อมูลจาก active

Implementation:

- เพิ่ม backend action `archiveRollover`
- `mode: "dry_run"` เป็น read-only และไม่สร้างชีต
- `mode: "copy_only"` ต้องมี `ARCHIVE_COPY_APPROVED=true` และ `ARCHIVE_SPREADSHEET_ID`
- `mode: "delete"` ถูก block หากไม่มี `ARCHIVE_DELETE_APPROVED=true` และใน local Phase C ยังไม่ implement การลบจริง
- Fiscal year ใช้ปีงบประมาณไทยจาก `Timestamp`; active fiscal year ปัจจุบันเก็บไว้ใน active sheet, rows ที่ FY ต่ำกว่า active FY ถูกนับเป็น archive candidates

Verification:

- `npm.cmd run test -- src/test/backend.test.ts` ผ่าน 19 tests
- `npm.cmd run test` ผ่าน 75 tests
- `npm.cmd run build` ผ่าน
- `npm.cmd run lint` ผ่าน

Acceptance:

- Active spreadsheet คงขนาดเป้าหมายต่ำกว่า 5,000 แถวต่อชีตงานหลักถ้าเป็นไปได้
- Archive มี row count/checksum ตรวจย้อนกลับได้
- ไม่มีการลบข้อมูล active ถ้าไม่มี approval flag

Risk:

- การลบข้อมูลผิดปีคือ high-risk ต้องทำแบบ dry-run และ backup ก่อนเสมอ

## Phase D: Cross-Year Read/Report Mode

เป้าหมาย: ค้นข้อมูลย้อนหลังข้ามปีจากหน้าเว็บเดียว

Tasks:

- [ ] เพิ่ม filter fiscal year / date range ที่รองรับหลายปี
- [ ] Backend route current year ไป active spreadsheet
- [ ] Backend route old year ไป archive spreadsheet ผ่าน `Archive_Index`
- [ ] รวมผลหลายปีใน response เดียว โดยระบุ source year/source archive
- [ ] Export/print รายงานข้ามปีได้
- [ ] Archive mode เป็น read/report only ห้ามแก้ไขข้อมูล archive จากหน้าใช้งาน
- [ ] Log event ทุกครั้งที่ค้น/export archive

Acceptance:

- ผู้ใช้ค้นข้ามปีจากหน้าเดียวได้
- Archive data แก้ไม่ได้จาก normal UI
- Export ระบุช่วงวันและปีงบประมาณชัดเจน

Risk:

- Query หลาย spreadsheet อาจช้า ต้องจำกัด date range และ paginate ถ้าข้อมูลโต

## Phase E: Schema and Production Release Guard

เป้าหมาย: ลดความเสี่ยง deploy backend/frontend แล้ว production พัง

Tasks:

- [ ] เก็บ `getSchemaAudit` เป็น read-only default
- [ ] ห้าม schema repair เว้นแต่ตั้ง `SCHEMA_REPAIR_APPROVED=true`
- [ ] ก่อน deploy backend: backup `backend.gs` และจด active deployment URL
- [ ] หลัง deploy backend: verify `getHealth`, schema audit, login, write, self-service search
- [ ] ก่อน deploy frontend: verify Vercel env `VITE_API_URL`
- [ ] หลัง deploy frontend: verify production HTTP 200 และ asset bundle เปลี่ยนจริง
- [ ] อัปเดต `docs/production_schema_audit_report.md` เมื่อมี deployment สำคัญ
- [ ] อัปเดต `docs/log.md` เฉพาะ status summary

Acceptance:

- มี checklist ก่อน/หลัง deploy ทุกครั้ง
- Rollback URL/version รู้ชัดก่อนเริ่ม deploy
- Log ไม่ขัดกับสถานะ production ปัจจุบัน

## Phase F: Relational DB Path

เป้าหมาย: เตรียมทางย้ายจาก Google Sheets เมื่อ traffic/volume โต

Tasks:

- [ ] สร้าง repository interface แยก business logic จาก storage
- [ ] ระบุ table candidates แรก: transaction logs, self-service logs, audit events
- [ ] เลือก target DB เมื่อจำเป็น: Supabase/PostgreSQL หรือ Cloud SQL PostgreSQL
- [ ] ทำ dual-write pilot เฉพาะ log ที่ไม่กระทบงานหลัก
- [ ] ทำ reconciliation report ระหว่าง Sheets และ DB

Acceptance:

- ยังไม่ย้าย DB จนกว่ามี pain จริงจาก performance/volume
- โค้ดพร้อมแยก storage โดยไม่ rewrite ทั้งระบบ

## Production Deploy Rule

ทุก backend deploy ต้องมี:

1. Backup ก่อน deploy
2. Version label ใหม่
3. Apps Script Web App URL ที่ยืนยันแล้ว
4. Vercel `VITE_API_URL` ตรงกับ URL ที่ใช้งานจริง
5. Smoke test หลัง deploy
6. Rollback path

## Next Recommended Task

เริ่มที่ Phase A + Phase B:

- ปรับ staff token เป็น Monday-Friday
- ตัดสิน self-service token daily หรือ weekly
- ทำ sync queue ให้ไม่ทิ้ง pending logs เมื่อ token หมดอายุ
- อัปเดต `BACKEND_VERSION` พร้อม backend change รอบนี้ ไม่แยก deploy

## Phase D Local Status: Cross-Year Read/Report Mode

สถานะ local: ทำ backend routing และ self-service archive event marker แล้ว ยังไม่ push GitHub และยังไม่ deploy Apps Script/Vercel

Implemented locally:

- `searchLogsCrossYear`: รายงานพนักงานอ่าน active spreadsheet สำหรับปีงบปัจจุบัน และอ่าน archive spreadsheet สำหรับปีงบเก่าผ่าน `Archive_Index`
- `publicSearchCrossYear`: self-service รองรับ date range ข้ามปี และส่ง `sourceFiscalYear`, `sourceType`, `sourceSpreadsheetId` กลับไปกับผลลัพธ์
- `Archive_Index` ตอน copy-only บันทึก fiscal year จริงของ rows ที่ archive เพื่อใช้ route ข้ามปี
- Archive read path เป็น read/report only: search ใช้ `getDataRange().getValues()` ไม่สร้าง/แก้/ลบชีต archive
- Self-service search/export/print ที่แตะ archive log เป็น `trackingMode=masked_archive`
- Active source ถูกจำกัดไม่ให้ดึง rows ปีงบเก่าเมื่อ query ข้ามปี เพื่อกันข้อมูลซ้ำกับ archive

Completed Phase D tasks locally:

- [x] fiscal year / date range รองรับหลายปี
- [x] backend route current year ไป active spreadsheet
- [x] backend route old year ไป archive spreadsheet ผ่าน `Archive_Index`
- [x] รวมผลหลายปีใน response เดียว พร้อม source year/source archive
- [x] archive mode เป็น read/report only
- [x] self-service archive search/export event marker

Still open:

- [ ] แสดง source year/source archive ใน staff Excel export โดยตรง
- [ ] log event ฝั่ง staff report search/export หากต้อง audit staff report usage แยกจาก self-service
- [ ] ทดสอบกับ archive spreadsheet จริงหลัง deploy backend

Verification:

- `npm.cmd run test -- src/test/backend.test.ts` ผ่าน 21 tests
- `npm.cmd run test` ผ่าน 77 tests
- `npm.cmd run build` ผ่าน
- `npm.cmd run lint` ผ่าน

## Phase D Gap Closure: Staff Export and Staff Archive Audit

สถานะ local: ปิด 2 gap ของ Phase D แล้ว ยังไม่ push GitHub และยังไม่ deploy

Implemented locally:

- Staff Excel export เติม `Fiscal year` และ `Data source` สำหรับ list/run/sort/ext report tabs
- Budget export เติม `Archive rows` เพื่อเห็นจำนวนแถว archive ใน summary
- Backend เพิ่ม `logStaffReportEvent` พร้อม staff session auth
- Staff report search ที่แตะ archive log อัตโนมัติเป็น `staff_report_search`
- Staff report export ที่มี archive rows log เป็น `staff_report_export`
- Staff report log ใช้ `Tx_SelfServiceLog` เดิม โดย action แยกจาก self-service

Completed Phase D remaining gaps locally:

- [x] แสดง source year/source archive ใน staff Excel export โดยตรง
- [x] log event ฝั่ง staff report search/export สำหรับ archive usage

Still open after local Phase D:

- [ ] ทดสอบกับ archive spreadsheet จริงหลัง deploy backend

Verification:

- `npm.cmd run test -- src/test/backend.test.ts src/services/api.test.ts` ผ่าน 30 tests
- `npm.cmd run test` ผ่าน 78 tests
- `npm.cmd run build` ผ่าน
- `npm.cmd run lint` ผ่าน

## Phase E Local Status: Schema and Production Release Guard

สถานะ local: เริ่ม Phase E แล้ว ทำ checklist/guard artifacts แล้ว ยังไม่ push GitHub และยังไม่ deploy

Implemented locally:

- เพิ่ม `docs/phase-e-production-release-guard.md`
- ยืนยัน `getSchemaAudit` เป็น read-only default จาก code/tests
- ยืนยัน schema repair ถูก block หากไม่มี `SCHEMA_REPAIR_APPROVED=true`
- เพิ่ม Phase E update ใน `docs/production_schema_audit_report.md`
- กำหนด no-go conditions: ไม่มี backup, ไม่รู้ active URL, env ไม่ตรง, tests fail, หรือยังไม่อนุมัติ deploy

Completed Phase E tasks locally:

- [x] เก็บ `getSchemaAudit` เป็น read-only default
- [x] ห้าม schema repair เว้นแต่ตั้ง `SCHEMA_REPAIR_APPROVED=true`
- [x] เตรียม checklist ก่อน deploy backend/frontend
- [x] เตรียม rollback path
- [x] อัปเดต `docs/production_schema_audit_report.md` สำหรับ local release guard

Still open for real production release:

- [ ] ก่อน deploy backend: backup `backend.gs` และจด active deployment URL
- [ ] หลัง deploy backend: verify `getHealth`, schema audit, login, write, self-service search
- [ ] ก่อน deploy frontend: verify Vercel env `VITE_API_URL`
- [ ] หลัง deploy frontend: verify production HTTP 200 และ asset bundle เปลี่ยนจริง
- [ ] อัปเดต `docs/production_schema_audit_report.md` ด้วยผล smoke test จริงหลัง deploy
