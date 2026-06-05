/**
 * 🚀 DCG Smart Track — Phase A: Auto-Setup & Fix Sheet Tabs (v2)
 * 
 * สคริปต์นี้จะ:
 * 1. สร้างแผ่นงานที่ขาดหายไป (Tx_OTPStore, Feedback_Reports)
 * 2. แก้ไข System_Config: เปลี่ยน Header "Setting" → "Key" + เพิ่มคอลัมน์ "Description"
 * 3. เพิ่มคอลัมน์ "PrivateCount" ใน Tx_InternalSort (แทรกก่อน "Total")
 * 4. ตรวจสอบแผ่นงานที่จำเป็นทั้งหมด
 * 
 * วิธีใช้:
 * 1. เปิด Google Sheets
 * 2. ไปที่ Extensions > Apps Script
 * 3. สร้างไฟล์ใหม่ชื่อ "setup_sheets.gs" (หรือวางต่อท้ายโค้ดหลัก)
 * 4. วางโค้ดนี้ลงไป แล้วรันฟังก์ชัน `runPhaseASetup()`
 * 5. ตรวจสอบผลลัพธ์ใน Execution log
 * 
 * ⚠️ สคริปต์จะข้ามแผ่นงานที่มีอยู่แล้ว (ไม่เขียนทับข้อมูลเดิม)
 * ⚠️ การแก้ไข Header จะตรวจสอบก่อนว่าต้องแก้จริงหรือไม่
 */

function runPhaseASetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = [];
  
  log.push("🚀 เริ่ม Phase A: Auto-Setup & Fix Sheet Tabs (v2)");
  log.push("📄 Spreadsheet: " + ss.getName());
  log.push("🔗 ID: " + ss.getId());
  log.push("---");
  
  // ============================================================
  // PART 1: สร้างแผ่นงานที่ขาดหายไป
  // ============================================================
  log.push("📋 PART 1: สร้างแผ่นงานที่ขาดหายไป");
  
  // 1.1 System_Config (ค่ากำหนดระบบ)
  var configResult = createSheetIfNotExists(ss, "System_Config", 
    ["Key", "Value", "Description"],
    [
      ["announcement", "กรุณาบันทึกข้อมูลก่อนเวลา 16.00 น.", "ประกาศระบบหน้าแรก"],
      ["restrictWorkdays", "true", "เปิดใช้ระบบจำกัดสิทธิ์เฉพาะวันจันทร์-ศุกร์"],
      ["appName", "DCG Smart Service", "ชื่อแอปพลิเคชัน"],
      ["appSubtitle", "ระบบบันทึกข้อมูลการให้บริการงานไปรษณีย์ ส่วนอำนวยการสารบรรณ", "คำบรรยายใต้ชื่อแอป"],
      ["show", "true", "แสดงประกาศหน้าแรก"]
    ]
  );
  log.push(configResult);
  
  // 1.2 Tx_OTPStore (เซสชัน OTP)
  var otpResult = createSheetIfNotExists(ss, "Tx_OTPStore",
    ["Email", "OTPCode", "OTPExpiresAt", "SessionToken", "SessionExpiresAt"],
    []
  );
  log.push(otpResult);
  
  // 1.3 Tx_InternalRun (งานรับ-ส่งภายใน)
  var runResult = createSheetIfNotExists(ss, "Tx_InternalRun",
    ["TxID", "Timestamp", "DeptName", "Route", "Round", "ItemCount", "Note", "StaffEmail"],
    []
  );
  log.push(runResult);
  
  // 1.4 Tx_InternalSort (งานคัดแยก-นำจ่าย)
  var sortResult = createSheetIfNotExists(ss, "Tx_InternalSort",
    ["TxID", "Timestamp", "DeptName", "NormalCount", "RegisterCount", "PrivateCount", "Total", "Note", "StaffEmail"],
    []
  );
  log.push(sortResult);
  
  // 1.5 Tx_ExternalPost (งานนำส่งไปรษณีย์ภายนอก)
  var extResult = createSheetIfNotExists(ss, "Tx_ExternalPost",
    ["TxID", "Timestamp", "RequestingDept", "ServiceType", "Cost", "ItemCount", "TrackingNo", "FundSource", "StaffEmail"],
    []
  );
  log.push(extResult);
  
  // 1.6 Feedback_Reports (รายงานข้อเสนอแนะ)
  var feedbackResult = createSheetIfNotExists(ss, "Feedback_Reports",
    ["Timestamp", "StaffEmail", "FeedbackType", "Severity", "Description"],
    []
  );
  log.push(feedbackResult);
  
  // ============================================================
  // PART 2: แก้ไข Headers ที่ไม่ตรงกัน
  // ============================================================
  log.push("---");
  log.push("🔧 PART 2: แก้ไข Headers ที่ไม่ตรงกัน");
  
  // 2.1 System_Config: เปลี่ยน "Setting" → "Key" + เพิ่ม "Description"
  var fixConfigResult = fixSystemConfigHeaders(ss);
  log.push(fixConfigResult);
  
  // 2.2 Tx_InternalSort: เพิ่มคอลัมน์ "PrivateCount" (ก่อน "Total")
  var fixSortResult = fixInternalSortHeaders(ss);
  log.push(fixSortResult);
  
  // ============================================================
  // PART 3: ตรวจสอบแผ่นงานที่ต้องมีอยู่แล้ว
  // ============================================================
  log.push("---");
  log.push("🔍 PART 3: ตรวจสอบแผ่นงานที่จำเป็นทั้งหมด");
  
  var requiredSheets = [
    "Master_Users", "Master_Departments", "Master_Services",
    "System_Config", "Tx_OTPStore",
    "Tx_InternalRun", "Tx_InternalSort", "Tx_ExternalPost",
    "Feedback_Reports"
  ];
  
  requiredSheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      var rowCount = sheet.getLastRow();
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      log.push("  ✅ " + name + " — มีอยู่ (" + rowCount + " แถว) — Headers: " + headers.join(", "));
    } else {
      log.push("  ❌ " + name + " — ไม่พบ! กรุณาตรวจสอบ");
    }
  });
  
  // ============================================================
  // PART 4: สรุปผลลัพธ์
  // ============================================================
  log.push("---");
  
  var allSheets = ss.getSheets().map(function(s) { return s.getName(); });
  var missing = requiredSheets.filter(function(name) {
    return allSheets.indexOf(name) === -1;
  });
  
  if (missing.length === 0) {
    log.push("🎉 Phase A สำเร็จ! แผ่นงานครบทั้ง " + requiredSheets.length + " รายการ");
  } else {
    log.push("⚠️ ยังขาดแผ่นงาน " + missing.length + " รายการ: " + missing.join(", "));
  }
  
  log.push("📋 แผ่นงานทั้งหมดใน Spreadsheet: " + allSheets.join(", "));
  
  // แสดงผลลัพธ์
  var logText = log.join("\n");
  console.log(logText);
  Logger.log(logText);
  
  return logText;
}

// ============================================================
// Helper: สร้างแผ่นงานใหม่ถ้ายังไม่มี
// ============================================================
function createSheetIfNotExists(ss, sheetName, headers, initialData) {
  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    return "  ⏭️ " + sheetName + " — มีอยู่แล้ว (ข้าม)";
  }
  
  var sheet = ss.insertSheet(sheetName);
  
  // กรอก Headers
  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // จัดรูปแบบ Header
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4A86C8");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setHorizontalAlignment("center");
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    // Auto-resize columns
    for (var i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  // กรอกข้อมูลเริ่มต้น
  if (initialData.length > 0) {
    sheet.getRange(2, 1, initialData.length, initialData[0].length).setValues(initialData);
  }
  
  return "  ✅ " + sheetName + " — สร้างสำเร็จ (" + headers.length + " คอลัมน์, " + initialData.length + " แถวข้อมูล)";
}

// ============================================================
// Fix: System_Config — เปลี่ยน "Setting" → "Key" + เพิ่ม "Description"
// ============================================================
function fixSystemConfigHeaders(ss) {
  var sheet = ss.getSheetByName("System_Config");
  if (!sheet) {
    return "  ⏭️ System_Config — ไม่พบแผ่นงาน (ข้าม)";
  }
  
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    return "  ⏭️ System_Config — แผ่นงานว่างเปล่า (ข้าม)";
  }
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var changes = [];
  
  // 2.1a: เปลี่ยน "Setting" → "Key"
  var settingIdx = headers.indexOf("Setting");
  if (settingIdx !== -1) {
    sheet.getRange(1, settingIdx + 1).setValue("Key");
    changes.push("Setting→Key");
  }
  
  // 2.1b: ตรวจว่ามี "Description" หรือยัง
  var descIdx = headers.indexOf("Description");
  if (descIdx === -1) {
    // เพิ่มคอลัมน์ Description ที่ท้ายสุด
    var newColIdx = lastCol + 1;
    sheet.getRange(1, newColIdx).setValue("Description");
    sheet.getRange(1, newColIdx).setFontWeight("bold");
    sheet.getRange(1, newColIdx).setBackground("#4A86C8");
    sheet.getRange(1, newColIdx).setFontColor("#FFFFFF");
    sheet.getRange(1, newColIdx).setHorizontalAlignment("center");
    changes.push("+Description");
  }
  
  if (changes.length === 0) {
    return "  ⏭️ System_Config — Headers ถูกต้องแล้ว (ข้าม)";
  }
  return "  ✅ System_Config — แก้ไข Headers สำเร็จ: " + changes.join(", ");
}

// ============================================================
// Fix: Tx_InternalSort — เพิ่มคอลัมน์ "PrivateCount" ก่อน "Total"
// ============================================================
function fixInternalSortHeaders(ss) {
  var sheet = ss.getSheetByName("Tx_InternalSort");
  if (!sheet) {
    return "  ⏭️ Tx_InternalSort — ไม่พบแผ่นงาน (ข้าม)";
  }
  
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    return "  ⏭️ Tx_InternalSort — แผ่นงานว่างเปล่า (ข้าม)";
  }
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // ตรวจว่ามี "PrivateCount" หรือยัง
  if (headers.indexOf("PrivateCount") !== -1) {
    return "  ⏭️ Tx_InternalSort — มีคอลัมน์ PrivateCount อยู่แล้ว (ข้าม)";
  }
  
  // หาตำแหน่งของ "Total" เพื่อแทรก "PrivateCount" ก่อน
  var totalIdx = headers.indexOf("Total");
  if (totalIdx === -1) {
    // ถ้าไม่มี Total ให้แทรกหลัง RegisterCount
    var regIdx = headers.indexOf("RegisterCount");
    if (regIdx === -1) {
      // fallback: เพิ่มที่ท้ายสุด
      var newCol = lastCol + 1;
      sheet.getRange(1, newCol).setValue("PrivateCount");
      sheet.getRange(1, newCol).setFontWeight("bold");
      sheet.getRange(1, newCol).setBackground("#4A86C8");
      sheet.getRange(1, newCol).setFontColor("#FFFFFF");
      sheet.getRange(1, newCol).setHorizontalAlignment("center");
      return "  ✅ Tx_InternalSort — เพิ่ม PrivateCount ที่ท้ายสุด (ไม่พบ Total/RegisterCount)";
    }
    totalIdx = regIdx + 1; // แทรกหลัง RegisterCount
  }
  
  // แทรกคอลัมน์ใหม่ที่ตำแหน่ง totalIdx+1 (1-indexed)
  // insertColumnBefore ใช้ 1-indexed
  sheet.insertColumnBefore(totalIdx + 1);
  
  // ตั้ง Header ให้คอลัมน์ใหม่
  var newHeaderCell = sheet.getRange(1, totalIdx + 1);
  newHeaderCell.setValue("PrivateCount");
  newHeaderCell.setFontWeight("bold");
  newHeaderCell.setBackground("#4A86C8");
  newHeaderCell.setFontColor("#FFFFFF");
  newHeaderCell.setHorizontalAlignment("center");
  
  // กรอกค่า 0 ให้ทุกแถวข้อมูลที่มีอยู่ (เพื่อไม่ให้ค่า Total เพี้ยน)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var numDataRows = lastRow - 1;
    var zeros = [];
    for (var i = 0; i < numDataRows; i++) {
      zeros.push([0]);
    }
    sheet.getRange(2, totalIdx + 1, numDataRows, 1).setValues(zeros);
  }
  
  return "  ✅ Tx_InternalSort — แทรก PrivateCount ก่อน Total สำเร็จ (เติม 0 ให้ " + (lastRow - 1) + " แถวเดิม)";
}
