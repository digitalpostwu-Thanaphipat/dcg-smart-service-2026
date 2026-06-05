# System Architecture & Technical Specifications / สถาปัตยกรรมระบบและข้อกำหนดทางเทคนิค

เอกสารฉบับนี้อธิบายโครงสร้างระบบ (System Architecture) ของ **WUS Track DB System** ทั้งในส่วนของสถาปัตยกรรมระดับสูง (High-Level Architecture) ความผิดพลาดของไฟล์และไดเรกทอรี (File Structure Mismatches) การประเมินสถานะ PWA และรายละเอียดโครงสร้างการรับส่งข้อมูลระหว่างกัน (API Contract Structures)

---

## 🏛️ สถาปัตยกรรมระบบโดยรวม (System Overview)

ระบบ WUS Track DB ทำงานร่วมกันระหว่างสองระบบหลัก (Two-tier Client-Server Architecture):

```
       [ React Frontend App ] (PWA Client)
                 │
                 │ HTTP (GET/POST)
                 ▼
     [ Google Apps Script (GAS) ] (API Router / Code.gs)
                 │
                 │ Google Spreadsheet API
                 ▼
       [ Google Sheets DB ] (Database & Tables)
```

1. **Frontend Client (React.js)**: พัฒนาด้วย React (TypeScript) และคอมไพล์ผ่าน Vite โดยใช้ Tailwind CSS ในการจัดหน้าแสดงผล ทำหน้าที่หลักเป็น User Interface ให้พนักงานลงชื่อเข้าใช้ กรอกรายละเอียดงานประจำวัน (เช่น Run, Sort, Ext) และตรวจสอบการมอบหมายงาน
2. **Backend Server (Google Apps Script - Web App)**: ทำหน้าที่เป็น REST API Endpoint ผ่านฟังก์ชัน `doGet(e)` และ `doPost(e)` คอยแปลงข้อมูลและเขียนลงตารางสเปรดชีต โดยมีการควบคุมการแย่งกันเขียนทับด้วยระบบล็อกของกูเกิล (`LockService`)
3. **Database Layer (Google Sheets)**: เป็นพื้นที่จัดเก็บข้อมูลถาวร ประกอบด้วยตารางต่าง ๆ เช่น ข้อมูลรายชื่อพนักงาน ข้อมูลกิจกรรมประจำวัน เทมเพลต และตารางบันทึกสถานะการมอบหมายงาน

### 📦 การพึ่งพาไลบรารีภายนอก (Dependencies Audit)
* **Better Auth (เวอร์ชัน 1.6.11):** โครงการมีการเรียกใช้งานไลบรารี `better-auth` เวอร์ชัน `^1.6.11` ซึ่งยังคงเป็นรุ่น Major ต่ำ (Beta/Early versions) อาจมีจุดเปลี่ยนผ่าน (Breaking Changes) หรือการขาดฟีเจอร์สำคัญด้านความปลอดภัยบางประการในระยะยาวเมื่ออัปเกรด ควรมุ่งเน้นการทวนสอบเสถียรภาพหรือพิจารณาใช้ OAuth / OIDC ที่เป็นมาตรฐานความปลอดภัยสูงของ Google Identity Services ตรง ๆ ตามที่ติดตั้งระบบเพิ่มเติมไว้

---

## 📂 ปัญหาโครงสร้างไฟล์ที่ขัดกัน (File Structure & Path Mismatches)

ในทางปฏิบัติ การจัดเรียงไฟล์ของโปรเจกต์ฝั่ง Frontend ในไดเรกทอรี `.` มีความไม่สอดคล้องกันทำให้ไม่สามารถคอมไพล์ (Build) ได้:

### 1. ตำแหน่งไฟล์ทางกายภาพขัดแย้งกับ Entry Point (`index.html`)
* **ปัญหา:** ใน `.\index.html` บรรทัดที่ 13 ระบุจุดนำเข้าโค้ดเป็น:
  ```html
  <script type="module" src="/src/main.tsx"></script>
  ```
  แต่ความจริงไม่มีโฟลเดอร์ `/src/main.tsx` อยู่ตรงระดับราก ไฟล์ดังกล่าวรวมถึง `App.tsx` ถูกย้ายไปอยู่ในโฟลเดอร์สินทรัพย์ `src/assets/main.tsx` และ `src/assets/App.tsx`
* **ผลกระทบ:** Vite dev server จะส่งคืนข้อผิดพลาด 404 (Entry file not found) และการทำ build จะล้มเหลวทันที

### 2. ไฟล์สไตล์ชีตขาดหาย (Missing CSS)
* **ปัญหา:** ไฟล์สคริปต์หลัก `.\src\assets\main.tsx` บรรทัดที่ 3 มีการนำเข้าไฟล์ CSS สำหรับตกแต่ง:
  ```typescript
  import './index.css'
  ```
  แต่ไม่มีไฟล์ `index.css` ปรากฏอยู่ในพื้นที่พัฒนาเลย
* **ผลกระทบ:** ตัวคอมไพเลอร์ TypeScript/Vite จะหยุดการทำงานเนื่องจากหาโมดูลไฟล์สไตล์ไม่พบ

### 3. ไฟล์การตั้งค่าขาดหาย (Missing Configuration Files)
* **ปัญหา:** ไฟล์ `App.tsx` บรรทัดที่ 3 มีการนำเข้าค่าคงที่:
  ```typescript
  import { API_URL, APP_NAME } from './config';
  ```
  แต่ไม่พบไฟล์ `src/assets/config.ts` หรือ `config.js` ในระบบ
* **ปัญหาเพิ่มเติม:** โปรเจกต์ไม่มีไฟล์ `tsconfig.json` และ `vite.config.ts` ในระดับโฟลเดอร์ราก แม้ว่าจะมีการประกาศใช้ TypeScript และ Vite ใน `package.json` ก็ตาม
* **ผลกระทบ:** ทำให้ compiler ไม่สามารถรับรู้ค่าคอนฟิกูเรชันพื้นฐานและตำแหน่งเชื่อมต่อ API ส่วผลให้ไม่สามารถรันคำสั่ง `npm run build` หรือ `npm run dev` ได้

---

## 🌐 โครงสร้างสัญญาข้อมูล API (API Request-Response Structures)

พบช่องว่างและความไม่เข้ากันของประเภทข้อมูล (Contract Mismatches) ระหว่าง Frontend และ Backend ใน 3 จุดสำคัญ:

### 1. ปัญหาการดึงข้อมูลเริ่มต้น (Metadata Fetch Lock)
* **การส่งคำขอฝั่ง Frontend (`App.tsx`):**
  Frontend จะเข้าสู่สถานะหมุนรอข้อมูลเริ่มต้น (Loading Spinner) โดยเรียก POST API ดังนี้:
  ```typescript
  // ส่งคำขอเริ่มต้นโหลดข้อมูล
  const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getMetaData' })
  });
  ```
* **การรับและประมวลผลฝั่ง Backend (`Code.gs`):**
  ฟังก์ชัน `doPost(e)` ในแบ็กเอนด์ ไม่มีการดักจับแอ็กชัน `"getMetaData"`:
  ```javascript
  function doPost(e) {
    ...
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;

    if (action === "feedback") return saveFeedback(postData);
    if (action === "delegation") return saveDelegation(postData);

    // หากไม่ตรงเงื่อนไขใดเลย จะหลุดเข้าบันทึกข้อมูลและส่งค่ากลับแบบนี้เสมอ
    return saveWorkData(postData);
  }
  ```
  สคริปต์จะพยายามเอาคำขอไปเขียนลงสเปรดชีต จากนั้นส่งกลับด้วยข้อความ `{ status: "success", message: "บันทึกสำเร็จ" }` โดยไม่มีการแนบชุดข้อมูลที่แอปต้องการกลับไปเลย
* **ข้อกำหนดที่ถูกต้อง:** แบ็กเอนด์เก็บฟังก์ชันให้ข้อมูล Metadata นี้ไว้ที่ `doGet(e)` ซึ่งเป็นฝั่ง HTTP GET:
  ```javascript
  function doGet(e) {
    var action = (e && e.parameter) ? e.parameter.action : null;
    if (!action) {
      return ok({
        workTypes: populateWorkTypes(),
        users: getAllUsers(),
        submissions: getTodaySubmissions(),
        templates: getTemplates(),
        delegations: getActiveDelegations(),
        status: "success"
      });
    }
  ```
  ความไม่สอดคล้องกันนี้ทำให้แอปพลิเคชันฝั่งผู้ใช้ไม่สามารถโหลดข้อมูลผู้ใช้หรือประเภทงานได้ และจอดำค้างอยู่ที่สถานะกำลังโหลดตลอดกาล

### 2. ปัญหาตัวพิมพ์ใหญ่-เล็กในแบบจำลองพนักงาน (Entity Properties Mismatch)
* **Frontend User Model (`App.tsx`):**
  โครงสร้างที่ผู้พัฒนาออกแบบไว้:
  ```typescript
  interface User {
      UserID: string;
      Email: string;
      FullName: string;
      Role: string;
  }
  ```
  การดึงข้อมูลล็อกอินใช้คีย์พิมพ์ใหญ่:
  ```typescript
  const user = masterData.users.find(u => u.Email.toLowerCase() === email.toLowerCase());
  ```
* **Backend User Response (`Code.gs`):**
  ข้อมูลที่เซิร์ฟเวอร์ส่งกลับจริงผ่านฟังก์ชัน `getAllUsers()`:
  ```javascript
  results.push({
    code: r[0],        // ถูกดึงเข้าสู่ระบบในชื่อ UserID?
    name: r[1],        // ไม่ตรงกับ FullName
    role: r[2],        // ตัวพิมพ์เล็ก
    department: r[3] || "",
    status: r[4] || "active",
    email: r[5] || ""  // ไม่ตรงกับ Email
  });
  ```
* **ผลกระทบ:** เนื่องจากฟิลด์จากเซิร์ฟเวอร์ใช้ตัวพิมพ์เล็ก (`email`, `name`) การเรียกใช้ `u.Email.toLowerCase()` บน Frontend จะทำให้โปรแกรมพัง (Crash) เนื่องจาก `u.Email` มีค่าเป็น `undefined`

### 3. การวางข้อมูลลง Payload ซ้อน (Payload Wrapping Mismatch)
* **Frontend Format (`App.tsx`):**
  Frontend บรรจุฟิลด์ข้อมูลฟอร์มลงภายใต้คีย์ย่อยชื่อ `payload` และใช้การส่งข้ามไซต์ที่ไม่ได้ตั้งค่า CORS (`no-cors`):
  ```typescript
  const payload = { ...formData, staffEmail: currentUser?.Email };
  await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, payload })
  });
  ```
* **Backend Format (`Code.gs`):**
  แบ็กเอนด์แกะข้อมูลและดึงค่าออกจากรากแรกของ JSON (Top-level properties):
  ```javascript
  function saveWorkData(postData) {
    var dateStr = postData.date;
    var employeeCode = postData.employeeCode;
    var workData = postData.workData; // ต้องการอ็อบเจกต์ T-code
    var problem = postData.problem || "";
  ```
* **ผลกระทบ:** ค่า `postData.workData` มีค่าเป็น `undefined` ส่งผลให้ระบบล้มเหลวขณะเขียนข้อมูลเข้าตาราง (และเนื่องจากใช้งานส่งข้อมูลแบบ `no-cors` จึงไม่มีการแจ้งเตือนสเตตัสข้อผิดพลาดกลับมายัง Frontend ทำให้ผู้ใช้รับข้อความว่าส่งงานสำเร็จ แต่ข้อมูลในสเปรดชีตว่างเปล่า)

---

## 📱 สถานะระบบแอปพลิเคชันแบบออฟไลน์ (PWA State or Lack Thereof)

จากการตรวจสอบระบบในปัจจุบัน พบว่า **ระบบไม่มีการพัฒนาคุณสมบัติ PWA หรือฟีเจอร์สำหรับรองรับสภาวะออฟไลน์เลยแม้แต่น้อย (Zero implementation of PWA and Offline Capability)**:

1. **ไม่มีการเก็บไฟล์ออฟไลน์ (No Service Worker):**
   * ไม่มีสคริปต์ Service Worker ใด ๆ ในโปรเจกต์เพื่อดักจับ HTTP requests หรือเก็บ Cache สำหรับทรัพยากรหน้าเว็บ (HTML, JS, CSS)
   * ไม่มีการลงทะเบียน Service worker ในหน้า `index.html` หรือ `main.tsx`
2. **ไม่มีไฟล์ตั้งค่าแอปพลิเคชันมือถือ (No Web Manifest):**
   * โฟลเดอร์สาธารณะ `.\public` มีสถานะว่างเปล่า ไม่มีไฟล์ `manifest.json` หรือรูปภาพไอคอนใด ๆ สำหรับกำหนดค่าการแสดงผลแบบ Standalone บนโทรศัพท์มือถือ
3. **ไม่มีการเก็บข้อมูลเมื่อไม่มีเน็ต (No Offline Sync/Fallback Cache):**
   * หน้าจอลงชื่อเข้าใช้และส่งข้อมูลใน `App.tsx` เป็นการเรียกใช้งาน API ตรง ๆ ผ่านเครือข่าย หากระบบขาดการเชื่อมต่ออินเทอร์เน็ต แอปพลิเคชันจะหยุดทำงาน ค้างอยู่ในหน้าโหลด หรือพ่นข้อผิดพลาด alert เปล่าออกมากวนใจผู้ใช้ ข้อมูลที่ผู้ใช้กรอกค้างไว้จะหายไปทั้งหมดโดยไม่มีระบบสำรอง (เช่น `localStorage` หรือ `IndexedDB` queue) คอยช่วยเหลือ
4. **ไม่มีระบบสถาปัตยกรรม SSR/SSG:**
   * ระบบไม่มีการเรนเดอร์ในฝั่งเซิร์ฟเวอร์ (Server-Side Rendering) หรือคอมไพล์แบบ Static Site Generation ส่งผลให้แอป PWA ทำงานแบบออฟไลน์ได้เพียงบางส่วนเท่านั้น (Partial Offline Capability) และต้องพึ่งพา Client-side Routing ทั้งหมด

---

## 🧪 การวิจัยโครงสร้างพื้นฐานด้านการทดสอบและการจัดส่ง (Testing & CI/CD Gaps)

จากการตรวจสอบระบบ พบว่าโครงการไม่มีความพร้อมด้านการทดสอบและทวนสอบความถูกต้อง (Testing & Verification Score: 5/10) ดังนี้:

1. **ขาดโครงสร้าง Unit Test / Integration Test:**
   * ไม่มีการจัดตั้งเฟรมเวิร์กทดสอบ (เช่น Vitest หรือ Jest ร่วมกับ React Testing Library) ทั้งที่มีฟังก์ชันซับซ้อนในตัวระบบ (เช่น authentication flows, batch writing, local query-filter, IndexedDB sync logic)
2. **ขาดการทดสอบจำลองเบราว์เซอร์จริง (E2E Testing):**
   * แม้เอกสารแนะนำอย่าง `GEMINI.md` จะพูดถึงการใช้งาน `playwright-tester` แต่ไม่พบสคริปต์ Playwright E2E Test สำหรับทดสอบสถานการณ์ Staff Login/Form Submission ในโฟลเดอร์โครงการจริง
3. **ไม่มีระบบส่งมอบอัตโนมัติ (No CI/CD Pipeline):**
   * ไม่มีไฟล์กำหนดค่า Pipeline (เช่น GitHub Actions หรือ GitLab CI) สำหรับรันเทสเคสอัตโนมัติ ตรวจสอบคุณภาพโค้ด และสั่ง Build/Deploy ไปยัง Web Hosting หรือ Apps Script เมื่อเกิดการเปลี่ยนแปลงซอร์สโค้ด

---

## 🎨 จุดที่ขาดในระบบการออกแบบ (Design System Gaps in `DESIGN.md`)

แม้ว่าจะมีเอกสารระบุหลักการและระบบของแบรนด์ไว้ที่ `DESIGN.md` แต่ยังพบรายละเอียดที่ไม่ครบถ้วนสำหรับการทำงานจริง:

1. **ไม่ระบุค่า Tokens ของแต่ละธีม:**
   * มีการพูดถึงข้อกำหนดการรองรับ Dark/Light Mode แต่ไม่ได้ระบุค่าตัวแปรรหัสสีจริง (Theme Color Tokens) ของแต่ละโหมดไว้ให้ชัดเจนสำหรับนักพัฒนา
2. **ขาด Responsive Breakpoints:**
   * เอกสารไม่มีการกำหนดขนาดหน้าจอนำทางและ Breakpoints สำหรับรองรับความเข้ากันได้บนมือถือและแท็บเล็ต
3. **Component Variants ไม่ชัดเจน:**
   * ขาดการออกแบบตัวแปรย่อย (Size, State เช่น Hover, Active, Disabled) ของคอมโพเนนต์หลักต่าง ๆ ทำให้การนำไปพัฒนามีความคลาดเคลื่อน

---

## 🔗 ลิงก์ที่เกี่ยวข้อง (Cross-References)
* **[สารบัญวิกิ](./index.md)** - กลับไปหน้าสารบัญหลัก
* **[บันทึกการตรวจสอบย้อนหลัง](./log.md)** - ดูไทม์ไลน์และประวัติการพัฒนา
* **[รายงานความปลอดภัย](./vulnerabilities.md)** - ดูรายละเอียดปัญหาช่องโหว่ทางระบบและข้อแนะนำการแก้
* **[รายงานการเข้าถึงระบบ (WCAG)](./wcag.md)** - ดูรายละเอียดและข้อผิดพลาดตามหลักสากลในการเข้าใช้งาน
