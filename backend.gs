// --- DCG Smart Track Backend (Production Grade) ---

// [GGSheet Protocol] - ฐานข้อมูลหลัก (สามารถสลับไปดึงจาก Script Properties หรือใช้ ID สำรองเริ่มต้นนี้)
var SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "";

/**
 * ดักจับคำขอแบบ HTTP GET สำหรับเว็บบัญชีผู้ใช้งานภายนอก (ถ้ามี)
 * @param {Object} e - ข้อมูลพารามิเตอร์ของคำขอ GET
 * @returns {HtmlOutput|TextOutput} ผลลัพธ์แสดงสถานะของบริการ API
 */
function doGet(e) {
  return ContentService.createTextOutput("DCG Smart Track API is running.");
}

/**
 * ดักจับคำขอแบบ HTTP POST เพื่อประมวลผลการทำงานหลักของระบบ API (doPost)
 * @param {Object} e - ข้อมูลที่ถูกส่งมาแบบ HTTP POST รวมถึง body และ payload
 * @returns {TextOutput} ข้อมูล JSON ผลการประมวลผลของ Action ต่าง ๆ
 */
function doPost(e) {
  var json = JSON.parse(e.postData.contents);
  var action = json.action;
  var payload = json.payload;
  var auth = json.auth || {};
  var result = {};

  try {
    // [GGSheet Protocol] - ป้องกันการเขียน อ่าน หรือลบข้อมูลโดยไม่ผ่านการยืนยันตัวตนจริง
    if (
      action === "saveBatch" ||
      action === "deleteLog" ||
      action === "feedback" ||
      action === "getMetaData" ||
      action === "searchLogs"
    ) {
      verifySessionToken(auth.sessionToken);
    }

    if (action === "getMetaData") {
      result = getMetaData();
    } else if (action === "searchLogs") {
      result = searchLogs(payload);
    } else if (action === "saveBatch") {
      result = saveBatch(payload);
    } else if (action === "deleteLog") {
      result = deleteLog(payload);
    } else if (action === "publicSearch") {
      result = publicSearch(payload);
    } else if (action === "requestOTP") {
      result = requestOTP(payload);
    } else if (action === "verifyOTP") {
      result = verifyOTP(payload);
    } else if (action === "feedback") {
      var sessionUser = verifySessionToken(auth.sessionToken);
      payload.staffEmail = sessionUser.email; // Secure user validation
      result = handleFeedback(payload);
    } else {
      throw new Error("Invalid action: " + action);
    }
    return ContentService.createTextOutput(
      JSON.stringify({ status: "success", data: result }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: err.message || err.toString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Helper Functions ---

// ซิงค์และกู้คืนโครงสร้างหัวตาราง Master_Users อัตโนมัติ (Self-healing Schema)
/**
 * ตรวจสอบและแก้ไขโครงสร้างหัวตาราง Master_Users ในสเปรดชีตอัตโนมัติหากมีคอลัมน์คลาดเคลื่อนหรือว่างเปล่า
 * @param {Spreadsheet} ss - ออบเจกต์สเปรดชีตหลัก
 */
function ensureMasterUsersHeadersSync(ss) {
  var userSheet = ss.getSheetByName("Master_Users");
  if (!userSheet) return;

  var lastRow = userSheet.getLastRow();
  var lastCol = userSheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return;

  var headers = userSheet
    .getRange(1, 1, 1, Math.min(lastCol, 10))
    .getValues()[0];
  var changed = false;

  // 1. ถ้าหัวคอลัมน์ B ว่างเปล่า และแถวที่ 2 เป็นอีเมล ให้ตั้งค่าเป็น "Email"
  if (
    headers.length >= 2 &&
    (!headers[1] || String(headers[1]).trim() === "")
  ) {
    var b2Val = String(userSheet.getRange(2, 2).getValue()).trim();
    if (b2Val.indexOf("@") > -1) {
      userSheet.getRange(1, 2).setValue("Email");
      headers[1] = "Email";
      changed = true;
    }
  }

  // 2. ถ้าหัวคอลัมน์ C ว่างเปล่า และข้อมูลในคอลัมน์ C ทั้งหมดว่างเปล่า (แต่ D1 คือ FullName) ให้ลบคอลัมน์ C เพื่อขยับคอลัมน์ด้านขวากลับมา
  if (
    headers.length >= 4 &&
    (!headers[2] || String(headers[2]).trim() === "") &&
    String(headers[3]).trim() === "FullName"
  ) {
    var colCValues = userSheet
      .getRange(2, 3, Math.max(lastRow - 1, 1), 1)
      .getValues();
    var isColCEmpty = colCValues.every(function (row) {
      return !row[0] || String(row[0]).trim() === "";
    });

    if (isColCEmpty) {
      userSheet.deleteColumn(3);
      changed = true;
    }
  }

  if (changed) {
    SpreadsheetApp.flush();
  }
}

// ตรวจสอบ Session Token และสิทธิ์การใช้งานช่วงวันทำการ (จันทร์-ศุกร์)
/**
 * ตรวจสอบความถูกต้องและสิทธิ์การใช้งานของ Session Token รวมถึงสิทธิ์จำกัดช่วงวันทำการ (จันทร์-ศุกร์)
 * @param {string} sessionToken - โทเค็นเซสชันที่ส่งมาจากฝั่งผู้ใช้งานเพื่อยืนยันตัวตน
 * @returns {Object} ข้อมูลอีเมลของผู้ใช้งานที่ได้รับอนุญาต
 * @throws {Error} เกิดข้อผิดพลาดหาก Session ไม่ถูกต้องหรืออยู่นอกเวลาทำงาน
 */
function verifySessionToken(sessionToken) {
  var today = new Date();

  // บันทึกข้ามผ่านสำหรับการทดสอบบน localhost ด้วย Mock Token (เปิดใช้งานเฉพาะเมื่อตั้งค่า ALLOW_MOCK_TOKEN = "true" เท่านั้น)
  if (sessionToken === "mock-token-123") {
    var allowMock =
      PropertiesService.getScriptProperties().getProperty("ALLOW_MOCK_TOKEN");
    if (allowMock === "true") {
      return { email: "mock@wu.ac.th", name: "Mock User" };
    }
  }

  if (!sessionToken || sessionToken === "") {
    throw new Error(
      "กรุณาเข้าสู่ระบบก่อนดำเนินการบันทึกหรือลบข้อมูล (Authentication Required)",
    );
  }

  var ss = getSpreadsheet();

  // ตรวจสอบวันทำงาน (จันทร์-ศุกร์)
  if (shouldRestrictWorkdays(ss)) {
    var dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw new Error("ระบบจำกัดการเข้าใช้งานเฉพาะวันจันทร์ - ศุกร์ เท่านั้น");
    }
  }

  var otpSheet = ss.getSheetByName("Tx_OTPStore");
  if (!otpSheet) {
    throw new Error("ไม่พบตารางเก็บเซสชันในระบบ");
  }

  var otpData = getSheetDataAsObjects(otpSheet);
  var sessionRecord = otpData.find(function (r) {
    return r.SessionToken === sessionToken;
  });

  if (!sessionRecord) {
    throw new Error("เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
  }

  var expiresAt = new Date(sessionRecord.SessionExpiresAt);
  if (today > expiresAt) {
    throw new Error(
      "เซสชันการใช้งานของคุณหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
    );
  }

  return { email: sessionRecord.Email };
}

// เปิดสเปรดชีตอย่างปลอดภัย
/**
 * ดึงออบเจกต์สเปรดชีตหลักของระบบอย่างปลอดภัย โดยดึงจาก ID ใน Script Properties หรือใช้งาน Active Spreadsheet เป็นทางเลือกสำรอง
 * @returns {Spreadsheet} ออบเจกต์ Google Spreadsheet หลัก
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== "") {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      console.warn(
        "Failed to open spreadsheet by ID, falling back to active spreadsheet: " +
          e.toString(),
      );
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ป้องกัน Formula Injection (ใส่ ' นำหน้าข้อมูลที่ขึ้นต้นด้วย =)
/**
 * ล้างข้อมูลและป้องกันช่องโหว่ Formula / CSV Injection (OWASP) โดยการแทรกอัญประกาศเดี่ยว (') หากตรวจพบสัญลักษณ์สูตรคำนวณ
 * @param {*} val - ค่าข้อมูลที่ต้องการตรวจสอบความสะอาด
 * @returns {*} ค่าข้อมูลที่ปลอดภัยสำหรับการกรอกลงตาราง
 */
function sanitizeInput(val) {
  if (typeof val === "string") {
    // Trim leading whitespace/newlines to prevent bypass (e.g. " =1+1", "\n=IMPORTRANGE(...)")
    var trimmed = val.replace(/^[\s\uFEFF\xA0]+/, "");
    var firstChar = trimmed.charAt(0);
    // OWASP CSV Injection: block =, +, -, @, tab, carriage return
    if (
      firstChar === "=" ||
      firstChar === "+" ||
      firstChar === "-" ||
      firstChar === "@" ||
      firstChar === "\t" ||
      firstChar === "\r"
    ) {
      return "'" + val;
    }
  }
  return val;
}

// ช่วยดึงข้อมูลและแปลงเป็น Object Array ตามหัวคอลัมน์ในแถวแรก
/**
 * ดึงข้อมูลในตารางและแปลงเป็นอาเรย์ของออบเจกต์ (Array of Objects) โดยใช้ชื่อคอลัมน์ในแถวแรกเป็นคีย์
 * @param {Sheet} sheet - ออบเจกต์ชีตที่ต้องการดึงข้อมูล
 * @returns {Object[]} ข้อมูลตารางในรูปแบบอาเรย์ของออบเจกต์
 */
function getSheetDataAsObjects(sheet) {
  if (!sheet) return [];
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

// แปลงรูปแบบวันที่ให้อยู่ในรูป YYYY-MM-DD
/**
 * แปลงรูปแบบวันที่ (Date/Timestamp) ให้อยู่ในรูปสตริงมาตรฐาน YYYY-MM-DD
 * @param {Date|string|number} date - วันที่ที่ต้องการฟอร์แมต
 * @returns {string} วันที่ฟอร์แมตแล้ว (เช่น "2026-06-05") หรือสตริงว่างหากไม่ถูกต้อง
 */
function formatYYYYMMDD(date) {
  if (typeof date === "string") {
    var parts = date.trim().split(/[\/\-\s:]/);
    if (parts.length >= 3 && parts[0].length < 4) {
      var day = parseInt(parts[0], 10);
      var month = parseInt(parts[1], 10);
      var year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1000) {
        var hour = parts[3] ? parseInt(parts[3], 10) : 0;
        var min = parts[4] ? parseInt(parts[4], 10) : 0;
        var sec = parts[5] ? parseInt(parts[5], 10) : 0;
        var d = new Date(year, month - 1, day, hour, min, sec);
        if (!isNaN(d.getTime())) {
          return (
            year +
            "-" +
            String(month).padStart(2, "0") +
            "-" +
            String(day).padStart(2, "0")
          );
        }
      }
    }
  }
  var d = new Date(date);
  if (isNaN(d.getTime())) return "";
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

// --- Core API Actions ---

// 1. ดึง Metadata พื้นฐาน (ผู้ใช้, หน่วยงาน, บริการ, ตั้งค่า)
/**
 * ดึงข้อมูลชุดตั้งต้น (Metadata) สำหรับหน้าระบบ ได้แก่ รายชื่อผู้ใช้ แผนก บริการ และการตั้งค่าต่าง ๆ
 * @returns {Object} ออบเจกต์รวมกลุ่มข้อมูล Metadata
 */
function getMetaData() {
  var ss = getSpreadsheet();
  ensureMasterUsersHeadersSync(ss);

  // โหลดรายชื่อผู้ใช้งาน
  var userSheet = ss.getSheetByName("Master_Users");
  var users = userSheet
    ? getSheetDataAsObjects(userSheet)
    : [
        {
          UserID: "U001",
          Email: "admin@wu.ac.th",
          FullName: "Admin User",
          Role: "Admin",
          Status: "Active",
        },
      ];

  // โหลดรายชื่อหน่วยงาน
  var deptSheet = ss.getSheetByName("Master_Departments");
  var departments = deptSheet
    ? getSheetDataAsObjects(deptSheet)
    : [
        {
          DeptID: "D001",
          DeptName: "สำนักวิชาสารสนเทศศาสตร์",
          RouteGroup: "สาย A",
          Building: "อาคารวิชาการ 1",
          Floor: 1,
          BudgetOwner: "",
        },
        {
          DeptID: "D041",
          DeptName: "ศูนย์หนังสือ มวล.",
          RouteGroup: "สาย A",
          Building: "อาคารเรียนรวม 5",
          Floor: 1,
          BudgetOwner: "ศูนย์บริหารทรัพย์สิน",
        },
        {
          DeptID: "D042",
          DeptName: "สำนักวิชาสถาปัตยกรรมศาสตร์และการออกแบบ",
          RouteGroup: "สาย A",
          Building: "อาคารปฏิบัติการทางสถาปัตยกรรมเเละการออกแบบ",
          Floor: 1,
          BudgetOwner: "",
        },
        {
          DeptID: "D085",
          DeptName: "โรงเรียนสาธิตมหาวิทยาลัยวลัยลักษณ์",
          RouteGroup: "สาย A",
          Building: "อาคารเรียนรวม 1",
          Floor: 1,
          BudgetOwner: "",
        },
      ];

  // โหลดรายการบริการ
  var serviceSheet = ss.getSheetByName("Master_Services");
  var services = serviceSheet
    ? getSheetDataAsObjects(serviceSheet)
    : [
        {
          ServiceID: "S01",
          ServiceName: "EMS",
          Description: "ไปรษณีย์ด่วนพิเศษ",
        },
        {
          ServiceID: "S02",
          ServiceName: "ลงทะเบียน",
          Description: "ไปรษณีย์ลงทะเบียน",
        },
        {
          ServiceID: "S03",
          ServiceName: "พัสดุธรรมดา",
          Description: "พัสดุไปรษณีย์",
        },
        {
          ServiceID: "S04",
          ServiceName: "จดหมาย",
          Description: "จดหมายธรรมดา",
        },
        {
          ServiceID: "S05",
          ServiceName: "ไปรษณีย์ภัณฑ์ส่วนตัว",
          Description: "ไปรษณีย์ภัณฑ์ส่วนตัว",
        },
      ];

  // โหลดค่ากำหนดของระบบ (Config)
  var configSheet = ss.getSheetByName("System_Config");
  var config = {
    appName: "DCG Smart Service",
    appSubtitle: "ระบบบันทึกข้อมูลการให้บริการงานไปรษณีย์ ส่วนอำนวยการสารบรรณ",
    announcement: "ยินดีต้อนรับสู่ DCG Smart Service",
    show: true,
    restrictWorkdays: true,
  };
  if (configSheet) {
    var configObjects = getSheetDataAsObjects(configSheet);
    configObjects.forEach(function (c) {
      if (c.Key) {
        var val = c.Value;
        if (
          val === "true" ||
          val === true ||
          String(val).toUpperCase() === "TRUE"
        )
          val = true;
        else if (
          val === "false" ||
          val === false ||
          String(val).toUpperCase() === "FALSE"
        )
          val = false;
        config[c.Key] = val;
      }
    });
  }

  return {
    users: users,
    departments: departments,
    services: services,
    config: config,
  };
}

// 2. บันทึกข้อมูลแบบ Batch ลงตารางธุรกรรมแยกตามประเภท
/**
 * บันทึกข้อมูลแบบกลุ่ม (Batch Write) ลงในตารางธุรกรรมแยกตามประเภท พร้อมป้องกันปัญหา Race Condition และ Formula Injection
 * @param {Object} payload - ออบเจกต์ข้อมูลธุรกรรมและประเภทที่ต้องการบันทึก
 * @param {string} payload.type - ประเภทธุรกรรม ('run' | 'sort' | 'ext')
 * @param {Object[]} payload.items - รายการพัสดุ/จดหมายที่ต้องการบันทึก
 * @param {Object} [payload.common] - ข้อมูลร่วม เช่น สายส่ง รอบการเดินรถ อีเมลผู้บันทึก
 * @param {string} payload.txId - ไอดีธุรกรรม (Transaction ID)
 * @returns {Object} ข้อความรายงานผลสำเร็จพร้อม TxID
 * @throws {Error} ข้อผิดพลาดเมื่อคิวบันทึกข้อมูลหนาแน่นหรือพารามิเตอร์ไม่ถูกต้อง
 */
function saveBatch(payload) {
  var type = payload.type;
  var items = payload.items;
  var common = payload.common || {};
  var txId = payload.txId;

  if (!items || items.length === 0) {
    return { message: "No items to save" };
  }

  var ss = getSpreadsheet();
  var sheetName = "";
  var headers = [];

  if (type === "run") {
    sheetName = "Tx_InternalRun";
    headers = [
      "TxID",
      "Timestamp",
      "DeptName",
      "Route",
      "Round",
      "ItemCount",
      "Note",
      "StaffEmail",
    ];
  } else if (type === "sort") {
    sheetName = "Tx_InternalSort";
    headers = [
      "TxID",
      "Timestamp",
      "DeptName",
      "NormalCount",
      "RegisterCount",
      "PrivateCount",
      "Total",
      "Note",
      "StaffEmail",
    ];
  } else if (type === "ext") {
    sheetName = "Tx_ExternalPost";
    headers = [
      "TxID",
      "Timestamp",
      "RequestingDept",
      "ServiceType",
      "Cost",
      "ItemCount",
      "TrackingNo",
      "FundSource",
      "StaffEmail",
    ];
  } else {
    throw new Error("Invalid transaction type: " + type);
  }

  // [GGSheet Protocol] - ดึง Script Lock ป้องกัน Race Condition
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // รอคิวได้สูงสุด 15 วินาที
  } catch (e) {
    throw new Error(
      "ระบบขัดข้องเนื่องจากมีการบันทึกซ้อนกัน กรุณาลองใหม่อีกครั้ง",
    );
  }

  try {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
    }

    // ดึงหัวคอลัมน์ที่มีอยู่จริง
    var currentHeaders = sheet.getDataRange().getValues()[0];
    if (currentHeaders.length === 0 || !currentHeaders[0]) {
      currentHeaders = headers;
      sheet.appendRow(headers);
    }

    // [GGSheet Protocol] - ป้องกันข้อมูลธุรกรรมซ้ำซ้อน (Deduplication Guard)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var existingTxIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var isDuplicate = existingTxIds.some(function(row) {
        return row[0] === txId;
      });
      if (isDuplicate) {
        return {
          message: "บันทึกข้อมูลเรียบร้อยแล้ว (ตรวจพบรายการซ้ำซ้อนและข้ามการบันทึกเดิม)",
          txId: txId,
          isDuplicate: true
        };
      }
    }

    var timestamp = new Date();
    var rowsToWrite = [];

    // ดึงชื่อเต็มจากตารางผู้ใช้งานโดยอ้างอิงอีเมล (StaffEmail -> ชื่อ-สกุล)
    var staffDisplay = common.staffEmail || "";
    if (staffDisplay && staffDisplay.indexOf("@") !== -1) {
      try {
        var userSheet = ss.getSheetByName("Master_Users");
        if (userSheet) {
          var users = getSheetDataAsObjects(userSheet);
          var userRec = users.find(function (u) {
            return u.Email && String(u.Email).trim().toLowerCase() === staffDisplay.toLowerCase();
          });
          if (userRec && userRec.FullName) {
            staffDisplay = userRec.FullName;
          }
        }
      } catch (e) {
        console.warn("Failed to lookup user display name: " + e.toString());
      }
    }

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var rowData = new Array(currentHeaders.length);

      // สร้าง Mapping ค่าลงแถวตามชื่อหัวข้อ
      for (var colIdx = 0; colIdx < currentHeaders.length; colIdx++) {
        var h = currentHeaders[colIdx];
        var val = "";

        if (h === "TxID") val = txId;
        else if (h === "Timestamp") val = timestamp;
        else if (h === "StaffEmail") val = staffDisplay;
        // กรองการบันทึกตามประเภทข้อมูล
        else if (type === "run") {
          if (h === "DeptName") val = item.deptName;
          else if (h === "Route") val = common.route || "ไม่ระบุสาย";
          else if (h === "Round") val = common.round || "รอบทั่วไป";
          else if (h === "ItemCount") val = parseInt(item.itemCount) || 0;
          else if (h === "Note") val = item.note || "";
        } else if (type === "sort") {
          if (h === "DeptName") val = item.deptName;
          else if (h === "NormalCount") val = parseInt(item.normalCount) || 0;
          else if (h === "RegisterCount")
            val = parseInt(item.registerCount) || 0;
          else if (h === "PrivateCount") val = parseInt(item.privateCount) || 0;
          else if (h === "Total")
            val =
              (parseInt(item.normalCount) || 0) +
              (parseInt(item.registerCount) || 0) +
              (parseInt(item.privateCount) || 0);
          else if (h === "Note") val = item.note || "";
        } else if (type === "ext") {
          if (h === "RequestingDept") val = item.deptName;
          else if (h === "ServiceType") val = item.serviceType;
          else if (h === "Cost") val = parseFloat(item.cost) || 0;
          else if (h === "ItemCount") val = parseInt(item.itemCount) || 0;
          else if (h === "TrackingNo") val = item.trackingNo || "-";
          else if (h === "FundSource")
            val = item.fundSource || "งบประมาณมหาวิทยาลัย";
          else if (h === "Note") val = item.note || "";
        }

        rowData[colIdx] = sanitizeInput(val);
      }
      rowsToWrite.push(rowData);
    }

    // บันทึกข้อมูลเป็น Batch รวดเดียวเพื่อประหยัดเวลา
    var lastRow = sheet.getLastRow();
    sheet
      .getRange(lastRow + 1, 1, rowsToWrite.length, currentHeaders.length)
      .setValues(rowsToWrite);

    // ตั้งค่ารูปแบบคอลัมน์ Timestamp ให้แสดงวันที่และเวลา (yyyy-MM-dd HH:mm:ss) สำหรับทุกแถว
    var timeColIdx = currentHeaders.indexOf("Timestamp");
    if (timeColIdx !== -1) {
      var totalRows = sheet.getLastRow();
      if (totalRows > 1) {
        sheet
          .getRange(2, timeColIdx + 1, totalRows - 1, 1)
          .setNumberFormat("yyyy-MM-dd HH:mm:ss");
      }
    }

    SpreadsheetApp.flush();

    return {
      message: "บันทึกข้อมูลเรียบร้อยแล้ว (" + items.length + " รายการ)",
      txId: txId,
    };
  } finally {
    lock.releaseLock();
  }
}

// 3. ค้นหาประวัติย้อนหลังตามตัวกรอง
/**
 * ค้นหาประวัติธุรกรรมย้อนหลังจาก 3 ตารางประวัติหลักตามตัวกรองที่ระบุ (วันที่ แผนก)
 * @param {Object} payload - ตัวกรองและพารามิเตอร์การค้นหา
 * @param {Object} [payload.filters] - เงื่อนไขตัวกรอง เช่น startDate, endDate, dept
 * @param {string} [payload.email] - อีเมลผู้บันทึกกรณีต้องการจำกัดสิทธิ์การดูข้อมูล
 * @returns {Object} ผลลัพธ์แบ่งกลุ่มประวัติ run, sort และ ext
 */
function searchLogs(payload) {
  var filters = payload.filters || {};
  var email = payload.email;

  var ss = getSpreadsheet();
  var runResults = [];
  var sortResults = [];
  var extResults = [];

  // ดึงขอบเขตวันที่ (ถ้ามี)
  var startDateStr = filters.startDate ? formatYYYYMMDD(filters.startDate) : "";
  var endDateStr = filters.endDate ? formatYYYYMMDD(filters.endDate) : "";
  var filterDept = filters.dept ? filters.dept.toLowerCase() : "";

  // 1. ดึงตารางงานรับ-ส่งภายใน
  var runSheet = ss.getSheetByName("Tx_InternalRun");
  if (runSheet) {
    var rawLogs = getSheetDataAsObjects(runSheet);
    runResults = rawLogs.filter(function (row) {
      // ตัวกรองวันที่
      var rowDateStr = row.Timestamp ? formatYYYYMMDD(row.Timestamp) : "";
      if (startDateStr && rowDateStr < startDateStr) return false;
      if (endDateStr && rowDateStr > endDateStr) return false;

      // ตัวกรองหน่วยงาน
      if (
        filterDept &&
        row.DeptName &&
        row.DeptName.toLowerCase().indexOf(filterDept) === -1
      )
        return false;

      // ตัวกรองผู้บันทึก (สำหรับ staff ทั่วไปจะเห็นเฉพาะของตัวเอง ยกเว้น admin)
      // Note: หากต้องการเปิดให้เห็นข้ามคนกันได้ สามารถปิดบรรทัดล่างนี้
      // if (email && row.StaffEmail && row.StaffEmail.toLowerCase() !== email.toLowerCase()) return false;

      return true;
    });
  }

  // 2. ดึงตารางงานคัดแยก
  var sortSheet = ss.getSheetByName("Tx_InternalSort");
  if (sortSheet) {
    var rawLogs = getSheetDataAsObjects(sortSheet);
    sortResults = rawLogs.filter(function (row) {
      var rowDateStr = row.Timestamp ? formatYYYYMMDD(row.Timestamp) : "";
      if (startDateStr && rowDateStr < startDateStr) return false;
      if (endDateStr && rowDateStr > endDateStr) return false;
      if (
        filterDept &&
        row.DeptName &&
        row.DeptName.toLowerCase().indexOf(filterDept) === -1
      )
        return false;
      return true;
    });
  }

  // 3. ดึงตารางนำส่งภายนอก
  var extSheet = ss.getSheetByName("Tx_ExternalPost");
  if (extSheet) {
    var rawLogs = getSheetDataAsObjects(extSheet);
    extResults = rawLogs.filter(function (row) {
      var rowDateStr = row.Timestamp ? formatYYYYMMDD(row.Timestamp) : "";
      if (startDateStr && rowDateStr < startDateStr) return false;
      if (endDateStr && rowDateStr > endDateStr) return false;
      if (
        filterDept &&
        row.RequestingDept &&
        row.RequestingDept.toLowerCase().indexOf(filterDept) === -1
      )
        return false;
      return true;
    });
  }

  // ส่งออกผลลัพธ์แยกกลุ่มการวิเคราะห์
  return {
    run: runResults,
    sort: sortResults,
    ext: extResults,
  };
}

// 4. ลบรายการโดยค้นหาจาก TxID
/**
 * ลบรายการประวัติธุรกรรมออกจากตารางประวัติธุรกรรม โดยค้นหาจากรหัส TxID
 * @param {Object} payload - พารามิเตอร์ในการระบุข้อมูลที่ต้องการลบ
 * @param {string} payload.id - รหัส TxID ที่ต้องการลบ
 * @param {string} payload.type - ประเภทธุรกรรม ('run' | 'sort' | 'ext')
 * @returns {Object} ผลสรุปจำนวนแถวที่ลบสำเร็จ
 * @throws {Error} ข้อผิดพลาดในการรอสิทธิ์เขียนข้อมูลหรือรูปแบบไม่ถูกต้อง
 */
function deleteLog(payload) {
  var id = payload.id;
  var type = payload.type;

  var ss = getSpreadsheet();
  var sheetName = "";
  if (type === "run") sheetName = "Tx_InternalRun";
  else if (type === "sort") sheetName = "Tx_InternalSort";
  else if (type === "ext") sheetName = "Tx_ExternalPost";
  else throw new Error("Invalid type to delete: " + type);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw new Error("เกิดข้อผิดพลาดในการล็อคฐานข้อมูลเพื่อการลบรายการ");
  }

  try {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { message: "Sheet not found" };

    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) return { message: "No data to delete" };

    var headers = values[0];
    var txIdColIdx = headers.indexOf("TxID");

    if (txIdColIdx === -1) {
      throw new Error("ไม่พบคอลัมน์ TxID ในตารางประวัติธุรกรรม");
    }

    var deletedCount = 0;
    // ค้นหาย้อนกลับขึ้นไปด้านบนเพื่อไม่ให้ดัชนีแถวคลาดเคลื่อนในกรณีมีหลายแถวที่ตรงกัน
    for (var r = values.length - 1; r >= 1; r--) {
      if (values[r][txIdColIdx] === id) {
        sheet.deleteRow(r + 1); // spreadsheet row index เริ่มต้นที่ 1 และรวม header แถวที่ 1
        deletedCount++;
      }
    }

    SpreadsheetApp.flush();
    return {
      message: "ลบประวัติรายการสำเร็จ (" + deletedCount + " แถว)",
      deletedCount: deletedCount,
    };
  } finally {
    lock.releaseLock();
  }
}

// 5. ค้นหารายการแยกหน่วยงาน (การค้นหาของฝั่งประชาสัมพันธ์/ผู้รับปลายทาง)
/**
 * ฟังก์ชันสืบค้นประวัติพัสดุ/จดหมายแยกสำหรับบุคคลภายนอกหรือฝั่งรับบริการ ค้นหาเฉพาะเจาะจงรายหน่วยงาน
 * @param {Object} payload - ข้อมูลคำค้นหา
 * @param {string} payload.deptName - ชื่อหน่วยงานผู้รับ/ผู้ส่งที่ต้องการค้นหา
 * @returns {Object} ข้อมูลประวัติธุรกรรม run, sort และ ext ของแผนกนั้น ๆ
 */
function publicSearch(payload) {
  var deptName = payload.deptName;
  if (!deptName) {
    return { run: [], sort: [], ext: [] };
  }

  var ss = getSpreadsheet();
  var runResults = [];
  var sortResults = [];
  var extResults = [];

  function formatTimestamp(ts) {
    if (!ts) return "";
    if (ts instanceof Date) {
      var dd = String(ts.getDate()).padStart(2, "0");
      var mm = String(ts.getMonth() + 1).padStart(2, "0");
      var yyyy = ts.getFullYear();
      return dd + "/" + mm + "/" + yyyy;
    }
    var str = String(ts);
    if (str.indexOf(" ") > -1) {
      return str.split(" ")[0];
    }
    return str;
  }

  // 1. ค้นหาประวัติรับพัสดุภายใน (Tx_InternalRun)
  var runSheet = ss.getSheetByName("Tx_InternalRun");
  if (runSheet) {
    var data = runSheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      var deptIdx = headers.indexOf("DeptName");
      var timeIdx = headers.indexOf("Timestamp");
      var routeIdx = headers.indexOf("Route");
      var roundIdx = headers.indexOf("Round");
      var countIdx = headers.indexOf("ItemCount");
      var noteIdx = headers.indexOf("Note");

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[deptIdx] === deptName) {
          runResults.push({
            date: formatTimestamp(row[timeIdx]),
            route: row[routeIdx] || "สายส่งทั่วไป",
            round: row[roundIdx] || "รอบทั่วไป",
            count: row[countIdx] || 0,
            note: row[noteIdx] || "",
          });
        }
      }
    }
  }

  // 2. ค้นหาประวัติการคัดแยกจดหมาย (Tx_InternalSort)
  var sortSheet = ss.getSheetByName("Tx_InternalSort");
  if (sortSheet) {
    var data = sortSheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      var deptIdx = headers.indexOf("DeptName");
      var timeIdx = headers.indexOf("Timestamp");
      var normalIdx = headers.indexOf("NormalCount");
      var regIdx = headers.indexOf("RegisterCount");
      var privateIdx = headers.indexOf("PrivateCount");
      var totalIdx = headers.indexOf("Total");
      var noteIdx = headers.indexOf("Note");

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[deptIdx] === deptName) {
          sortResults.push({
            date: formatTimestamp(row[timeIdx]),
            normal: row[normalIdx] || 0,
            register: row[regIdx] || 0,
            private: privateIdx > -1 ? row[privateIdx] || 0 : 0,
            total: row[totalIdx] || 0,
            note: row[noteIdx] || "",
          });
        }
      }
    }
  }

  // 3. ค้นหาประวัตินำส่งไปรษณีย์ภายนอก (Tx_ExternalPost)
  var extSheet = ss.getSheetByName("Tx_ExternalPost");
  if (extSheet) {
    var data = extSheet.getDataRange().getValues();
    if (data.length > 1) {
      var headers = data[0];
      var deptIdx = headers.indexOf("RequestingDept");
      var timeIdx = headers.indexOf("Timestamp");
      var serviceIdx = headers.indexOf("ServiceType");
      var costIdx = headers.indexOf("Cost");
      var countIdx = headers.indexOf("ItemCount");
      var trackIdx = headers.indexOf("TrackingNo");
      var fundIdx = headers.indexOf("FundSource");

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[deptIdx] === deptName) {
          extResults.push({
            date: formatTimestamp(row[timeIdx]),
            service: row[serviceIdx] || "ทั่วไป",
            cost: row[costIdx] || 0,
            count: row[countIdx] || 0,
            tracking: row[trackIdx] || "-",
            fund: row[fundIdx] || "งบประมาณหน่วยงาน",
          });
        }
      }
    }
  }

  return {
    run: runResults,
    sort: sortResults,
    ext: extResults,
  };
}

// ค้นหาแถวในชีทตามอีเมลและเขียนข้อมูลทับ
/**
 * บันทึกหรืออัปเดตข้อมูลเซสชันความปลอดภัยและ OTP ลงในชีตจัดการสิทธิ์ผู้ใช้งาน
 * @param {Sheet} sheet - ออบเจกต์ชีตประวัติ OTP Store
 * @param {string} email - อีเมลเจ้าหน้าที่ที่เกี่ยวข้อง
 * @param {string|null} otpCode - รหัส OTP 6 หลัก (หากเป็น null จะไม่ได้รับการอัปเดต)
 * @param {Date|null} otpExpires - วันเวลาหมดอายุของรหัส OTP
 * @param {string|null} sessionToken - รหัสโทเค็นเซสชันเข้าใช้งานระบบ
 * @param {Date|null} sessionExpires - วันเวลาหมดอายุของโทเค็นเซสชัน
 */
function writeSessionRecord(
  sheet,
  email,
  otpCode,
  otpExpires,
  sessionToken,
  sessionExpires,
  failedAttempts,
) {
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var headers = values[0];

  var emailIdx = headers.indexOf("Email");
  var otpCodeIdx = headers.indexOf("OTPCode");
  var otpExpiresIdx = headers.indexOf("OTPExpiresAt");
  var tokenIdx = headers.indexOf("SessionToken");
  var tokenExpiresIdx = headers.indexOf("SessionExpiresAt");

  // ตรวจสอบและสร้างคอลัมน์ FailedAttempts สำหรับเก็บจำนวนครั้งที่เข้าระบบผิดพลาด (Self-healing Header)
  var failedAttemptsIdx = headers.indexOf("FailedAttempts");
  if (failedAttemptsIdx === -1) {
    failedAttemptsIdx = headers.length;
    sheet.getRange(1, failedAttemptsIdx + 1).setValue("FailedAttempts");
    headers.push("FailedAttempts");
  }

  var foundRow = -1;
  var searchEmail = String(email).trim().toLowerCase();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][emailIdx]).trim().toLowerCase() === searchEmail) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow === -1) {
    // เพิ่มแถวใหม่
    var newRow = new Array(headers.length);
    newRow[emailIdx] = email;
    newRow[otpCodeIdx] = otpCode;
    newRow[otpExpiresIdx] = otpExpires;
    newRow[tokenIdx] = sessionToken;
    newRow[tokenExpiresIdx] = sessionExpires;
    newRow[failedAttemptsIdx] =
      failedAttempts !== undefined && failedAttempts !== null
        ? failedAttempts
        : 0;
    sheet.appendRow(newRow);
  } else {
    // อัปเดตแถวที่มีอยู่
    if (otpCode !== null)
      sheet.getRange(foundRow, otpCodeIdx + 1).setValue(otpCode);
    if (otpExpires !== null)
      sheet.getRange(foundRow, otpExpiresIdx + 1).setValue(otpExpires);
    if (sessionToken !== null)
      sheet.getRange(foundRow, tokenIdx + 1).setValue(sessionToken);
    if (sessionExpires !== null)
      sheet.getRange(foundRow, tokenExpiresIdx + 1).setValue(sessionExpires);
    if (failedAttempts !== undefined && failedAttempts !== null) {
      sheet.getRange(foundRow, failedAttemptsIdx + 1).setValue(failedAttempts);
    }
  }
}

// ขอรหัส OTP ส่งเข้าอีเมลผู้ใช้งาน
/**
 * ดำเนินการสร้างรหัส OTP 6 หลัก บันทึกลงฐานข้อมูล และจัดส่งผ่านระบบอีเมลเพื่อเข้าใช้งานระบบความปลอดภัย
 * @param {Object} payload - ข้อมูลอีเมลผู้ใช้งานที่ร้องขอ
 * @param {string} payload.email - อีเมลลงท้าย @wu.ac.th
 * @returns {Object} ข้อความแจ้งผลส่งสำเร็จ
 * @throws {Error} ข้อผิดพลาดเมื่อไม่พบอีเมลในระบบ หรือระบบเมลขัดข้อง
 */
function requestOTP(payload) {
  var email = payload.email ? payload.email.trim() : "";
  if (!email) {
    throw new Error("กรุณากรอกอีเมลผู้ใช้งาน");
  }

  var ss = getSpreadsheet();
  ensureMasterUsersHeadersSync(ss);

  // 1. ตรวจสอบว่าผู้ใช้มีรายชื่อใน Master_Users หรือไม่
  var userSheet = ss.getSheetByName("Master_Users");
  if (!userSheet) {
    throw new Error("ไม่พบตารางรายชื่อผู้ใช้งาน Master_Users ในระบบ");
  }

  var users = getSheetDataAsObjects(userSheet);
  var userRecord = users.find(function (u) {
    return (
      u.Email && String(u.Email).trim().toLowerCase() === email.toLowerCase()
    );
  });
  if (!userRecord) {
    throw new Error(
      "ไม่พบสิทธิ์การใช้งานสำหรับอีเมล " +
        email +
        " ในระบบ กรุณาติดต่อผู้ดูแลระบบ",
    );
  }

  // 2. สร้าง OTP 6 หลัก
  var otpCode = String(Math.floor(100000 + Math.random() * 900000));
  var now = new Date();
  var otpExpires = new Date(now.getTime() + 15 * 60 * 1000); // หมดอายุใน 15 นาที

  var otpSheet = ss.getSheetByName("Tx_OTPStore");
  if (!otpSheet) {
    otpSheet = ss.insertSheet("Tx_OTPStore");
    otpSheet.appendRow([
      "Email",
      "OTPCode",
      "OTPExpiresAt",
      "SessionToken",
      "SessionExpiresAt",
      "FailedAttempts",
    ]);
  } else {
    // ตรวจสอบ Server Cooldown 60 วินาที เพื่อป้องกันการส่งรหัสพร่ำเพรื่อ (Rate Limiting)
    var otpData = getSheetDataAsObjects(otpSheet);
    var record = otpData.find(function (r) {
      return (
        r.Email && String(r.Email).trim().toLowerCase() === email.toLowerCase()
      );
    });
    if (record && record.OTPExpiresAt) {
      var lastExpiresAt = new Date(record.OTPExpiresAt);
      if (!isNaN(lastExpiresAt.getTime())) {
        var lastRequestedAt = new Date(
          lastExpiresAt.getTime() - 15 * 60 * 1000,
        );
        var diffMs = now.getTime() - lastRequestedAt.getTime();
        if (diffMs > 0 && diffMs < 60 * 1000) {
          var secondsLeft = Math.ceil((60 * 1000 - diffMs) / 1000);
          throw new Error(
            "กรุณารออีก " +
              secondsLeft +
              " วินาทีก่อนขอรหัส OTP ใหม่ (Server Cooldown)",
          );
        }
      }
    }
  }

  // บันทึกรหัส OTP ลงตาราง และรีเซ็ตจำนวนครั้งที่กรอกรหัสผิดกลับเป็น 0
  writeSessionRecord(otpSheet, email, otpCode, otpExpires, "", new Date(0), 0);

  // 3. ส่งอีเมล OTP
  try {
    MailApp.sendEmail({
      to: email,
      subject: "DCG Smart Service - รหัสผ่านสำหรับเข้าสู่ระบบ (OTP)",
      htmlBody:
        "<div style='font-family: sans-serif; padding: 20px; max-width: 500px; border: 1px solid #eee; border-radius: 12px;'>" +
        "<h2 style='color: #6A2C70;'>DCG Smart Service</h2>" +
        "<p>เรียน คุณ " +
        (userRecord.FullName || email) +
        ",</p>" +
        "<p>นี่คือรหัสยืนยันตัวตน (OTP) เพื่อความปลอดภัยในการเข้าบันทึกงานไปรษณีย์ภัณฑ์:</p>" +
        "<div style='background-color: #f7f7fa; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;'>" +
        "<span style='font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4F46E5;'>" +
        otpCode +
        "</span>" +
        "</div>" +
        "<p style='font-size: 11px; color: #666;'>รหัส OTP นี้จะมีอายุการใช้งาน 15 นาที และมีอายุการลงชื่อเข้าใช้งานเฉพาะช่วงวันจันทร์ - ศุกร์ เท่านั้น</p>" +
        "<p style='font-size: 11px; color: #666;'>หากคุณไม่ได้ร้องขอรหัสผ่านนี้ กรุณาข้ามอีเมลฉบับนี้ไป</p>" +
        "</div>",
    });
  } catch (err) {
    throw new Error("ไม่สามารถส่งอีเมลรหัส OTP ได้: " + err.toString());
  }

  return { message: "รหัส OTP ส่งไปยังอีเมล " + email + " เรียบร้อยแล้ว" };
}

// ตรวจสอบ OTP และออก Token
/**
 * ตรวจสอบความถูกต้องของรหัส OTP และสร้าง Session Token เพื่อเข้าสู่ระบบของแต่ละรายวัน
 * @param {Object} payload - ข้อมูลที่ใช้ตรวจสอบ
 * @param {string} payload.email - อีเมลผู้ใช้
 * @param {string} payload.code - รหัส OTP 6 หลัก
 * @returns {Object} ข้อมูลผู้ใช้และ Token ยืนยันตัวตนสำเร็จ
 * @throws {Error} ข้อผิดพลาดกรณีรหัสไม่ถูกต้อง, หมดอายุ, หรืออยู่นอกเวลาทำงาน
 */
function verifyOTP(payload) {
  var email = payload.email ? payload.email.trim() : "";
  var code = payload.code ? payload.code.trim() : "";

  if (!email || !code) {
    throw new Error("กรุณากรอกอีเมลและรหัส OTP ให้ครบถ้วน");
  }

  var ss = getSpreadsheet();
  ensureMasterUsersHeadersSync(ss);

  var today = new Date();

  // ตรวจสอบวันทำงาน (จันทร์-ศุกร์)
  if (shouldRestrictWorkdays(ss)) {
    var dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw new Error(
        "ขออภัย ระบบจำกัดการเข้าใช้งานเฉพาะวันจันทร์ - ศุกร์ เท่านั้น",
      );
    }
  }

  var otpSheet = ss.getSheetByName("Tx_OTPStore");
  if (!otpSheet) {
    throw new Error("ตารางตรวจสอบเซสชันไม่พร้อมใช้งาน");
  }

  var otpData = getSheetDataAsObjects(otpSheet);
  var record = otpData.find(function (r) {
    return (
      r.Email && String(r.Email).trim().toLowerCase() === email.toLowerCase()
    );
  });

  if (!record) {
    throw new Error("ไม่พบรายการร้องขอรหัส OTP สำหรับอีเมลนี้");
  }

  // ตรวจสอบรหัสและอายุ
  if (String(record.OTPCode).trim() !== code) {
    var currentFailed = Number(record.FailedAttempts || 0) + 1;
    if (currentFailed >= 5) {
      // เมื่อกรอกผิดเกิน 5 ครั้ง ให้ล้างรหัส OTP และแจ้งสิทธิ์การระงับทันทีเพื่อความปลอดภัย (Brute-Force Protection)
      writeSessionRecord(otpSheet, email, "", new Date(0), null, null, 0);
      throw new Error(
        "รหัส OTP ถูกระงับเนื่องจากมีการกรอกผิดพลาดติดต่อกันเกิน 5 ครั้ง กรุณาร้องขอรหัสใหม่",
      );
    } else {
      writeSessionRecord(
        otpSheet,
        email,
        null,
        null,
        null,
        null,
        currentFailed,
      );
      var attemptsLeft = 5 - currentFailed;
      throw new Error(
        "รหัส OTP ไม่ถูกต้อง (ระบุผิดเป็นครั้งที่ " +
          currentFailed +
          "/5 - เหลือโอกาสอีก " +
          attemptsLeft +
          " ครั้ง)",
      );
    }
  }

  var expiresAt = new Date(record.OTPExpiresAt);
  if (today > expiresAt) {
    throw new Error(
      "รหัส OTP นี้หมดอายุการใช้งานแล้ว (เกิน 15 นาที) กรุณาร้องขอรหัสใหม่",
    );
  }

  // โหลดสิทธิ์
  var userSheet = ss.getSheetByName("Master_Users");
  var users = getSheetDataAsObjects(userSheet);
  var userRecord = users.find(function (u) {
    return (
      u.Email && String(u.Email).trim().toLowerCase() === email.toLowerCase()
    );
  });
  if (!userRecord) {
    throw new Error("ไม่พบสิทธิ์การใช้งานสำหรับผู้ใช้นี้");
  }

  // ออก Session Token
  var sessionToken =
    "ST-" +
    Utilities.getUuid().replace(/-/g, "").substring(0, 16).toUpperCase();
  // เซสชันหมดอายุตอน 23:59:59 ของวันปัจจุบัน เพื่อความปลอดภัยในการทำงานรายวัน
  var sessionExpires = new Date();
  sessionExpires.setHours(23, 59, 59, 999);

  // ล้างรหัส OTP เดิมออกจากชีทหลังตรวจสอบผ่านเพื่อป้องกันการนำรหัสเดิมกลับมาใช้ซ้ำ (OTP Reuse Prevention) และรีเซ็ตจำนวนการกรอกผิดเป็น 0
  writeSessionRecord(
    otpSheet,
    email,
    "",
    new Date(0),
    sessionToken,
    sessionExpires,
    0,
  );

  return {
    email: userRecord.Email,
    fullName: userRecord.FullName,
    role: userRecord.Role,
    userID: userRecord.UserID || "",
    sessionToken: sessionToken,
  };
}

// ตรวจสอบการจำกัดสิทธิ์วันทำการ (จันทร์-ศุกร์) จาก System_Config
/**
 * ตรวจสอบจากค่ากำหนดของระบบ (System_Config) ว่าต้องจำกัดการเข้าใช้งานเฉพาะวันทำงาน (จันทร์-ศุกร์) หรือไม่
 * @param {Spreadsheet} ss - ออบเจกต์สเปรดชีตหลัก
 * @returns {boolean} ค่าสถานะจำกัดการเข้าใช้งาน (true = จำกัดเฉพาะวันจันทร์-ศุกร์, false = ใช้งานได้ตลอดเวลา)
 */
function shouldRestrictWorkdays(ss) {
  try {
    var configSheet = ss.getSheetByName("System_Config");
    if (configSheet) {
      var configObjects = getSheetDataAsObjects(configSheet);
      var restrictObj = configObjects.find(function (c) {
        return c.Key === "restrictWorkdays";
      });
      if (restrictObj) {
        var val = restrictObj.Value;
        return (
          val === true || val === "true" || String(val).toUpperCase() === "TRUE"
        );
      }
    }
  } catch (e) {
    console.warn("Error reading restrictWorkdays config: " + e.toString());
  }
  return true; // Default restrict to weekdays only
}

// ฟังก์ชันใช้สำหรับกดรันในสคริปต์เพื่อกดยืนยันสิทธิ์ส่งอีเมล (Authorization) ครั้งแรก
/**
 * ฟังก์ชันสำหรับผู้ดูแลระบบเรียกใช้งานทดสอบ เพื่อให้ระบบอนุมัติสิทธิ์ (Authorization) การส่งอีเมลของโครงการ Apps Script ในครั้งแรก
 */
function testSendEmail() {
  var ss = getSpreadsheet();
  var userEmail = Session.getActiveUser().getEmail();
  if (userEmail) {
    MailApp.sendEmail({
      to: userEmail,
      subject: "DCG Smart Service - Test Email Authorization",
      htmlBody: "<p>ยืนยันสิทธิ์การส่งอีเมลสำเร็จเรียบร้อยแล้ว!</p>",
    });
    Logger.log("ส่งอีเมลทดสอบไปที่ " + userEmail + " สำเร็จ");
  } else {
    Logger.log("ไม่พบอีเมลผู้ใช้งานปัจจุบัน");
  }
}

// --- Feedback Channel Actions (Milestone 2) ---

/**
 * บันทึกรายงานปัญหาและข้อเสนอแนะของผู้ใช้ลงตาราง พร้อมกับยิงการแจ้งเตือนไปยัง LINE Notify ของผู้ดูแลระบบกรณีปัญหาร้ายแรง (High/Critical)
 * @param {Object} payload - ข้อมูลข้อเสนอแนะและบั๊กที่ส่งมา
 * @param {string} payload.type - ประเภทรายงาน ('Bug' | 'Suggestion' | 'Other')
 * @param {string} payload.severity - ระดับความร้ายแรง ('Low' | 'Medium' | 'High' | 'Critical')
 * @param {string} payload.description - คำอธิบายรายละเอียด
 * @param {string} payload.staffEmail - อีเมลพนักงานผู้ส่งรายงาน
 * @returns {Object} ข้อความยืนยันผลสำเร็จ
 * @throws {Error} ข้อผิดพลาดเมื่อข้อมูลไม่ถูกต้องตามรูปแบบข้อจำกัดความปลอดภัย
 */
function handleFeedback(payload) {
  var type = payload.type;
  var severity = payload.severity;
  var description = payload.description;
  var staffEmail = payload.staffEmail;

  if (!type || !severity || !description || !staffEmail) {
    throw new Error("ข้อมูลไม่ครบถ้วนสำหรับการบันทึกข้อเสนอแนะ");
  }

  // Type & Severity domain constraint validations
  if (["Bug", "Suggestion", "Other"].indexOf(type) === -1) {
    throw new Error("ประเภทข้อเสนอแนะไม่ถูกต้อง");
  }
  if (["Low", "Medium", "High", "Critical"].indexOf(severity) === -1) {
    throw new Error("ระดับความรุนแรงไม่ถูกต้อง");
  }

  var ss = getSpreadsheet();
  var sheetName = "Feedback_Reports";
  var headers = [
    "Timestamp",
    "StaffEmail",
    "FeedbackType",
    "Severity",
    "Description",
  ];

  // Prevent race conditions using GAS LockService
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw new Error(
      "ระบบหนาแน่นเนื่องจากมีการส่งข้อมูลจำนวนมาก กรุณาลองใหม่อีกครั้ง",
    );
  }

  try {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
    }

    var timestamp = new Date();

    // Map values and sanitize using sanitizeInput to protect against Formula Injection
    var rowData = [
      timestamp,
      sanitizeInput(staffEmail),
      sanitizeInput(type),
      sanitizeInput(severity),
      sanitizeInput(description),
    ];

    sheet.appendRow(rowData);

    // ตั้งค่ารูปแบบคอลัมน์ Timestamp ให้แสดงเวลาด้วย
    var lastRow = sheet.getLastRow();
    var timeColIdx = headers.indexOf("Timestamp");
    if (timeColIdx !== -1) {
      sheet
        .getRange(lastRow, timeColIdx + 1, 1, 1)
        .setNumberFormat("yyyy-MM-dd HH:mm:ss");
    }

    SpreadsheetApp.flush();

    // Notify administrators if severity is High or Critical
    if (severity === "High" || severity === "Critical") {
      var formattedTime = Utilities.formatDate(
        timestamp,
        "GMT+7",
        "yyyy-MM-dd HH:mm:ss",
      );
      var alertMessage =
        "\n⚠️ แจ้งเตือนข้อเสนอแนะเร่งด่วน (" +
        severity +
        ")" +
        "\n--------------------------------------" +
        "\nประเภท: " +
        type +
        "\nผู้รายงาน: " +
        staffEmail +
        "\nรายละเอียด: " +
        description +
        "\nเวลา: " +
        formattedTime;
      sendLineNotification(alertMessage);
    }

    return { message: "บันทึกข้อเสนอแนะเรียบร้อยแล้ว" };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ส่งข้อความแจ้งเตือนผ่าน API บริการ LINE Notify ไปยังกลุ่มสนทนาของผู้ดูแลระบบ
 * @param {string} message - ข้อความแจ้งเตือนที่ต้องการส่ง
 */
function sendLineNotification(message) {
  var token =
    PropertiesService.getScriptProperties().getProperty("LINE_NOTIFY_TOKEN");
  if (!token) {
    console.warn("LINE_NOTIFY_TOKEN is not set. LINE message skipped.");
    return;
  }

  var url = "https://notify-api.line.me/api/notify";
  var options = {
    method: "post",
    headers: {
      Authorization: "Bearer " + token,
    },
    payload: {
      message: message,
    },
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      console.error(
        "LINE Notify failed with status " +
          responseCode +
          ": " +
          response.getContentText(),
      );
    }
  } catch (e) {
    console.error("Error sending LINE notification: " + e.toString());
  }
}

/**
 * Milestone 3: Auto-Backup Engine Implementation
 */

// ค้นหาหรือสร้างโฟลเดอร์สำหรับสำรองข้อมูลและบันทึก ID ลงใน Script Properties
function getOrCreateBackupFolder() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("BACKUP_FOLDER_ID");
  var folder;
  var expectedFolderName = "Dcg Smart Service_Backup";

  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
      if (folder.getName() === expectedFolderName) {
        return folder;
      }
    } catch (e) {
      console.warn(
        "Cached backup folder ID not found, inaccessible, or has wrong name. Searching by name...",
      );
    }
  }

  var folders = DriveApp.getFoldersByName(expectedFolderName);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(expectedFolderName);
  }

  props.setProperty("BACKUP_FOLDER_ID", folder.getId());
  return folder;
}

// ฟังก์ชันหลักในการรันการสำรองข้อมูล (ส่งออกเฉพาะ 3 ชีทธุรกรรมเป็น Excel .xlsx)
/**
 * ฟังก์ชันหลักในการทำสำรองข้อมูลระบบ โดยสร้างชีตชั่วคราว ดึงตารางธุรกรรมประวัติหลัก 3 ตาราง ส่งออกเป็นไฟล์ Excel (.xlsx) และบันทึกลง Drive
 */
function runAutoBackup() {
  var tempSSId = null;

  try {
    var sourceSS = getSpreadsheet();
    var sheetsToBackup = [
      "Tx_InternalRun",
      "Tx_InternalSort",
      "Tx_ExternalPost",
      "Master_Users",
      "Master_Departments",
      "Master_Services",
      "System_Config",
    ];

    // 1. สร้าง Spreadsheet ชั่วคราวเพื่อรวบรวมชีทธุรกรรม
    var timestamp = Utilities.formatDate(
      new Date(),
      "GMT+7",
      "yyyy-MM-dd_HHmmss",
    );
    var tempSS = SpreadsheetApp.create("temp_backup_" + timestamp);
    tempSSId = tempSS.getId();

    // คัดลอกชีทธุรกรรมไปยังไฟล์ชั่วคราว
    var copiedCount = 0;
    sheetsToBackup.forEach(function (name) {
      var sheet = sourceSS.getSheetByName(name);
      if (sheet) {
        sheet.copyTo(tempSS).setName(name);
        copiedCount++;
      } else {
        console.warn(
          "Warning: Sheet '" + name + "' not found in source spreadsheet.",
        );
      }
    });

    // ลบชีทเริ่มต้น (Sheet1/ชีต1) ออกจาก Spreadsheet ชั่วคราว
    if (copiedCount > 0) {
      var defaultSheet =
        tempSS.getSheetByName("Sheet1") ||
        tempSS.getSheetByName("ชีต1") ||
        tempSS.getSheets()[0];
      if (defaultSheet && tempSS.getSheets().length > copiedCount) {
        tempSS.deleteSheet(defaultSheet);
      }
    }

    SpreadsheetApp.flush();

    // 2. เรียก Sheets API ผ่าน UrlFetch เพื่อส่งออกเป็นไฟล์ Excel (.xlsx)
    var url =
      "https://docs.google.com/spreadsheets/d/" +
      tempSSId +
      "/export?format=xlsx";
    var token = ScriptApp.getOAuthToken();
    var response = UrlFetchApp.fetch(url, {
      headers: {
        Authorization: "Bearer " + token,
      },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(
        "HTTP " + response.getResponseCode() + ": " + response.getContentText(),
      );
    }

    var backupBlob = response
      .getBlob()
      .setName("Dcg_Smart_Service_Backup_" + timestamp + ".xlsx");

    // 3. บันทึกลงโฟลเดอร์เฉพาะใน Google Drive
    var folder = getOrCreateBackupFolder();
    var file = folder.createFile(backupBlob);
    console.log("Backup file saved successfully: " + file.getName());

    // 4. บังคับใช้นโยบายเก็บรักษาข้อมูลย้อนหลัง 30 วัน (Retention Policy)
    applyBackupRetention(folder);
  } catch (err) {
    var errMessage = "❌ ระบบสำรองข้อมูลล้มเหลว: " + err.toString();
    console.error(errMessage);
    // ส่งข้อความแจ้งเตือนผ่าน LINE Notify ของผู้ดูแลระบบ
    sendLineNotification(errMessage);
  } finally {
    // ลบ Spreadsheet ชั่วคราวออกจาก Google Drive เพื่อความเป็นระเบียบ
    if (tempSSId) {
      try {
        DriveApp.getFileById(tempSSId).setTrashed(true);
      } catch (e) {
        console.error(
          "Failed to delete temporary spreadsheet: " + e.toString(),
        );
      }
    }
  }
}

// ลบไฟล์สำรองที่มีอายุเกิน 30 วันในโฟลเดอร์สำรองข้อมูล
/**
 * บังคับใช้นโยบายการลบไฟล์ข้อมูลสำรองย้อนหลังที่เก่าเกิน 30 วันอัตโนมัติ (Retention Policy) เพื่อป้องกันปริมาณพื้นที่เต็มใน Google Drive
 * @param {Folder} folder - ออบเจกต์โฟลเดอร์ที่เก็บไฟล์สำรองข้อมูล
 */
function applyBackupRetention(folder) {
  var retentionDays = 30;
  var cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  var files = folder.getFiles();
  var deletedCount = 0;

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();

    // ตรวจสอบความปลอดภัยของชื่อไฟล์เพื่อป้องกันการลบข้อมูลสำคัญผิดพลาด (รองรับทั้งชื่อเก่าและใหม่)
    if (
      (name.indexOf("WUS_Track_Backup_") === 0 ||
        name.indexOf("Dcg_Smart_Service_Backup_") === 0) &&
      name.slice(-5) === ".xlsx"
    ) {
      if (file.getDateCreated() < cutoffDate) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
  }

  if (deletedCount > 0) {
    console.log(
      "Retention Policy applied. Trashed " +
        deletedCount +
        " old backup files.",
    );
  }
}

// ตั้งค่า Daily Trigger ในเวลา 02:00 น. โดยหลีกเลี่ยงการสร้าง Trigger ซ้ำซ้อน
/**
 * ตั้งค่าการรันอัตโนมัติ (Programmatic Trigger) รายวันของสคริปต์สำรองข้อมูล ในช่วงเวลา 02.00 น. - 03.00 น.
 */
function setupDailyBackupTrigger() {
  var triggerFunctionName = "runAutoBackup";
  var triggers = ScriptApp.getProjectTriggers();

  // ลบ Trigger เดิมของฟังก์ชันนี้ที่มีอยู่ทั้งหมดเพื่อป้องกันการทำงานซ้ำ
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === triggerFunctionName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // สร้าง Trigger ใหม่ให้รันทุกวันในช่วงเวลา 02:00 น. - 03:00 น.
  ScriptApp.newTrigger(triggerFunctionName)
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  console.log(
    "Programmatic daily trigger at 02:00 (GMT+7) configured successfully.",
  );
}
