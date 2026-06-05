/**
 * DCG Smart Service - Data Migration Script (Production Go-Live)
 * วัตถุประสงค์: ย้ายข้อมูลธุรกรรมทั้งหมดจาก Google Sheets ตัวเก่า (Production เดิม) เข้าสู่สเปรดชีตโครงสร้างใหม่ (V2)
 *
 * วิธีใช้งาน:
 * 1. เปิด Google Apps Script ของสเปรดชีตตัวใหม่ (หรือระบบใหม่)
 * 2. คัดลอกโค้ดนี้ไปวางในไฟล์สคริปต์ใหม่ (เช่น ตั้งชื่อว่า Migration.gs)
 * 3. แทนที่ตัวแปร OLD_SPREADSHEET_ID ด้วย ID ของสเปรดชีตตัวเดิมของคุณ
 * 4. เลือกฟังก์ชัน runDataMigration และกดคลิก Run (เรียกใช้งาน)
 */

var OLD_SPREADSHEET_ID = "1tGLmk96A2XJDU2AycbR52Seehl5rB2jQiPc9LvsNSEI"; // ID ของสเปรดชีตระบบเก่าที่กำลังใช้งานจริง

function runDataMigration() {
  var ssNew = SpreadsheetApp.getActiveSpreadsheet();
  var ssOld;
  
  try {
    ssOld = SpreadsheetApp.openById(OLD_SPREADSHEET_ID);
  } catch (e) {
    Logger.log("❌ ไม่สามารถเปิดสเปรดชีตตัวเก่าได้ กรุณาตรวจสอบ ID และสิทธิ์การเข้าถึง: " + e.toString());
    throw new Error("เปิดสเปรดชีตเดิมล้มเหลว");
  }
  
  Logger.log("🏁 เริ่มต้นการย้ายข้อมูลจากสเปรดชีตเดิม...");
  
  // 1. ย้ายข้อมูลการเดินรถรับเอกสารภายใน (Tx_InternalRun -> Tx_InternalRun)
  migrateSheetData(ssOld, "Tx_InternalRun", ssNew, "Tx_InternalRun", function(oldRow, idx) {
    return [
      oldRow.TxID || generateTxID("RUN", oldRow.Timestamp, idx),
      oldRow.Timestamp ? new Date(oldRow.Timestamp) : new Date(),
      oldRow.DeptName || oldRow.Department || "ไม่ระบุหน่วยงาน",
      oldRow.Route || "ไม่ระบุสาย",
      oldRow.Round || "รอบทั่วไป",
      parseInt(oldRow.ItemCount) || parseInt(oldRow.Quantity) || 0,
      oldRow.Note || "",
      oldRow.StaffEmail || oldRow.EmployeeEmail || "system-migration@wu.ac.th"
    ];
  });
  
  // 2. ย้ายข้อมูลงานคัดแยกไปรษณีย์ภัณฑ์ (Tx_InternalSort -> Tx_InternalSort)
  migrateSheetData(ssOld, "Tx_InternalSort", ssNew, "Tx_InternalSort", function(oldRow, idx) {
    var normal = parseInt(oldRow.NormalCount) || parseInt(oldRow.RegularCount) || 0;
    var register = parseInt(oldRow.RegisterCount) || 0;
    var privateCount = parseInt(oldRow.PrivateCount) || 0;
    var total = parseInt(oldRow.Total) || (normal + register + privateCount);
    
    return [
      oldRow.TxID || generateTxID("SORT", oldRow.Timestamp, idx),
      oldRow.Timestamp ? new Date(oldRow.Timestamp) : new Date(),
      oldRow.DeptName || oldRow.Department || "ไม่ระบุหน่วยงาน",
      normal,
      register,
      privateCount,
      total,
      oldRow.Note || "",
      oldRow.StaffEmail || oldRow.EmployeeEmail || "system-migration@wu.ac.th"
    ];
  });
  
  // 3. ย้ายข้อมูลงานนำส่งไปรษณีย์ภายนอก (Tx_ExternalPost -> Tx_ExternalPost)
  migrateSheetData(ssOld, "Tx_ExternalPost", ssNew, "Tx_ExternalPost", function(oldRow, idx) {
    return [
      oldRow.TxID || generateTxID("EXT", oldRow.Timestamp, idx),
      oldRow.Timestamp ? new Date(oldRow.Timestamp) : new Date(),
      oldRow.RequestingDept || oldRow.DeptName || oldRow.Department || "ไม่ระบุหน่วยงาน",
      oldRow.ServiceType || oldRow.ServiceName || "ไม่ระบุประเภท",
      parseFloat(oldRow.Cost) || parseFloat(oldRow.Price) || 0,
      parseInt(oldRow.ItemCount) || parseInt(oldRow.Quantity) || 1,
      oldRow.TrackingNo || oldRow.TrackingNumber || "-",
      oldRow.FundSource || oldRow.BudgetSource || "งบประมาณมหาวิทยาลัย",
      oldRow.StaffEmail || oldRow.EmployeeEmail || "system-migration@wu.ac.th"
    ];
  });
  
  Logger.log("🎉 กระบวนการโอนย้ายข้อมูลเสร็จสิ้นสมบูรณ์ 100%!");
}

// ฟังก์ชันจำลองการสร้าง TxID ย้อนหลังเพื่อให้ข้อมูลเก่ามีไอดีไม่ซ้ำกัน
function generateTxID(prefix, timestamp, index) {
  var timePart = "";
  if (timestamp) {
    var d = new Date(timestamp);
    var y = d.getFullYear().toString().slice(-2);
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    timePart = y + m + day;
  } else {
    timePart = "HIST";
  }
  return "TX-" + prefix + "-" + timePart + "-" + String(index).padStart(5, '0');
}

// ฟังก์ชันประมวลผลข้อมูลและบันทึก
function migrateSheetData(ssOld, oldSheetName, ssNew, newSheetName, mapperFunction) {
  var oldSheet = ssOld.getSheetByName(oldSheetName);
  var newSheet = ssNew.getSheetByName(newSheetName);
  
  if (!oldSheet) {
    Logger.log("⚠️ ไม่พบแผ่นงานชื่อ " + oldSheetName + " ในระบบเดิม ข้ามการทำงาน...");
    return;
  }
  
  if (!newSheet) {
    Logger.log("⚠️ ไม่พบแผ่นงานชื่อ " + newSheetName + " ในระบบใหม่ ข้ามการทำระบบ...");
    return;
  }
  
  var oldObjects = getSheetDataAsObjects(oldSheet);
  if (oldObjects.length === 0) {
    Logger.log("ℹ️ ไม่พบแถวข้อมูลธุรกรรมย้อนหลังในชีต " + oldSheetName + " ข้ามการโอนย้าย...");
    return;
  }
  
  var newHeaders = newSheet.getDataRange().getValues()[0];
  var rowsToWrite = [];
  
  for (var i = 0; i < oldObjects.length; i++) {
    var oldRow = oldObjects[i];
    var mappedRow = mapperFunction(oldRow, i + 1);
    rowsToWrite.push(mappedRow);
  }
  
  // บันทึกแบบกลุ่ม (Batch write)
  var lastRow = newSheet.getLastRow();
  newSheet.getRange(lastRow + 1, 1, rowsToWrite.length, newHeaders.length).setValues(rowsToWrite);
  Logger.log("✅ โอนย้ายข้อมูลจาก " + oldSheetName + " ไปยัง " + newSheetName + " สำเร็จ: " + rowsToWrite.length + " รายการ");
}

// ดึงข้อมูลแถวและสร้างเป็น Objects (ตามหัว Header ในแถวแรก)
function getSheetDataAsObjects(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length <= 1) return [];
  
  var headers = values[0];
  var objects = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      if (header) {
        obj[header] = row[j];
      }
    }
    objects.push(obj);
  }
  return objects;
}
