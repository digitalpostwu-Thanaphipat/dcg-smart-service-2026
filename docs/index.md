# LLM Wiki (Persistent Wiki) - Index / สารบัญวิกิ

ยินดีต้อนรับสู่ระบบข้อมูลกลาง (Persistent Wiki) สำหรับโครงการ **WUS Track DB System** ซึ่งเป็นระบบบันทึกและติดตามข้อมูลงานประเมินผลและมอบหมายงาน (WUS Track) ที่ประมวลผลผ่านเว็บแอปพลิเคชันร่วมกับฐานข้อมูล Google Sheets

เอกสารในวิกินี้ได้รับการรวบรวมจากผลการวิเคราะห์และตรวจสอบด้านระบบโครงสร้างพื้นฐาน ความปลอดภัย และการเข้าถึงข้อมูล (Accessibility) โดยแบ่งเป็นหัวข้อหลักดังต่อไปนี้:

> **อัปเดตล่าสุด**: 4 มิถุนายน 2569 | สถานะ: Q0 เสร็จ ✅ | Migration Step 1-2 กำหนดวัน 5 มิ.ย. 2569

---

## 📂 สารบัญเอกสารทั้งหมด (Wiki Pages Index)

1. **[Chronological Audit Log / บันทึกประวัติการตรวจสอบย้อนหลัง](./log.md)**
   * ลำดับประวัติและกิจกรรมที่เกิดขึ้นในระบบ ตั้งแต่การรวบรวมและวิเคราะห์โครงสร้างข้อมูล ปัญหาการทำงาน ไปจนถึงผลสรุปการตรวจสอบความปลอดภัยและการเข้าถึง (WCAG)
2. **[System Architecture / สถาปัตยกรรมระบบ](./architecture.md)**
   * รายละเอียดโครงสร้างการจัดวางไฟล์ (File Structure) ปัญหาไฟล์หาย/ผิดตำแหน่ง (File Path Mismatch) ความแตกต่างระหว่าง API Payload ฝั่ง Frontend และ Backend รวมถึงวิเคราะห์สถานะ PWA (Progressive Web App)
3. **[Security Vulnerabilities & Remediation / ช่องโหว่ความปลอดภัยและการแก้ไข](./vulnerabilities.md)**
   * รายงานการประเมินช่องโหว่ความปลอดภัยอย่างละเอียด เช่น การบายพาสการล็อกอินฝั่งไคลเอนต์ (Client-side Login Bypass) ปัญหาข้อมูลรั่วไหล (Data Leaks) ความเสี่ยงการถูกฝังสูตรสูตรคำนวณ (Formula/CSV Injection) และปัญหาบันทึกข้อมูลล้มเหลวอย่างเงียบ (Silent Database Insertion Failure)
4. **[WCAG 2.2 AA Accessibility Audit / การประเมินและการปรับปรุงการเข้าถึงเพื่อคนพิการ](./wcag.md)**
   * ผลการตรวจสอบการเข้าใช้งานตามมาตรฐาน WCAG 2.2 ระดับ AA เช่น ปัญหาความต่างสี (Color Contrast Failure) ปัญหาการนำทางด้วยคีย์บอร์ดที่ไม่มีตัวบ่งชี้โฟกัส (Focus Outline Suppression) การขาด ARIA Attributes และการเชื่อมโยง Label-Input ที่ไม่สมบูรณ์ พร้อมแนวทางแก้ไข
5. **[Admin Handover & Maintenance Guide / คู่มือการส่งมอบงานและการดูแลระบบ](./handover.md)**
   * คำแนะนำการจัดเตรียมและ Deploy ระบบบน Google Sheets / Web App, รายการไฟล์ซอร์สโค้ดควบคุมระบบ
6. **[🏠 Architecture Analysis Report / รายงานวิเคราะห์สถาปัตยกรรม (v2.1)](./architecture_analysis_report.md)** ✅ *อัปเดตแล้ว*
   * รายงานวิเคราะห์สถาปัตยกรรม Frontend/Backend, Code Quality Issues (5 หมวด), Auto-Backup Plan, และ Roadmap โมดูล Q0-Q4+ (รวม 10 โมดูล) — Q0 เสร็จสมบูรณ์แล้ว
7. **[🚀 Migration Plan v2 / แผนย้ายระบบ Dev → Production](./migration_plan_v2.md)** 🔜 *กำหนดทำ 5 มิ.ย. 2569*
   * แผนงานย้ายระบบ 4 ขั้นตอน + Rollback Plan + **Section 6: แผนงานวันพรุ่งนี้** (Phase A-D Checklist)
8. **[ADR 0001: Auth Strategy](./adr/0001-auth-strategy.md)**
   * กลยุทธ์ Authentication (OTP + Google Sign-In + Mock Login)
9. **[ADR 0002: Offline-First DB](./adr/0002-offline-first-db.md)**
   * กลยุทธ์ Offline Database (IndexedDB + Zustand Persist), โครงสร้างลำดับการซิงค์ออฟไลน์ด้วย IndexedDB, และแนวทางการแก้ไขการซิงค์ข้อมูลล้มเหลว

---

## 🏛️ โครงสร้างหมวดหมู่ในระบบ (Entities, Concepts, and Sources)

### 1. Entities (เอนทิตีและองค์ประกอบทางกายภาพ)
* **Frontend App (`wus-track`)**: แอปพลิเคชัน React + TypeScript + Vite อยู่ในตำแหน่งโฟลเดอร์ `.`.
* **Backend Web App (`backend`)**: สคริปต์ Google Apps Script (GAS) อยู่ที่ตำแหน่ง `./backend.gs` ทำหน้าที่เป็น API Endpoint และเชื่อมต่อกับ Google Sheets
* **Spreadsheet Database**: ฐานข้อมูลตารางคำนวณ Google Sheets ที่เก็บข้อมูลสิทธิ์ผู้ใช้งาน (Users), งานประจำวัน (Submissions), เมสเซจเทมเพลต (Templates), การมอบหมายงาน (Delegations) และผลตอบรับ (Feedback)

### 2. Concepts (แนวคิดหลักและมาตรฐานทางเทคนิค)
* **Contract Integration (ความเข้ากันได้ของ API)**: การจัดวางโครงสร้าง JSON payload และโปรโตคอลการเรียกข้อมูล (GET/POST) เพื่อให้สื่อสารระหว่าง React และ Google Web App API สำเร็จ โดยไม่มีการเกิดปัญหา Silent failure (สำเร็จแต่ข้อมูลไม่เข้า)
* **Progressive Web App (PWA) Requirements**: มาตรฐานแอปพลิเคชันที่รองรับการใช้งานออฟไลน์ (Offline-first) โดยอาศัย Service Worker และ Web Manifest เพื่อรักษาเสถียรภาพเมื่อเครือข่ายขัดข้อง
* **Spreadsheet Formula Injection**: ช่องโหว่ทางความปลอดภัยที่ผู้ใช้กรอกข้อความที่เริ่มต้นด้วย `=`, `+`, `-`, `@` แล้วถูก Google Sheets ประมวลผลเป็นสูตรเชิงซ้อน ซึ่งอาจนำไปสู่การขโมยข้อมูลภายในตาราง (Data Exfiltration)
* **Web Content Accessibility Guidelines (WCAG) 2.2 AA**: เกณฑ์การพัฒนาเว็บแอปพลิเคชันให้สามารถใช้งานได้ครอบคลุมผู้ทุพพลภาพ รวมถึงผู้ใช้ที่สั่งงานด้วยคีย์บอร์ดอย่างเดียวหรือเครื่องอ่านหน้าจอ (Screen Reader)

### 3. Sources (แหล่งที่มาและเอกสารอ้างอิง)
* **Frontend Codebase**: `.\src\assets\App.tsx` และ `index.html`
* **Backend Codebase**: `./backend.gs`
* **Audit Artifacts (รายงานดั้งเดิม)**:
  * Report 1: `./.agents\explorer_m1\handoff.md` (วิเคราะห์โครงสร้างแอปพลิเคชันและ API Contracts)
  * Report 2: `./.agents\explorer_m2\handoff.md` (ประเมินช่องโหว่ความปลอดภัยและความสะดวกในการเข้าถึง WCAG)
* **Standards Reference**:
  * [ADR-TEMPLATE.md](./ADR-TEMPLATE.md) - โครงสร้างบันทึกการตัดสินใจทางสถาปัตยกรรม (Architecture Decision Record)
  * [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - รายการตรวจสอบความปลอดภัย
