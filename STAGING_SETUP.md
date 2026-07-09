# คู่มือตั้งค่า Staging - DCG Smart Service

## ข้อควรระวัง
- **ห้ามแก้ `.clasp.json` ตรง** ให้ใช้ script นี้สลับชั่วคราวเท่านั้น
- **ห้าม push `.clasp.json` ที่ชี้ staging** ไประบบจริง

---

## วิธีตั้งค่า Staging (ทีละขั้น)

### ขั้นที่ 1: สร้าง Google Sheets Staging
1. ไปที่ https://sheets.google.com
2. กด **Blank** เพื่อสร้าง spreadsheet ใหม่
3. ตั้งชื่อ: `DCG Smart Service Database (Staging)`
4. คัดลอกโครงสร้างจาก sheet ระบบจริง:
   - Master_Users
   - Master_Departments
   - Master_Services
   - Tx_InternalRun
   - Tx_InternalSort
   - Tx_ExternalPost
   - Tx_OTPStore
   - Tx_SelfServiceOTPStore
   - Tx_SelfServiceLog
   - Feedback_Reports
5. คัดลอก ID จาก URL: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

### ขั้นที่ 2: สร้าง Apps Script Staging
1. เปิด Google Sheets staging ที่สร้างไว้
2. ไปที่ **Extensions > Apps Script**
3. ลบ code เดิมออก
4. คัดลอก code จาก `backend.gs` ในโปรเจกต์ไปวาง
5. ไปที่ **Project Settings** (ไอคอนฟันเฟือง)
6. เพิ่ม **Script Properties**:

| ชื่อ Property | ค่า |
|---------------|-----|
| `SPREADSHEET_ID` | [ID ของ staging sheet] |
| `LINE_NOTIFY_TOKEN` | [token ทดสอบ หรือ ปล่อยว่าง] |
| `ALLOW_MOCK_TOKEN` | `false` |

7. กด **Save**

### ขั้นที่ 3: ปล่อย Staging Web App
1. กด **Deploy > New deployment**
2. เลือก **Web app**
3. ตั้งค่า:
   - Description: `DCG Smart Service Staging`
   - Execute as: `Me`
   - Who has access: `Anyone`
4. กด **Deploy**
5. คัดลอก **Web App URL** (จะลงท้ายด้วย `/exec`)
6. คัดลอก **Script ID** จาก URL ของ Apps Script editor

### ขั้นที่ 4: ตั้งค่า clasp.json สำหรับ Staging
```bash
# วิธีที่ 1: ใช้ script อัตโนมัติ
./scripts/switch-clasp.sh staging

# วิธีที่ 2: ทำมือ
cp .clasp.json .clasp.production.json
cp .clasp.staging.json .clasp.json
# แก้ "scriptId" ใน .clasp.json เป็น staging script ID
```

### ขั้นที่ 5: Push ไป Staging Apps Script
```bash
clasp push
```

### ขั้นที่ 6: ตั้งค่า Vercel Preview Environment
1. ไปที่ Vercel Dashboard > Project > Settings > Environment Variables
2. เพิ่ม Variable:
   - Key: `VITE_API_URL`
   - Value: [Staging Web App URL ที่คัดลอกไว้]
   - Environment: **Preview** (เลือกเฉพาะ Preview)

### ขั้นที่ 7: ปล่อย Preview
```bash
git push origin phase-1-3-staging-verification
```
Vercel จะสร้าง Preview deployment โดยอัตโนมัติ

### ขั้นที่ 8: ทดสอบระบบ
1. เปิด Preview URL
2. ทดสอบ login
3. ทดสอบบันทึกข้อมูล
4. ทดสอบรายงาน
5. ตรวจสอบใน staging sheet ว่าข้อมูลถูกต้อง

---

## วิธีสลับกลับระบบจริง
```bash
# ใช้ script อัตโนมัติ
./scripts/switch-clasp.sh production

# หรือทำมือ
cp .clasp.production.json .clasp.json
```

---

## รายการตรวจสอบ Phase B
- [ ] สร้าง Google Sheets staging
- [ ] สร้าง Apps Script staging
- [ ] ตั้งค่า Script Properties
- [ ] ปล่อย staging web app
- [ ] คัดลอก staging script ID ไปใส่ `.clasp.staging.json`
- [ ] ตั้งค่า Vercel Preview env `VITE_API_URL`
- [ ] Push code ไป branch staging
- [ ] ทดสอบระบบบน Preview URL
- [ ] ตรวจสอบข้อมูลใน staging sheet
