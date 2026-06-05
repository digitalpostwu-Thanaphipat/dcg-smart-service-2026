# 🚀 แผนการย้ายระบบและโครงสร้างชีต (Migration Plan v2): Dev → Production

แผนงานฉบับนี้อ้างอิงข้อมูลโครงสร้างจริงจาก Google Sheets [WUS_Track_DB](https://docs.google.com/spreadsheets/d/1tGLmk96A2XJDU2AycbR52Seehl5rB2jQiPc9LvsNSEI/edit) และโค้ด Backend ใน `backend.gs` เพื่อทำการย้ายระบบอย่างราบรื่นโดยไม่กระทบต่อการใช้งานจริง

> **อัปเดตล่าสุด**: 4 มิถุนายน 2569 (17:00 ICT)

---

## 📅 ตารางเปรียบเทียบและการเปลี่ยนแปลงชีต (Database Schema Changes)

การย้ายจากโค้ดเดิมไปเป็นระบบใหม่ (สถาปัตยกรรม PWA + Zustand Store) จะมีการเปลี่ยนจากการเก็บข้อมูลคงที่ (Hardcoded Metadata) ใน Apps Script มาเป็นการดึงผ่านตารางชีตโดยตรง เพื่อความยืดหยุ่นและการทำงานแบบออฟไลน์

### 1. แผ่นงานที่ต้องสร้างขึ้นใหม่ใน Google Sheets จริง (Production)

> [!IMPORTANT]
> ต้องสร้างแผ่นงาน (Sheet tabs) เหล่านี้ก่อนเปิดใช้งานเว็บตัวใหม่ ไม่เช่นนั้นระบบล็อกอินและฟังก์ชันพื้นฐานจะไม่ทำงาน

#### 1.1 `Master_Users` (ข้อมูลสิทธิ์ผู้ใช้งาน)
* **วัตถุประสงค์:** ใช้ตรวจสอบสิทธิ์การเข้าถึงระบบผ่านรหัส OTP อีเมล
* **แถวแรก (Headers):**
  `UserID` | `Email` | `FullName` | `Role` | `Status`
* **ตัวอย่างข้อมูลแถวแรก:**
  `U001` | `your-email@wu.ac.th` | `ชื่อผู้ดูแลระบบ` | `Admin` | `Active`

#### 1.2 `Master_Departments` (รายชื่อหน่วยงาน 85+ แผนก)
* **วัตถุประสงค์:** ดึงรายชื่อหน่วยงานไปแสดงผลที่ช่องค้นหาฝั่ง Client (Smart Search)
* **แถวแรก (Headers):**
  `DeptID` | `DeptName` | `RouteGroup` | `Building` | `Floor` | `BudgetOwner`
* **ข้อมูลเริ่มต้น:** คัดลอกข้อมูลรายชื่อแผนกจากในโค้ด `backend.gs` แถว 164-168 ไปวางในตารางเพื่อเป็นค่าเริ่มต้น

#### 1.3 `Master_Services` (ประเภทบริการส่งไปรษณีย์)
* **วัตถุประสงค์:** เก็บประเภทและคำอธิบายของการส่งไปรษณีย์ภายนอก
* **แถวแรก (Headers):**
  `ServiceID` | `ServiceName` | `Description`
* **ข้อมูลเริ่มต้น:**
  * `S01` | `EMS` | `ไปรษณีย์ด่วนพิเศษ`
  * `S02` | `ลงทะเบียน` | `ไปรษณีย์ลงทะเบียน`
  * `S03` | `พัสดุธรรมดา` | `พัสดุไปรษณีย์`
  * `S04` | `จดหมาย` | `จดหมายธรรมดา`
  * `S05` | `ไปรษณีย์ภัณฑ์ส่วนตัว` | `ไปรษณีย์ภัณฑ์ส่วนตัว`

#### 1.4 `System_Config` (ค่ากำหนดระบบ)
* **วัตถุประสงค์:** ใช้จัดการพฤติกรรมระบบแบบพลวัต
* **แถวแรก (Headers):**
  `Key` | `Value` | `Description`
* **ข้อมูลเริ่มต้น:**
  * `announcement` | `กรุณาบันทึกข้อมูลก่อนเวลา 16.00 น.` | `ประกาศระบบหน้าแรก`
  * `restrictWorkdays` | `true` | `เปิดใช้ระบบจำกัดสิทธิ์เฉพาะวันจันทร์-ศุกร์`

#### 1.5 `Tx_OTPStore` (ตารางเก็บ OTP และเซสชันการใช้งาน)
* **วัตถุประสงค์:** บันทึก OTP Code และ Token ชั่วคราวของผู้ใช้งานที่ล็อกอิน
* **แถวแรก (Headers):**
  `Email` | `OTPCode` | `OTPExpiresAt` | `SessionToken` | `SessionExpiresAt`

---

### 2. แผ่นงานบันทึกธุรกรรม (Transaction Sheets)

โครงสร้างการจัดเก็บข้อมูลของทั้ง 3 ธุรกรรมหลักจะมีการกำหนดหัวคอลัมน์มาตรฐานเพื่อเก็บค่า Email ของพนักงานผู้ทำรายการ และ ID ของธุรกรรมเพื่อป้องกันการบันทึกข้อมูลซ้ำซ้อน (Duplicate Writes)

#### 2.1 `Tx_InternalRun` (งานรับ-ส่งภายใน)
* **คอลัมน์:** `TxID` | `Timestamp` | `DeptName` | `Route` | `Round` | `ItemCount` | `Note` | `StaffEmail`

#### 2.2 `Tx_InternalSort` (งานคัดแยก-นำจ่าย)
* **คอลัมน์:** `TxID` | `Timestamp` | `DeptName` | `NormalCount` | `RegisterCount` | `PrivateCount` | `Total` | `Note` | `StaffEmail`

#### 2.3 `Tx_ExternalPost` (งานนำส่งไปรษณีย์ภายนอก)
* **คอลัมน์:** `TxID` | `Timestamp` | `RequestingDept` | `ServiceType` | `Cost` | `ItemCount` | `TrackingNo` | `FundSource` | `StaffEmail`

---

## 🛠️ ขั้นตอนการเปลี่ยนผ่านระบบอย่างปลอดภัย (Migration Steps)

### ขั้นที่ 1: เตรียมโครงสร้าง Google Sheets
1. เปิดไฟล์ Google Sheets หลัก [WUS_Track_DB](https://docs.google.com/spreadsheets/d/1tGLmk96A2XJDU2AycbR52Seehl5rB2jQiPc9LvsNSEI/edit)
2. กดปุ่ม `+ Add Sheet` เพื่อสร้างแผ่นงานที่ระบุในหัวข้อ **"1. แผ่นงานที่ต้องสร้างขึ้นใหม่"** ให้ครบทั้ง 5 หน้า
3. กรอกแถวแรก (Headers) ของแต่ละชีตให้สะกดตัวพิมพ์เล็ก-ใหญ่ตรงตามที่กำหนดไว้ทุกประการ
4. เพิ่มอีเมลของเจ้าหน้าที่ที่ใช้งานจริงลงในแผ่นงาน `Master_Users` โดยกำหนดค่า `Status` เป็น `Active`

### ขั้นที่ 2: อัปเดตและ Deploy โค้ด Apps Script
1. ไปที่เมนู **Extensions > Apps Script** ในชีตหลัก
2. คัดลอกโค้ดจาก `D:\[DEV] __WUS_Track_DB\backend.gs` ไปเขียนทับโค้ดเดิมในตัวแก้ไข
3. ตรวจสอบการประกาศ `SPREADSHEET_ID` ที่ด้านบนของไฟล์ ให้ตรงกับ ID ของชีตหลัก
4. กด **Deploy > New Deployment** เลือกประเภทเป็น **Web App**
   * **Execute as:** `Me` (อีเมลของคุณ)
   * **Who has access:** `Anyone` (เพื่อให้เว็บบน Vercel เรียก API ได้)
5. คัดลอก URL ของ Web App ที่ได้จากการ Deploy ครั้งนี้

### ขั้นที่ 3: กำหนดค่า Environment ในโปรเจกต์ Dev และ Build
1. เปิดไฟล์ `D:\[DEV] __WUS_Track_DB\src\config.ts`
2. อัปเดต `API_URL` ด้วย URL ที่คัดลอกมาจากขั้นตอนที่ 2
3. เปิดหน้าต่าง Command Prompt หรือ PowerShell ในโฟลเดอร์โปรเจกต์ Dev จากนั้นรันคำสั่ง:
   ```bash
   python scratch/run_npm.py run build
   ```
4. ระบบจะทำการตรวจสอบ Lint, TypeScript Types และสร้างไฟล์ในโฟลเดอร์ `dist/`

### ขั้นที่ 4: เชื่อมต่อและ Deploy ขึ้น Vercel
1. เปิดเว็บบราวเซอร์ล็อกอินเข้าไปที่บัญชี Vercel ที่ใช้เปิดโฮสต์ระบบตัวปัจจุบันอยู่
2. อัปเดต Source code ใน Repository หลักบน GitHub ด้วยไฟล์โค้ดชุดใหม่
   > [!TIP]
   > แนะนำให้สร้าง Branch ใหม่บน Git (เช่น `v2-migration`) เพื่อทบทวนการ Commit ก่อน Merge ไปที่ Branch หลักของ Production
3. รอ Vercel ตรวจจับความเปลี่ยนแปลงและ Build ระบบใหม่อัตโนมัติ

---

## 🔄 แผนถอยกลับฉุกเฉิน (Rollback Plan)

ในกรณีที่พนักงานผู้ใช้งานพบปัญหาที่ไม่สามารถเปิดใช้งานหน้าแรกได้ หรือไม่สามารถทำบันทึกข้อมูลได้ตามปกติ ให้ดำเนินการดังนี้ทันที:

1. **ถอยกลับเว็บบน Vercel:** เข้าสู่ Vercel Dashboard เลือก Deployment ล่าสุดของโปรเจกต์ กดสัญลักษณ์จุดสามจุดด้านขวาแล้วเลือก **Promote to Production** ให้กับ Commit ก่อนหน้านี้ที่เป็นระบบเดิม
2. **ถอยกลับ Backend API:** เปิดหน้าตัวเขียนโค้ด Apps Script นำโค้ด Apps Script สำรองเดิมที่บันทึกเก็บไว้กลับมาทับรหัสโค้ดใหม่ แล้วกดบันทึกพร้อม Deploy เวอร์ชันเดิม
3. **ตรวจสอบข้อมูลในสเปรดชีต**: ตรวจสอบว่ามีข้อมูลจากระบบใหม่ตกค้างที่บันทึกซ้ำซ้อนหรือคลาดเคลื่อนในตารางธุรกรรมหรือไม่ หากมีให้ทำการตัดแยกและย้ายข้อมูลตามรูปแบบเก่า

---

## 📅 6. แผนงานวันพรุ่งนี้ (ศุกร์ 5 มิ.ย. 2569) — Migration Day

> [!IMPORTANT]
> พรุ่งนี้เป็นวันทำงาน (ศุกร์) แต่เป็นวันสุดท้ายของสัปดาห์ทำงาน (ระบบจำกัดเฉพาะวันจันทร์-ศุกร์) จึงเป็นช่วงเวลาที่ปลอดภัยที่สุดในการทำ Migration Steps 1-2

### 🟢 Phase A: เตรียม Google Sheets (Migration Step 1) — ~30 นาที

**ทำร่วมกัน: คุณ (ทำบนเว็บ Google Sheets) + AI (คอยแนะนำ)**

- [ ] เปิด Google Sheets [WUS_Track_DB](https://docs.google.com/spreadsheets/d/1tGLmk96A2XJDU2AycbR52Seehl5rB2jQiPc9LvsNSEI/edit)
- [ ] สร้างแผ่นงาน `Master_Users` + กรอก Headers + เพิ่มอีเมลเจ้าหน้าที่ที่ใช้งานจริง (Status=`Active`)
- [ ] สร้างแผ่นงาน `Master_Departments` + กรอก Headers + คัดลอกข้อมูลจาก fallback data
- [ ] สร้างแผ่นงาน `Master_Services` + กรอก Headers + เพิ่ม 5 รายการเริ่มต้น
- [ ] สร้างแผ่นงาน `System_Config` + กรอก 2 แถวเริ่มต้น (announcement + restrictWorkdays)
- [ ] สร้างแผ่นงาน `Tx_OTPStore` + กรอก Headers (ไม่ต้องกรอกข้อมูล)
- [ ] สร้างแผ่นงาน `Tx_InternalRun` + กรอก Headers
- [ ] สร้างแผ่นงาน `Tx_InternalSort` + กรอก Headers
- [ ] สร้างแผ่นงาน `Tx_ExternalPost` + กรอก Headers
- [ ] สร้างแผ่นงาน `Feedback_Reports` + กรอก Headers: `Timestamp` | `StaffEmail` | `FeedbackType` | `Severity` | `Description`
- [ ] ตรวจสอบทุกแผ่นงานว่าสะกดตัวพิมพ์ใหญ่-เล็กตรงกันทุกตัว

### 🟡 Phase B: Deploy Apps Script (Migration Step 2) — ~15 นาที

**ทำร่วมกัน: คุณ (ทำบนเว็บ Google Sheets) + AI (คอยตรวจโค้ด)**

- [ ] เปิด Extensions > Apps Script ในชีทหลัก
- [ ] **สำรองโค้ด Apps Script เดิมก่อน** (คัดลอกไว้ใน Notepad/VS Code เผื่อ Rollback)
- [ ] คัดลอกโค้ดจาก `D:\[DEV] __WUS_Track_DB\backend.gs` (1,018 บรรทัด) ไปเขียนทับโค้ดเดิม
- [ ] ตรวจ `SPREADSHEET_ID` ให้ตรงกับ ID ของชีทจริง
- [ ] กด Deploy > New Deployment > Web App (Execute as: Me, Access: Anyone)
- [ ] คัดลอก URL Web App ที่ได้
- [ ] ทดสอบเรียก URL ผ่านเบราวเซอร์: `เปิดแท็บใหม่แล้วเพิ่ม ?action=getMetaData` ต้องได้ JSON กลับมา
- [ ] รัน `setupDailyBackupTrigger()` เพื่อตั้ง Auto-Backup Trigger ทุกวัน 02:00 น.

### 🟠 Phase C: แก้ Code Quality Issues & Hotfixes (AI ทำเอง) — ✅ เสร็จสมบูรณ์

**AI ทำให้ คุณตรวจผล**

- [x] **2.3** แก้ `bg-purple-650` เป็น `bg-purple-600` ใน 2 ไฟล์ (App.tsx + PublicTrackView.tsx)
- [x] **2.5** แก้ ESLint version mismatch (รัน `npm install` ใหม่)
- [x] **2.2** แทนที่ `alert()` / `confirm()` (7 จุด) ด้วย Toast/Dialog component
- [x] **Hotfix 1:** แก้ไข React Key ซ้ำเมื่อชื่อหน่วยงานซ้ำกันใน [RunPage.tsx](file:///D:/[DEV] __WUS_Track_DB/src/pages/RunPage.tsx)
- [x] **Hotfix 2:** เพิ่ม `handleJsonResponse` ใน [api.ts](file:///D:/[DEV] __WUS_Track_DB/src/services/api.ts) เพื่อดักจับข้อความที่ไม่ใช่ JSON และป้อนเข้า Error handler อย่างปลอดภัย
- [x] ตรวจยืนยัน Build ผ่าน (`tsc -b` + `vite build` สำเร็จ 100%)

### 🔵 Phase D: ทดสอบวงจรครบ (ทำร่วมกัน) — 🟡 กำลังดำเนินการ

- [ ] รัน `npm run dev` แล้วทดสอบล็อกอินด้วย OTP ผ่าน API ตัวจริง
- [ ] ทดสอบบันทึกธุรกรรม (Run / Sort / External) ดูว่าข้อมูลลงชีทจริง
- [ ] ทดสอบปุ่ม Feedback — ส่งรายงานทดสอบดูว่าปรากฏใน `Feedback_Reports`
- [ ] ตรวจสอบรายงานค้นหาผ่าน Report tab
- [ ] ยืนยันว่าระบบทำงานได้ถูกต้องครบวงจร (รวมถึงการซิงค์ข้อมูลแบบออฟไลน์เมื่อมีปัญหาเน็ตและแจ้งเตือนอย่างถูกต้อง)

---

> [!TIP]
> **ระยะเวลารวมประมาณ**: ~80 นาที (ไม่รวมเวลา Deploy Vercel ซึ่งยังไม่ทำพรุ่งนี้)
> **เป้าหมาย**: หลังทำเสร็จพรุ่งนี้ ระบบ Dev จะสามารถเชื่อมต่อกับ Backend จริงได้แล้ว จากนั้นค่อยเลื่อนไป Vercel Deploy (ขั้นที่ 3-4) ในสัปดาห์ถัดไปเมื่อพร้อม
