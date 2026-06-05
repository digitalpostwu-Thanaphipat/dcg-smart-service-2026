# 📘 คู่มือการส่งมอบงานและการพัฒนาต่อ (Developer Handover Guide)

เอกสารฉบับนี้จัดทำขึ้นเพื่อสรุปข้อมูลสำคัญในการพัฒนาต่อสำหรับระบบ **DCG Smart Service** โดยเน้นการพัฒนาและปรับปรุง UI/UX ล่าสุด รวมถึงกระบวนการทำ E2E Testing ด้วย Playwright เพื่อให้ผู้พัฒนาคนถัดไปสามารถทำงานต่อได้ทันทีโดยไม่มีรอยต่อ

---

## 🧭 ภาพรวมระบบและฟีเจอร์ล่าสุด (Project Overview & Latest Features)
ระบบได้รับการปรับปรุงหน้าตรวจสอบสถานะเอกสารสาธารณะ (**Public Tracking**) ให้มีความยืดหยุ่นสูง รองรับทั้งการเข้าใช้ผ่าน Mobile และ Desktop โดยคงเอกลักษณ์และมาตรฐานการออกแบบดังนี้:
1. **Date Range Preset Buttons**: เพิ่มปุ่มเลือกช่วงเวลาปฏิทินแบบรวดเร็ว ("วันนี้", "เดือนนี้", "ปีงบประมาณ") ใต้ปฏิทิน โดยมีสถานะไฮไลต์ (Active Highlight) เพื่อบอกโหมดที่ใช้งานอยู่
2. **UI Polish & Accessibility**: กำจัดรูปแบบดีไซน์ที่เป็น AI Anti-patterns (เช่น สีไล่เฉดสีม่วง-น้ำเงินพาสเทลแบบเกร่อ, สีลากแถบคลุมที่ไม่คมชัด) และปรับปรุง Contrast ในโหมดมืดและสว่างให้ผ่านเกณฑ์ความคมชัด (WCAG 2.1 AA)
3. **E2E Testing**: สร้างสคริปต์การทดสอบความถูกต้องของการทำงานผ่าน Microsoft Playwright โดยรันแบบดักข้อมูล (Request Mocking) ทำให้รันแบบออฟไลน์ได้ 100%

---

## 📂 โครงสร้างส่วนประกอบสำคัญ (Core Architecture & Key Files)

### 1. [PublicTrackView.tsx](file:///D:/%5BDEV%5D%20__WUS_Track_DB/src/components/auth/PublicTrackView.tsx)
* **ตรรกะจัดการปุ่ม Preset วันที่**:
  * ใช้ฟังก์ชันช่วยเหลือ `formatDateLocal` เพื่อแปลงวัตถุ `Date` เป็นสตริงในรูปแบบ `YYYY-MM-DD` ตามเขตเวลาท้องถิ่น ช่วยแก้ปัญหา Timezone Offset (เช่น วันที่ถอยหลังไปหนึ่งวันเนื่องจากเกณฑ์เวลา UTC)
  * ตัวแปรตรวจสอบสถานะแอ็กทีฟ:
    * `isToday`: เริ่มต้นและสิ้นสุดในวันปัจจุบัน
    * `isMonth`: เริ่มต้นตั้งแต่วันแรกของเดือนปัจจุบัน ถึงวันปัจจุบัน
    * `isFiscal`: ครอบคลุมตั้งแต่ต้นปีงบประมาณของไทย (วันที่ 1 ตุลาคม ของปีงบประมาณนั้น ถึงวันที่ 30 กันยายน ของปีงบประมาณถัดไป)
* **การแปลงโครงสร้างข้อมูล API**:
  * รองรับทั้งโครงสร้างข้อมูลแบบแยกหมวดหมู่ล่วงหน้า (Structured Data: `run`, `sort`, `ext`) และโครงสร้างแบบอาเรย์แบนราบ (Flat Array) ซึ่งโค้ดจะนำมาจัดประเภทเป็นแท็บงานภายในองค์กร, งานคัดแยกไปรษณีย์ภัณฑ์, และงานนำส่งไปรษณีย์ภายนอกโดยอัตโนมัติ

### 2. [SmartSearchInput.tsx](file:///D:/%5BDEV%5D%20__WUS_Track_DB/src/components/common/SmartSearchInput.tsx)
* ทำหน้าที่เป็นช่องรับข้อมูลอัจฉริยะเพื่อค้นหาและแนะนำชื่อหน่วยงานตามตัวอักษร
* **ข้อจำกัดสำคัญ**: ฝั่งข้อมูลเข้า (Input Prop `departments`) จะต้องเป็นออบเจกต์ที่สอดคล้องตามอินเตอร์เฟส `Department` ใน `src/types/index.ts`:
  ```typescript
  export interface Department {
      DeptID: string;
      DeptName: string;
      RouteGroup: string;
      Building?: string;
  }
  ```
  *(ระวังอย่าส่งออบเจกต์แบบอื่น เช่น `{ name: '...' }` เข้ามา มิฉะนั้นฟังก์ชัน `.toLowerCase()` บนฟิลด์ `DeptName` จะเกิดข้อผิดพลาดและทำให้ React แอปพลิเคชันแครช)*

### 3. [App.tsx](file:///D:/%5BDEV%5D%20__WUS_Track_DB/src/App.tsx) & [MainLayout.tsx](file:///D:/%5BDEV%5D%20__WUS_Track_DB/src/components/layout/MainLayout.tsx)
* ควบคุมเรื่อง Global Theme (Light/Dark mode) ผ่าน Root class `dark` บนแท็ก `<html>`
* นำสีส้มหลักประจำแบรนด์ (`bg-orange-500`) และสีม่วงทึบที่ออกแบบโดยมนุษย์มาทดแทนสีม่วงไล่น้ำเงิน เพื่อสร้างภาพลักษณ์ที่ดูพรีเมียมและคมชัดสูง

---

## 🎭 ระบบทดสอบอัตโนมัติ (E2E Playwright Setup)

ไฟล์สคริปต์สำหรับการทดสอบถูกเก็บไว้ที่:
📍 [playwright-test-sanity.js](file:///C:/Users/Admin/.gemini/antigravity-cli/scratch/playwright-test-sanity.js)

### การทำงานของสคริปต์:
* ดักจับและยกเลิกเบราว์เซอร์แจ้งเตือน (Dialog alert) โดยอัตโนมัติ
* ติดตาม console error ฝั่งลูกค้าผ่าน Event `pageerror` เพื่อดูว่ามี Javascript Crash หรือไม่
* ดักจับ (Intercept) ข้อมูล POST ทุกคำสั่งที่ยิงไปยัง Google Apps Script เพื่อดึงข้อมูล `getMetaData` และ `publicSearch` จากนั้นคืนค่าด้วย Mock Data ที่มีโครงสร้างตรงตามโมเดลระบบ ทำให้การทดสอบสะดวกรวดเร็วและเสถียร

### วิธีการรันสคริปต์ทดสอบ:
1. เปิด Command Line เข้าสู่โฟลเดอร์ของ Playwright Skill:
   ```powershell
   cd .\.gemini\skills\playwright-skill
   ```
2. รันสคริปต์โดยใช้ตัวสั่งการ Universal Runner:
   ```powershell
   node run.js .\.gemini\antigravity-cli\scratch\playwright-test-sanity.js
   ```

---

## 🛡️ เครื่องมือตรวจสอบคุณภาพ UI/UX (Impeccable Detect)
สำหรับการพัฒนาองค์ประกอบหน้าตาใหม่ ๆ ควรตรวจสอบให้แน่ใจว่าไม่มีลักษณะที่เป็น AI Anti-patterns ตกค้างในซอร์สโค้ด:
```bash
npx impeccable detect src/
```
*เกณฑ์การตรวจสอบจะเน้นเรื่องการใช้สี, ความถูกต้องของฟอร์ม (Labels & ARIA), และความเข้ากันได้ของการแสดงผลทั้งในโหมดสว่างและมืด*

---

## 💡 แนวทางการพัฒนาต่อที่แนะนำ (Next Steps)
1. **การรวมระบบเบื้องหลังจริง (Production Integration)**:
   * ทำการทดสอบโดยสลับจากการใช้ Mock API ไปเป็นการเชื่อมต่อกับหน้าสคริปต์ Apps Script จริงเพื่อทดสอบประสิทธิภาพเวลาดึงข้อมูลในเครือข่ายที่มีความหน่วง (Latency)
2. **การขยายฟีเจอร์ติดตามภายนอก (External Tracking)**:
   * เพิ่มปุ่มแสดงข้อมูลและลิงก์ติดตามจริง (Tracking Link) สำหรับค่ายไปรษณีย์ไทยและบริษัทขนส่งเอกชนในส่วนประวัติไปรษณีย์ภายนอก (ข้อมูลแสดงฟิลด์ `tracking` ในตารางที่เรนเดอร์)
3. **การทดสอบความเข้ากันได้ออฟไลน์ (Offline/PWA)**:
   * ประเมินประสิทธิภาพการแคชหน้าเว็บผ่าน Service Workers และตัวจัดเก็บข้อมูลสำรองภายใน (IndexedDB) เมื่ออยู่ในจุดออฟไลน์แบบไม่มีสัญญาณ
