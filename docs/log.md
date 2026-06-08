# Chronological Audit & Establishment Log / บันทึกประวัติการตรวจสอบและการจัดทำระบบวิกิ

เอกสารฉบับนี้เป็นบันทึกทางประวัติศาสตร์ (Chronological Log) รวบรวมเหตุการณ์ตั้งแต่ช่วงเริ่มต้นการวิเคราะห์สถาปัตยกรรม การประเมินความปลอดภัย และการเข้าถึงระบบ ไปจนถึงการจัดตั้งวิกิข้อมูลกลางแบบถาวร (Persistent Wiki) สำหรับโครงการ **WUS Track DB System**

---

## 📅 เส้นเวลาเหตุการณ์ (Activity Timeline)

### 📌 เฟสที่ 1: การตรวจสอบและวิเคราะห์โครงสร้างระบบพื้นฐาน (System Infrastructure & Architecture Discovery)
* **ช่วงเวลา:** มิถุนายน 2026 (Milestone 1 - ดำเนินการโดย Explorer Agent M1)
* **กิจกรรมหลัก:**
  * ตรวจสอบความเข้ากันได้ของการคอมไพล์ (Build Compatibility) และโครงสร้างไดเรกทอรีของโปรเจกต์ `.`
  * ตรวจสอบรหัสต้นฉบับฝั่งแบ็กเอนด์ (Google Apps Script) ในไฟล์ `./backend.gs` เพื่อประเมินความเชื่อมโยงกับฐานข้อมูลชีต
* **การค้นพบสำคัญ (Key Findings):**
  1. **โครงสร้างไฟล์ไม่ตรงกัน (File Path Mismatch):** พบข้อผิดพลาดร้ายแรงที่ทำให้โปรเจกต์คอมไพล์ไม่ผ่าน เนื่องจาก `index.html` อ้างอิงไฟล์ไปที่ `/src/main.tsx` แต่ตำแหน่งไฟล์จริงถูกเก็บไว้ที่ `src/assets/main.tsx` รวมถึงไฟล์ `App.tsx` ด้วย
  2. **ไฟล์สำคัญขาดหาย (Missing Critical Files):** ตรวจพบว่าไฟล์ `index.css` (นำเข้าโดย `main.tsx`) และ `config.ts` (นำเข้าโดย `App.tsx`) ไม่มีอยู่จริงในพื้นที่ทำงาน (Workspace)
  3. **ขาดไฟล์การตั้งค่า (Missing Configuration Files):** ไม่มีไฟล์ควบคุมการตั้งค่าโครงการ ได้แก่ `tsconfig.json` และ `vite.config.ts` ในโฟลเดอร์โครงการ
  4. **การขอข้อมูล MetaData ไม่ถูกต้อง:** ฝั่ง Frontend พยายามดึงข้อมูลตั้งต้น (Metadata) ผ่าน POST API ด้วยแอ็กชัน `{ action: "getMetaData" }` แต่ในแบ็กเอนด์ `Code.gs` ไม่ได้เตรียมกรณีการตอบกลับสำหรับแอ็กชันนี้ (ทำให้ไหลเข้าลูปบันทึกข้อมูลและไม่ส่งค่าใดกลับคืน) ขณะที่ระบบแบ็กเอนด์ได้รองรับข้อมูลนี้ผ่านทาง HTTP GET `doGet(e)` แทน ทำให้แอปพลิเคชันฝั่งผู้ใช้หยุดนิ่งอยู่ที่หน้าจอโหลด "กำลังเชื่อมต่อฐานข้อมูล..."
  5. **ปัญหาการจับคู่คีย์สำหรับ Login:** ตัวแปรสิทธิ์การล็อกอินฝั่งผู้ใช้ถูกตั้งเป็นตัวอักษรพิมพ์ใหญ่ (เช่น `u.Email`, `u.FullName`) บนโมเดล Frontend แต่ใน Apps Script จะตอบกลับค่าด้วยตัวพิมพ์เล็กทั้งหมด (`email`, `name`) ส่งผลให้ระบบล้มเหลว (TypeError) เมื่อผู้ใช้งานพยายามล็อกอิน

---

### 📌 เฟสที่ 2: การตรวจสอบความปลอดภัยและการเข้าถึงข้อมูล (Security & Accessibility Audit)
* **ช่วงเวลา:** มิถุนายน 2026 (Milestone 2 - ดำเนินการโดย Explorer Agent M2)
* **กิจกรรมหลัก:**
  * ตรวจสอบ API endpoint ของ Google Apps Script ค้นหาช่องโหว่การไม่ระบุตัวตน (Authentication/Authorization Bypasses)
  * ประเมินการจัดเก็บข้อมูลและการกรอกข้อมูลลงเซลล์ของ Google Sheets
  * ดำเนินการทดสอบการเข้าถึงข้อมูลตามมาตรฐาน WCAG 2.2 AA บนโค้ด UI ในไฟล์ `src/assets/App.tsx`
* **การค้นพบสำคัญ (Key Findings):**
  1. **สิทธิ์การเข้าถึงแบบสาธารณะที่หละหลวม (Public Data Leaks):** ฟังก์ชัน `doGet(e)` ปล่อยให้บุคคลภายนอกสามารถดึงข้อมูลรายชื่อผู้ใช้งาน รหัสพนักงาน อีเมล เทมเพลตข้อความ และข้อมูลมอบหมายงานออกไปได้ทั้งหมดโดยไม่ต้องผ่านการล็อกอินใด ๆ
  2. **การข้ามการล็อกอินฝั่งไคลเอนต์ (Client-side Login Bypass):** Frontend ตรวจสอบความถูกต้องของอีเมลด้วยการเปรียบเทียบจากข้อมูลที่โหลดมาแบบสาธารณะบนเว็บเบราว์เซอร์เท่านั้น และบันทึกสถานะการล็อกอินลง `localStorage` โดยไม่มีการใช้รหัสผ่านหรือ API token ส่งผลให้บุคคลทั่วไปสามารถเข้าสู่ระบบในชื่อพนักงานคนใดก็ได้ตามต้องการ
  3. **การส่งข้อมูลล้มเหลวอย่างเงียบ (Silent Failures):** Frontend บันทึกข้อมูลโดยตั้งค่าเป็น `no-cors` พร้อมทั้งครอบฟิลด์ข้อมูลด้วยโครงสร้างแบบซ้อน `{"action": "saveRun", "payload": {...}}` แต่ Apps Script ปลายทางประมวลผลข้อมูลแบบ Flat structure (ต้องการตัวแปรในระดับราก เช่น `postData.workData`) ส่งผลให้ฝั่งเซิร์ฟเวอร์เกิดข้อผิดพลาดรันไทม์ (TypeError: cannot read property of undefined) ขณะที่ฝั่ง Frontend มองผ่านผลลัพธ์ของ `no-cors` ว่าเป็นการบันทึกข้อมูลสำเร็จ (Success) โดยผู้ใช้งานไม่มีทางทราบเลยว่าข้อมูลสูญหาย
  4. **ช่องโหว่ Formula/CSV Injection:** แบ็กเอนด์บันทึกสตริงที่ได้รับจากผู้ใช้งานเข้าสู่ตาราง Google Sheets โดยตรงผ่านคำสั่ง `.setValue()` และ `.appendRow()` หากข้อความที่กรอกมีอักขระพิเศษขึ้นต้น เช่น `=`, `+`, `-`, หรือ `@` ระบบ Google Sheets จะมองว่าเป็นสูตรคำนวณและประมวลผลทันที ซึ่งอาจเปิดโอกาสให้ผู้ไม่หวังดีป้อนฟังก์ชันประสงค์ร้ายเพื่อเจาะและขโมยข้อมูลภายในสเปรดชีตส่งไปยังโดเมนภายนอกได้
  5. **การไม่ปฏิบัติตามมาตรฐาน WCAG 2.2 AA:** พบข้อผิดพลาดด้าน Accessibility ร้ายแรง เช่น ความต่างสีของตัวอักษรสีเทาที่ต่ำเกินไป (Color Contrast Failure), สีปุ่มแอ็กชันหลักสีขาวบนพื้นหลังสีเขียวมีอัตราส่วนเพียง 2.3:1 (ต่ำกว่าเกณฑ์ 4.5:1), ไม่รองรับ Focus ring บนคีย์บอร์ด (Suppression outline), ไม่มีฉลากผูกกับกล่องข้อความ (Decoupled label-input) และไม่มี ARIA attribute สำหรับบอกโครงสร้าง Tab Control

---

### 📌 เฟสที่ 3: การจัดตั้งระบบวิกิและเอกสารข้อมูลกลาง (Wiki Establishment & Verification)
* **ช่วงเวลา:** 4 มิถุนายน 2026 (Milestone 3 - ดำเนินการโดย Worker Agent M3)
* **กิจกรรมหลัก:**
  * รวบรวมและกลั่นกรองข้อค้นพบจากการวิเคราะห์สถาปัตยกรรมและรายงานตรวจสอบความปลอดภัย
  * จัดทำเอกสารข้อมูลกลาง (Persistent Wiki) จำนวน 5 ฉบับลงในโฟลเดอร์ `./docs`
  * วางการเชื่อมโยงระบบเอกสารด้วย Markdown links และตรวจสอบความถูกต้องของข้อมูล
* **เอกสารที่สร้างเสร็จสมบูรณ์:**
  * [index.md](./index.md) (สารบัญวิกิและการอ้างอิงหมวดหมู่)
  * [log.md](./log.md) (ประวัติและกิจกรรมการตรวจสอบระบบ)
  * [architecture.md](./architecture.md) (สถาปัตยกรรมระบบ ปัญหาโครงสร้างไฟล์ และโครงสร้างสัญญา API)
  * [vulnerabilities.md](./vulnerabilities.md) (สมุดรายงานความปลอดภัยและการแก้ไขปัญหาข้อมูลรั่ว/สูตรคำนวณ)
  * [wcag.md](./wcag.md) (แนวทางการปรับปรุงระบบตามมาตรฐานการเข้าถึง WCAG 2.2 AA)

---

### 📌 เฟสที่ 4: การเปรียบเทียบข้อมูลและการทบทวนเชิงลึก (Comparison & Depth Enrichment Audit)
* **ช่วงเวลา:** 4 มิถุนายน 2026 (ดำเนินการโดยคู่หู AI และผู้ใช้)
* **กิจกรรมหลัก:**
  * นำผลการประเมินเบื้องต้นเข้าเปรียบเทียบกับชุดข้อมูลจุดควรระวังเพิ่มเติมจากผู้ใช้
  * บันทึกช่องโหว่ความปลอดภัยร้ายแรงเพิ่มเติมบนแบ็กเอนด์ ได้แก่ บั๊กตัวแปร `today` ทำงานล้มเหลว, ปัญหา Hardcoded ID, การข้ามตรวจสิทธิ์แบบ Mock ใน Production และการยิง OTP Request
  * เพิ่มเติมมิติจุดบกพร่องด้านการทดสอบ (Testing Gaps) เช่น การขาดโครงสร้าง Unit Test (Vitest/Jest) และ CI/CD Pipelines
  * เพิ่มเติมมิติจุดอ่อนด้านการออกแบบ (Design Tokens, Responsive Breakpoints, Component Variants)
* **ผลลัพธ์:** เอกสารฐานความรู้ LLM Wiki ทั้งหมดได้รับการอัปเดตและปรับโครงสร้างการเชื่อมโยงใหม่อย่างครบถ้วนสมบูรณ์แบบ

---

### 📌 การแก้ไขวิกฤตระบบสคริปต์หลังบ้าน (Backend & Security Hotfix)
* **ช่วงเวลา:** 4 มิถุนายน 2026 (สอดคล้องกับสัปดาห์ที่ 1 ของ Solo Roadmap)
* **การดำเนินการแก้ไข:**
  * **[backend.gs](./backend.gs):** ย้ายการประกาศตัวแปร `today = new Date();` ไปไว้ที่บรรทัดแรกสุดของฟังก์ชัน `verifySessionToken()` เพื่อขจัดปัญหา ReferenceError เมื่อปิดสวิตช์จำกัดวันทำงาน
  * **[backend.gs](./backend.gs):** เพิ่มความปลอดภัยโดยล็อกให้การใช้ Mock Token ทำงานได้เฉพาะเมื่อผู้ดูแลระบบตั้งค่า Property `ALLOW_MOCK_TOKEN` เป็น `"true"` ใน Apps Script เท่านั้น
  * **[backend.gs](./backend.gs):** ย้ายการเชื่อมต่อ `SPREADSHEET_ID` หลักให้ดึงข้อมูลจาก Script Properties ด้วยคำสั่ง `PropertiesService` โดยมี ID เดิมเป็นค่าสำรองเริ่มต้น (Fallback)
  * **[Build & API Verification]:** ทดสอบสั่งรัน `npm run build` บนซอร์สโค้ดจริงของโครงการสำเร็จเรียบร้อยโดยไม่มีข้อผิดพลาด (0 errors) พร้อมทั้งยืนยันโครงสร้างการรับส่งข้อมูล (`api.saveBatch` และ `saveBatch(payload)`) ว่าได้รับการปรับจูนแก้ไขโครงสร้างและขจัดโหมด `no-cors` เรียบร้อยแล้วในซอร์สโค้ดที่ปรับปรุงโครงสร้างใหม่

---

### 📌 จัดตั้งระบบทดสอบอัตโนมัติ (Testing Infrastructure Setup)
* **ช่วงเวลา:** 4 มิถุนายน 2026 (สอดคล้องกับสัปดาห์ที่ 2 ของ Solo Roadmap)
* **การดำเนินการแก้ไข:**
  * **[package.json](./package.json):** ติดตั้งแพ็คเกจสำหรับการทดสอบ ได้แก่ `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, และ `fake-indexeddb` พร้อมเพิ่มสคริปต์ `"test": "vitest run"`
  * **[vite.config.ts](./vite.config.ts):** ตั้งค่าบล็อก `test` ของ Vitest โดยกำหนด `environment: 'jsdom'`, เชื่อมต่อกับไฟล์ setup, จำกัดขอบเขตการสแกนเฉพาะโฟลเดอร์ `src/` (`include: ['src/**/*.{test,spec}.{ts,tsx}']`) และคัดโฟลเดอร์ที่ไม่เกี่ยวข้องออกเพื่อความรวดเร็วและแม่นยำ
  * **[src/test/setup.ts](./src/test/setup.ts):** สร้างไฟล์กำหนดค่าเริ่มต้นสำหรับการจำลองเบราว์เซอร์ รวมถึงการ Mock `window.matchMedia` และอิมพอร์ต `fake-indexeddb/auto` เพื่อรองรับการทดสอบฐานข้อมูลออฟไลน์
  * **[src/utils/helpers.test.ts](./src/utils/helpers.test.ts):** พัฒนา Unit Test แรกสำหรับฟังก์ชันใน `helpers.ts` และรันคำสั่งทดสอบผ่านสำเร็จ 100% (5 ผ่านจาก 5 เทสเคส)

---

### 📌 เฟสที่ 5: ระบบซิงค์ออฟไลน์ สัญลักษณ์สถานะเน็ต และคู่มือส่งมอบระบบ (Offline Sync Engine, Network Indicator & Handover Docs)
* **ช่วงเวลา:** 4 มิถุนายน 2026 (สอดคล้องกับสัปดาห์ที่ 3-4 ของ Solo Roadmap)
* **การดำเนินการแก้ไข:**
  * **[src/utils/helpers.test.ts](./src/utils/helpers.test.ts):** แก้ไขข้อผิดพลาดของ TypeScript compiler ในตัวแปรทดสอบ โดยเปลี่ยนโครงสร้าง `DeptCode` ให้เป็น `DeptID` และใส่ `RouteGroup` ให้ครบถ้วนตามอินเทอร์เฟซโมเดล `Department` จริง
  * **[src/services/api.ts](./src/services/api.ts):** เพิ่มฟังก์ชัน `checkConnection()` เพื่อส่งคำขอ HTTP GET ตรวจสอบระดับการเชื่อมต่อจริงกับ Apps Script พร้อมตั้งเวลาหมดเวลา (Timeout) 4 วินาทีเพื่อป้องกันระบบค้าง
  * **[src/store/useAppStore.ts](./src/store/useAppStore.ts):** ติดตั้งตัวแปรตรวจวัดระดับเครือข่าย `isOnline` และปริมาณคิวงานที่ยังไม่ได้อัปโหลด `syncQueueCount` พร้อมเมธอดการจัดการ
  * **[src/services/syncEngine.ts](./src/services/syncEngine.ts):** ปรับปรุงให้มีการนับและอัปเดตค่า `syncQueueCount` ทุกครั้งที่มีการกรอกแบบฟอร์มบันทึกข้อมูล และเมื่อซิงค์ข้อมูลแต่ละรายการสำเร็จ
  * **[src/App.tsx](./src/App.tsx):** ติดตั้งการดักฟังเน็ตออนไลน์/ออฟไลน์ และกำหนดฟังก์ชันตรวจสอบสัญญาณจริงทุกๆ 30 วินาทีเพื่อซิงค์ข้อมูลค้างคิวเบื้องหลังทันทีที่เชื่อมอินเทอร์เน็ตได้
  * **[src/components/layout/MainLayout.tsx](./src/components/layout/MainLayout.tsx):** ออกแบบแถบแสดงสถานะกล่องเชื่อมต่อ (OLED Style) และปุ่มบังคับส่งซิงค์ข้อมูล บนเมนูหลักทางซ้าย (Desktop) และปุ่ม Badge วงกลมขนาดเล็กตรงแถบ Header (Mobile)
  * **[PWA Update Strategy - vite.config.ts / App.tsx]:** ปรับเปลี่ยนค่าการติดตั้ง Service Worker เป็น `'prompt'` เพื่อแจ้งเตือนการรีโหลดแทนการบังคับรีโหลดกะทันหัน ซึ่งอาจส่งผลให้ข้อมูลฟอร์มพัสดุที่คัดแยกอยู่สูญหาย
  * **[docs/handover.md](./docs/handover.md):** จัดทำคู่มือแนะนำขั้นตอนการจัดเตรียมชีต, การนำโค้ด Apps Script ไปใช้งาน, การลงทะเบียน Script Properties และแนวทาง Troubleshooting การซิงค์ล้มเหลว
  * **[Build & Test Verification]:** ยืนยันผลการคอมไพล์ผ่านคำสั่ง `npm run build` สำเร็จ 100% ไม่มี TypeScript compiler errors และผลการทดสอบ Unit Test ผ่าน Vitest ครบถ้วน (5 ผ่านจาก 5 เทสเคส)

---

### 📌 เฟสที่ 6: การประเมินความพร้อมและความเข้ากันได้เพื่อขึ้นระบบจริง (Production Readiness Verification)
* **ช่วงเวลา:** 4 มิถุนายน 2026 (ดำเนินการตรวจสอบระบบและความถูกต้อง)
* **การดำเนินการตรวจสอบ:**
  * **[Production Readiness Audit]:** จัดทำรายงานการประเมินความพร้อมและจุดตัดสินใจการออกแบบใน [production_readiness_audit.md](file:///C:/Users/Admin/.gemini/antigravity-cli/brain/a7f75028-1ae3-4093-8bd8-0f471dbf9b41/production_readiness_audit.md) เพื่อเปรียบเทียบความถูกต้องของโค้ดกับข้อกำหนดใน PRD
  * **[API URL Verification]:** ตรวจสอบไฟล์การตั้งค่า `src/config.ts` พบว่าการเชื่อมโยง API ไปยัง Google Apps Script Web App มีความสมบูรณ์และพร้อมใช้งานจริง (ไม่ใช่ Mock Endpoint)
  * **[State Persistence Audit]:** วิเคราะห์ Zustand Store ในการทำ Persistence ข้อมูล `localStorage` พบว่าระบบจัดเก็บเฉพาะสถานะการล็อกอินและตัวกรองตามหลักความเป็นส่วนตัวและความปลอดภัย (Data Privacy) ป้องกันข้อมูลธุรกรรมรั่วไหลในเครื่องใช้งานร่วมกัน
  * **[Build & Integration Check]:** สั่งคอมไพล์ทดสอบระบบด้วยสคริปต์ Python ในไดเรกทอรีที่มีวงเล็บเหลี่ยม ผลการ Build และการรัน Vitest ผ่านทั้งหมด 100% ไม่มีข้อผิดพลาด

---

### 📌 เฟสที่ 7: การพัฒนาฟีเจอร์ใหม่ การแก้ไขช่องโหว่ และการปรับปรุงคุณภาพโค้ด (Feature Development, Security Hardening & Quality Improvement)
* **ช่วงเวลา:** 4 มิถุนายน 2569 (ดำเนินการโดย Teamwork Agents — Lead Developer, Wiki Maintainer, และ Main Agent)
* **กิจกรรมหลัก:**
  * **[Q0: User Feedback Channel — ✅ เสร็จสมบูรณ์]:**
    * พัฒนา `FeedbackButton.tsx` — Floating button + Modal Form พร้อม Focus Trap (WCAG 2.2 AA)
    * เพิ่ม `handleFeedback()` ใน `backend.gs` — บันทึกลง `Feedback_Reports` sheet + LockService + sanitizeInput
    * เพิ่ม `sendLineNotification()` ใน `backend.gs` — แจ้ง admin ผ่าน LINE Notify เมื่อ severity=High/Critical
    * เขียน Unit Test ใน `FeedbackButton.test.tsx`
    * ผ่าน Forensic Audit (CLEAN verdict)
  * **[Auto-Backup Engine — ✅ เสร็จสมบูรณ์]:**
    * พัฒนา `runAutoBackup()` — Export 3 ชีทธุรกรรมเป็น .xlsx ไปยัง Google Drive `Dcg Smart Service_Backup/`
    * พัฒนา `applyBackupRetention()` — Retention Policy 30 วัน
    * พัฒนา `setupDailyBackupTrigger()` — Time-driven trigger ทุกวัน 02:00 น. (Asia/Bangkok)
    * ผ่าน Forensic Audit (CLEAN verdict)
  * **[Security Fix — ✅ แก้ไขแล้ว]:**
    * แก้ไข Formula Injection Bypass ใน `sanitizeInput()` (backend.gs:113-123)
    * เพิ่ม trimming whitespace/newlines/BOM ก่อนตรวจ prefix
    * เพิ่มการตรวจ `\t` (Tab) และ `\r` (Carriage Return) ตาม OWASP CSV Injection guidelines
  * **[WCAG Accessibility Fix — ✅ แก้ไขแล้ว]:**
    * แก้ไข Contrast Ratio ใน `FeedbackButton.tsx` (6 จุด)
    * Label colors: `text-slate-400` → `text-slate-600` (Light), `dark:text-slate-500` → `dark:text-slate-400` (Dark)
    * ผ่าน WCAG 2.1 AA (≥4.5:1 contrast ratio)
  * **[Documentation Updates — ✅ เสร็จสมบูรณ์]:**
    * อัปเดต `architecture_analysis_report.md` เป็น v2.1 — ปรับสถานะ Q0+Backup เป็นเสร็จสมบูรณ์, เพิ่มข้อมูล backend ใหม่
    * อัปเดต `migration_plan_v2.md` — เพิ่ม Section 6: แผนงานพรุ่งนี้ (ศุกร์ 5 มิ.ย. 2569)
    * อัปเดต `log.md` (ไฟล์นี้) — เพิ่มเฟสที่ 7
    * อัปเดต `index.md` — ปรับลิงก์และสถานะ

---

### 📌 เฟสที่ 8: การดำเนินการวัน Migration Day — 5 มิถุนายน 2569 (ศุกร์)
* **ช่วงเวลา:** 5 มิถุนายน 2569 (ศุกร์) — ดำเนินการจริง
* **กิจกรรมหลักและการดำเนินการ:**
  * **[Phase C: Code Quality & Build — ✅ เสร็จสมบูรณ์]:**
    * แก้ไข type errors ในชุดการทดสอบย่อย (`FeedbackButton.test.tsx` และ `backend.test.ts`)
    * ปรับปรุงไฟล์ตั้งค่า `tsconfig.app.json` โดยนำเข้า type `"node"` เพื่อรองรับการทำงานของโมดูล `fs`, `path`, และ `process` ในการทดสอบ
    * ยืนยันผลการ Build ผ่าน `npm run build` สำเร็จ 100% (ไม่มีข้อผิดพลาด) พร้อม PWA Service Worker สำหรับการทำงานแบบออฟไลน์
    * รันการทดสอบ Unit Tests ผ่าน Vitest สำเร็จครบถ้วน 31 เคส (`31/31 tests passed`)
  * **[Git Cleanup & Remote Update — ✅ เสร็จสมบูรณ์]:**
    * อัปเดต `.gitignore` เพื่อยกเว้นโฟลเดอร์ที่ไม่จำเป็น ได้แก่ `node_modules/`, `dist/`, `.gemini/` และโฟลเดอร์ `@/` (ที่เป็นตัวสคริปต์สำรอง) พร้อมทำการลบ Cache การติดตามเดิมออก (`git rm -r --cached`)
    * ทำการติดตามการเปลี่ยนแปลง (Git Track) โฟลเดอร์ `คู่มือการใช้งานระบบบริหารงานไปรษณีย์/` และไฟล์ `next_steps_roadmap.md` ตามความต้องการของผู้ใช้งาน
    * เปลี่ยน Git Remote URL ไปที่ Repository ใหม่:
      `https://github.com/digitalpostwu-Thanaphipat/dcg-smart-service-2026.git`
    * ทำการ Commit และ Push ขึ้นสาขา `main` เรียบร้อยแล้ว
  * **[Backend Web App URL Verification — ✅ ตรวจสอบแล้ว]:**
    * ยืนยันว่า Web App URL ใหม่ (`https://script.google.com/macros/s/AKfycbyhXXtSjtMvbeGWB4VEsFFo_zLQJ_3BGfXNpX1MByDC3EpuWCkEk-5VfCrUjODm-4jSFg/exec`) ถูกตั้งค่า in `src/config.ts` แล้ว
    * ทำการจำลองการยิงคำขอแบบ POST `getMetaData` ไปยัง URL หลังบ้านจริงสำเร็จ ได้รับรายชื่อแผนก บริการ และการตั้งค่าของตารางอย่างถูกต้อง ครบถ้วน
  * **[Hotfixes on Migration Day — ✅ เสร็จสมบูรณ์]:**
    * **แก้ไขปัญหา React Duplicate Keys:** ตรวจพบและแก้ไขปัญหาคีย์ซ้ำในหน้าแสดงรายชื่อหน่วยงานเช็คลิสต์ [RunPage.tsx](file:///D:/[DEV] __WUS_Track_DB/src/pages/RunPage.tsx#L115) โดยใส่ตัวชี้ตำแหน่ง Array (`idx`) เข้าไปเป็นส่วนหนึ่งของคีย์เพื่อรับประกันความยูนีค
    * **แก้ไขปัญหา JSON Parsing SyntaxError:** เพิ่มฟังก์ชัน `handleJsonResponse` ใน [api.ts](file:///D:/[DEV] __WUS_Track_DB/src/services/api.ts#L10) เพื่อดักจับและส่งผ่านข้อความตอบกลับที่ไม่ใช่ JSON (เช่น ข้อความธรรมดาจากการยิงคำขอของระบบที่ติดปัญหาการเชื่อมต่อ) กลับคืนมาเป็นออบเจกต์ข้อผิดพลาดอย่างสุภาพ ป้องกันหน้าเว็บค้างหรือแสดงผลแบบแครช พร้อมทั้งแก้ไข Mock Fallback สำหรับ Unit Test เรียบร้อย
    * **ทดสอบระบบและบันทึกประวัติ:** ทำการทดสอบรัน Unit Tests ผ่านครบถ้วน 31 เคส และสร้างคอมมิตใน Git `fix: resolve duplicate React keys and handle non-JSON API responses safely` เรียบร้อยแล้ว
  * **[Data Migration & Go-Live Setup — ✅ ย้ายข้อมูลสำเร็จ]:**
    * **ระงับการเขียนข้อมูลในระบบเดิม (Freeze Writes):** แจ้งเตือนพนักงานและเปลี่ยนสิทธิ์ Google Sheets ระบบเดิมเป็น View-Only ป้องกันการบันทึกรายการชนกันระหว่างย้ายข้อมูล
    * **ระบุไอดีฐานข้อมูลโครงการอย่างเป็นทางการ:**
      * สเปรดชีตเดิม (เก่า): `1tGLmk96A2XJDU2AycbR52Seehl5rB2jQiPc9LvsNSEI`
      * สเปรดชีต V2 (ใหม่): `1AL0AHGleUZ1UmS2N3QAg3vM0z_E1ymJ8Eg9FfUneAD0` (ตัวที่จะนำมาใช้ทำงานแทนตัวเดิมตัวจริง)
    * **รันสคริปต์โอนย้ายข้อมูล:**
      * การรันครั้งแรก (12:43:44 น.): ระบบแจ้งเตือนข้ามการทำงานเนื่องจากสคริปต์พยายามหาชื่อแผ่นงานแบบเก่า (`Tx_Submissions`, `Tx_Delegations`, `Tx_Feedback`)
      * การแก้ไข: ทำการปรับแก้สคริปต์ใน [scratch/migration_script.gs](file:///D:/[DEV] __WUS_Track_DB/scratch/migration_script.gs) ให้เป็นชื่อแผ่นงานจริง ได้แก่ `Tx_InternalRun`, `Tx_InternalSort`, และ `Tx_ExternalPost`
      * การรันครั้งที่สอง (12:47:39 น.): ทำการคัดลอกสคริปต์ที่แก้ไขแล้วไปรันบน Apps Script ของสเปรดชีตใหม่สำเร็จ 100% โดยย้ายข้อมูลได้ดังนี้:
        * **Tx_InternalRun**: 4,802 รายการ
        * **Tx_InternalSort**: 1,691 รายการ
        * **Tx_ExternalPost**: 1,767 รายการ
        * **รวมทั้งหมด**: 8,260 รายการ
    * **สถานะเอกสารและการ Commit:** ปรับปรุงคู่มือ [handover.md](file:///D:/[DEV] __WUS_Track_DB/docs/handover.md) และสารบัญวิกิ ให้ใช้ชื่อตาราง V2 ที่ถูกต้องตรงกัน พร้อมคอมมิตเก็บประวัติบน Git เรียบร้อยแล้ว
  * **[Apps Script JSDoc Annotations — ✅ เสร็จสมบูรณ์]:**
    * ดำเนินการเพิ่มคำอธิบายฟังก์ชันรูปแบบ JSDoc ให้กับฟังก์ชันหลังบ้านทั้งหมดใน [backend.gs](file:///D:/[DEV] __WUS_Track_DB/backend.gs) เพื่อระบุประเภทข้อมูลพารามิเตอร์ ผลลัพธ์ และรายละเอียดการทำงานอย่างชัดเจน ช่วยสนับสนุนการส่งมอบระบบ (Handover) และการสืบค้นโค้ดในตัว IDE ของ Apps Script
    * คอมมิตเก็บประวัติบน Git เรียบร้อยแล้ว
  * **[Auto-Backup Verification — ✅ สำรองข้อมูลสำเร็จ]:**
    * ผู้ใช้รันฟังก์ชันทดสอบการสำรองข้อมูลรายวันในระบบจริง (Manual Run) สำเร็จ ได้รับไฟล์สำรองข้อมูลธุรกรรม `Dcg_Smart_Service_Backup_2026-06-05_133636.xlsx` ลง Google Drive โฟลเดอร์ `Dcg Smart Service_Backup` ยืนยันว่าระบบเชื่อมต่อ DriveApp และสิทธิ์ต่าง ๆ สมบูรณ์พร้อมใช้งาน
* **สถานะความคืบหน้า:** ดำเนินการย้ายข้อมูลประวัติธุรกรรมทั้งหมด ปรับแต่งคำอธิบายโค้ด (Annotations) และทดสอบรันแบคอัพหลังบ้านสำเร็จสมบูรณ์ ระบบมีความพร้อมเต็มตัวในฝั่งฐานข้อมูล

---

### 📌 เฟสที่ 9: การตรวจสอบโค้ดและปรับปรุงเอกสารวิกิให้สอดคล้องกัน (Code Audit & Documentation Sync)
* **ช่วงเวลา:** 8 มิถุนายน 2569
* **การดำเนินการแก้ไข:**
  * **[Documentation Update]:** ปรับปรุงรายงาน `evaluation_report.md` ในส่วนของตารางคะแนน (Score Card) ให้สะท้อนค่าจริงของการแก้ไข และย้ายประเด็นจากหมวดข้อบกพร่อง (Weaknesses) ไปเป็นสถานะแก้ไขเสร็จสิ้นสมบูรณ์ (Resolved)
  * **[Security & WCAG Documentation Sync]:** ทำการอัปเดตเอกสาร `docs/vulnerabilities.md` และ `docs/wcag.md` โดยระบุสถานะและแนวทางการแก้ไขจริงที่ได้ดำเนินการลงไปในโค้ดของแต่ละหัวข้อ (SEC-01 ถึง SEC-09 และข้อกำหนดความเหลื่อมล้ำในการใช้งานทั่วไป)
  * **[Source Code Inspection & Audit]:** ตรวจสอบโค้ดจริงในโครงการเพื่อยืนยันความปลอดภัยและความถูกต้อง ได้แก่ ฟังก์ชัน OTP Expire Hoisting/OTP Reuse ใน `backend.gs`, โครงสร้างการหยุดกระจายสัญญาณ Event Bubbling บนคีย์บอร์ดใน `RunPage.tsx`, และโครงสร้าง Focus Trap/ARIA attributes ใน `ReceiptModal.tsx`
  * **[DOM Sync for Tabpanel]:** ทำการปรับแก้ไข `src/App.tsx` เพื่อห่อหุ้มคอมโพเนนต์เนื้อหาในแต่ละหน้าด้วยแท็ก `div` ที่มี `role="tabpanel"`, `id={`panel-${activeTab}`}`, และ `aria-labelledby` เพื่อแก้ไขข้อบกพร่อง `aria-controls` ไม่สอดคล้องกับโครงสร้าง DOM ของเบราว์เซอร์
  * **[Build & Test Verification]:** ทวนสอบระบบผ่านคำสั่ง `npm run test` ยืนยันผลการทดสอบ Unit Tests ผ่านทั้งหมด 100% (31/31 เคส) และ `npm run build` ฝั่งไคลเอนต์คอมไพล์สำเร็จไม่มีข้อผิดพลาด

### 📌 เฟสที่ 10: ระบบกู้คืนโครงสร้างหัวตารางอัตโนมัติ (Self-healing Schema for Master_Users)
* **ช่วงเวลา:** 8 มิถุนายน 2569
* **การดำเนินการแก้ไข:**
  * **[Self-healing Schema in backend.gs]:** พัฒนาและเพิ่มฟังก์ชัน `ensureMasterUsersHeadersSync(ss)` ใน [backend.gs](file:///D:/Dcg%20Smart%20Service/backend.gs) เพื่อแก้ไขข้อบกพร่องเรื่องตาราง `Master_Users` ใน Google Sheets ที่มีหัวคอลัมน์คลาดเคลื่อนหรือว่างเปล่า (Cell B1 และ C1 ว่างเปล่า) ซึ่งทำให้ระบบหลังบ้านอ่านอีเมลไม่ได้และแสดงข้อผิดพลาดสิทธิ์การใช้งาน
  * **[Auto-Repair Logic]:** 
    1. หากหัวตารางคอลัมน์ B ว่างเปล่า และแถวที่ 2 เป็นข้อมูลอีเมล ระบบจะเขียนหัวตารางเป็น `"Email"` ให้โดยอัตโนมัติ
    2. หากหัวตารางคอลัมน์ C ว่างเปล่า และไม่มีข้อมูลในคอลัมน์ C เลย (และ D1 คือ `"FullName"`) ระบบจะทำการลบคอลัมน์ C ทันทีเพื่อให้คอลัมน์ข้อมูลด้านขวา (FullName, Role, Status) ขยับมาทางซ้ายและเข้าที่อย่างถูกต้องโดยอัตโนมัติ
  * **[API Integration]:** นำฟังก์ชันนี้ไปทำงานร่วมกับ API endpoints หลักใน `getMetaData()`, `requestOTP()`, และ `verifyOTP()` เพื่อรับประกันว่าหัวตารางจะได้รับการแก้ไขทันทีที่มีการเชื่อมต่อหรือร้องขอรหัส OTP โดยผู้ดูแลระบบหรือผู้ใช้ไม่ต้องปรับแก้ตารางด้วยตนเอง
  * **[Build & Test Verification]:** ยืนยันผลการทดสอบ Unit Tests ผ่านทั้งหมด 100% (31/31 เคส) และคอมไพล์โปรเจกต์ผ่านเป็นผลสำเร็จ

### 📌 เฟสที่ 11: การตรวจสอบและดึงโครงสร้างตารางข้อมูลผ่าน Service Account (Google Sheets Connection Verification)
* **ช่วงเวลา:** 8 มิถุนายน 2569 (เย็น)
* **การดำเนินการแก้ไข:**
  * **[Database Connection & Inspection]:** พัฒนาสคริปต์ `read_schema.py` ดึงรายละเอียดโครงสร้างข้อมูล 10 แผ่นงานจากสเปรดชีต V2 (`1AL0AHGleUZ1UmS2N3QAg3vM0z_E1ymJ8Eg9FfUneAD0`) ได้สำเร็จ และสร้างรายงานโครงสร้างตารางข้อมูล [schema_report.md](file:///C:/Users/Admin/.gemini/antigravity-cli/brain/935b7028-c879-4585-9975-c6278f881f93/schema_report.md) สำหรับผู้ใช้งาน
  * **[OTP Flow Verification]:** พัฒนาสคริปต์ `test_otp_flow.py` และ `test_verify_otp.py` ทดสอบการจำลองเรียกขอรหัส OTP และตรวจสอบรหัสกับระบบ Live API จริง พบว่ารันผ่านได้สำเร็จ 100% และระบบบันทึกค่าลง `Tx_OTPStore` อย่างถูกต้อง (ขจัดปัญหาช่องว่างและการพิมพ์ตัวพิมพ์เล็ก-ใหญ่ผิดพลาด)





