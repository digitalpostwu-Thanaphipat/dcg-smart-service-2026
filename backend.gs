// --- DCG Smart Track Backend (Production Grade) ---

var BACKEND_VERSION = "2026-06-12-v35-session-policy";

// [GGSheet Protocol] - ฐานข้อมูลหลัก (สามารถสลับไปดึงจาก Script Properties หรือใช้ ID สำรองเริ่มต้นนี้)
var SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "";

var CRITICAL_SCHEMA_HEADERS = {
  Master_Users: ["UserID", "Email", "FullName", "Role", "Status"],
  Master_Departments: ["DeptID", "DeptName", "Building", "Floor", "RouteGroup", "BudgetOwner"],
  Master_Services: ["ServiceID", "ServiceName", "Description"],
  Tx_InternalRun: ["TxID", "Timestamp", "DeptName", "Route", "Round", "ItemCount", "Note", "StaffEmail"],
  Tx_InternalSort: ["TxID", "Timestamp", "DeptName", "NormalCount", "RegisterCount", "PrivateCount", "Total", "Note", "StaffEmail"],
  Tx_ExternalPost: ["TxID", "Timestamp", "RequestingDept", "ServiceType", "Cost", "ItemCount", "TrackingNo", "FundSource", "StaffEmail"],
  Tx_SelfServiceOTPStore: ["Email", "OTPCode", "OTPExpiresAt", "SessionToken", "SessionExpiresAt", "FailedAttempts", "LastRequestedAt"],
  Tx_SelfServiceLog: [
    "Timestamp",
    "Email",
    "Action",
    "QueryText",
    "QueryMode",
    "SelectedDeptName",
    "BudgetOwnerEffective",
    "MatchedDeptCount",
    "DateMode",
    "StartDate",
    "EndDate",
    "FiscalYear",
    "ResultCountRun",
    "ResultCountSort",
    "ResultCountExt",
    "ExportFormat",
    "TrackingMode",
    "Status",
    "UserAgent",
    "ErrorCode",
    "ErrorMessage",
  ],
  Feedback_Reports: ["Timestamp", "StaffEmail", "FeedbackType", "Severity", "Description"],
};

var ARCHIVE_TRANSACTION_SHEETS = [
  "Tx_InternalRun",
  "Tx_InternalSort",
  "Tx_ExternalPost",
];

var ARCHIVE_INDEX_HEADERS = [
  "Timestamp",
  "FiscalYear",
  "SourceSpreadsheetId",
  "ArchiveSpreadsheetId",
  "SheetName",
  "RowCount",
  "Checksum",
  "Mode",
  "Status",
];

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
  var json;
  try {
    json = JSON.parse(e.postData.contents);
  } catch (parseError) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: 'คำขอไม่ถูกต้อง (Invalid JSON)' })
    ).setMimeType(ContentService.MimeType.JSON);
  }
  var action = json.action;
  var payload = json.payload;
  var auth = json.auth || {};
  var result = {};
  var staffSessionUser = null;

  try {
    // [GGSheet Protocol] - ป้องกันการเขียน อ่าน หรือลบข้อมูลโดยไม่ผ่านการยืนยันตัวตนจริง
    if (
      action === "saveBatch" ||
      action === "deleteLog" ||
      action === "feedback" ||
      action === "getSchemaAudit" ||
      action === "archiveRollover" ||
      action === "getMetaData" ||
      action === "searchLogs"
    ) {
      staffSessionUser = verifySessionToken(auth.sessionToken);
    }

    if (action === "getHealth") {
      result = getHealth();
    } else if (action === "getSchemaAudit") {
      result = getSchemaAudit();
    } else if (action === "archiveRollover") {
      result = runArchiveRollover(payload);
    } else if (action === "getMetaData") {
      result = getMetaData();
    } else if (action === "getPublicMetaData") {
      result = getPublicMetaData();
    } else if (action === "searchLogs") {
      result = searchLogsCrossYear(payload, staffSessionUser);
    } else if (action === "saveBatch") {
      result = saveBatch(payload);
    } else if (action === "deleteLog") {
      result = deleteLog(payload);
    } else if (action === "publicSearch") {
      result = publicSearch(payload);
    } else if (action === "selfServiceSearch") {
      result = selfServiceSearch(payload, auth);
    } else if (action === "requestOTP") {
      result = requestOTP(payload);
    } else if (action === "verifyOTP") {
      result = verifyOTP(payload);
    } else if (action === "requestSelfServiceOTP") {
      result = requestSelfServiceOTP(payload);
    } else if (action === "verifySelfServiceOTP") {
      result = verifySelfServiceOTP(payload);
    } else if (action === "logSelfServiceEvent") {
      var selfServiceUser = verifySelfServiceSessionToken(auth.selfServiceSessionToken);
      payload.email = selfServiceUser.email;
      result = logSelfServiceEvent(payload);
    } else if (action === "logStaffReportEvent") {
      var staffReportUser = verifySessionToken(auth.sessionToken);
      result = logStaffReportEvent(payload, staffReportUser);
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
function getSchemaRepairApproved() {
  return (
    PropertiesService.getScriptProperties().getProperty("SCHEMA_REPAIR_APPROVED") ===
    "true"
  );
}

function ensureMasterUsersHeadersSync(ss) {
  var userSheet = ss.getSheetByName("Master_Users");
  if (!userSheet) return { status: "missing_sheet", repairs: [] };

  var lastRow = userSheet.getLastRow();
  var lastCol = userSheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return { status: "empty_sheet", repairs: [] };

  var headers = userSheet
    .getRange(1, 1, 1, Math.min(lastCol, 10))
    .getValues()[0];
  var changed = false;
  var repairApproved = getSchemaRepairApproved();
  var repairs = [];

  // 1. ถ้าหัวคอลัมน์ B ว่างเปล่า และแถวที่ 2 เป็นอีเมล ให้ตั้งค่าเป็น "Email"
  if (
    headers.length >= 2 &&
    (!headers[1] || String(headers[1]).trim() === "")
  ) {
    var b2Val = String(userSheet.getRange(2, 2).getValue()).trim();
    if (b2Val.indexOf("@") > -1) {
      repairs.push("set Master_Users!B1 to Email");
      if (repairApproved) {
        userSheet.getRange(1, 2).setValue("Email");
        headers[1] = "Email";
        changed = true;
      }
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
      repairs.push("delete empty Master_Users column C before FullName");
      if (repairApproved) {
        userSheet.deleteColumn(3);
        changed = true;
      }
    }
  }

  if (changed) {
    SpreadsheetApp.flush();
  }

  if (repairs.length > 0 && !repairApproved) {
    console.warn(
      "Schema repair blocked: set SCHEMA_REPAIR_APPROVED=true to allow repairs. " +
        repairs.join("; "),
    );
  }

  return {
    status: repairs.length === 0 ? "ok" : repairApproved ? "repaired" : "repair_required",
    repairApproved: repairApproved,
    repairs: repairs,
  };
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

function searchLogsCrossYear(payload, staffUser) {
  var filters = payload.filters || {};
  var startDateStr = filters.startDate ? formatYYYYMMDD(filters.startDate) : "";
  var endDateStr = filters.endDate ? formatYYYYMMDD(filters.endDate) : "";
  var filterDept = filters.dept ? String(filters.dept).toLowerCase() : "";
  var readPlan = getReadSourcesForDateRange(startDateStr, endDateStr);
  var runResults = [];
  var sortResults = [];
  var extResults = [];

  readPlan.sources.forEach(function (source) {
    var ss = source.spreadsheet;

    var runSheet = ss.getSheetByName("Tx_InternalRun");
    if (runSheet) {
      runResults = runResults.concat(getSheetDataAsObjects(runSheet).filter(function (row) {
        if (!rowMatchesDateAndSource(row, startDateStr, endDateStr, source)) return false;
        if (
          filterDept &&
          row.DeptName &&
          String(row.DeptName).toLowerCase().indexOf(filterDept) === -1
        ) {
          return false;
        }
        return true;
      }).map(function (row) {
        return tagSource(row, source);
      }));
    }

    var sortSheet = ss.getSheetByName("Tx_InternalSort");
    if (sortSheet) {
      sortResults = sortResults.concat(getSheetDataAsObjects(sortSheet).filter(function (row) {
        if (!rowMatchesDateAndSource(row, startDateStr, endDateStr, source)) return false;
        if (
          filterDept &&
          row.DeptName &&
          String(row.DeptName).toLowerCase().indexOf(filterDept) === -1
        ) {
          return false;
        }
        return true;
      }).map(function (row) {
        return tagSource(row, source);
      }));
    }

    var extSheet = ss.getSheetByName("Tx_ExternalPost");
    if (extSheet) {
      extResults = extResults.concat(getSheetDataAsObjects(extSheet).filter(function (row) {
        if (!rowMatchesDateAndSource(row, startDateStr, endDateStr, source)) return false;
        if (
          filterDept &&
          row.RequestingDept &&
          String(row.RequestingDept).toLowerCase().indexOf(filterDept) === -1
        ) {
          return false;
        }
        return true;
      }).map(function (row) {
        return tagSource(row, source);
      }));
    }
  });

  var response = {
    run: runResults,
    sort: sortResults,
    ext: extResults,
    meta: {
      activeFiscalYear: readPlan.activeFiscalYear,
      fiscalYears: readPlan.fiscalYears,
      archiveUsed: readPlan.archiveUsed,
      missingArchiveYears: readPlan.missingArchiveYears,
    },
  };
  if (readPlan.archiveUsed && staffUser && staffUser.email) {
    var logResult = appendSelfServiceLog({
      email: staffUser.email,
      action: "staff_report_search",
      queryText: filterDept,
      queryMode: "staff_report",
      selectedDeptName: filters.dept || "",
      dateMode: filters.dateMode || "",
      startDate: startDateStr,
      endDate: endDateStr,
      fiscalYear: readPlan.fiscalYears.join(","),
      resultCountRun: runResults.length,
      resultCountSort: sortResults.length,
      resultCountExt: extResults.length,
      trackingMode: "archive_report",
      status: "success",
    });
    response.meta.logStatus = logResult.logStatus;
  }
  return response;
}

function getPublicMetaData() {
  var metadata = getMetaData();
  return {
    departments: metadata.departments,
    services: metadata.services,
    config: metadata.config,
  };
}

function auditSheetSchema(ss, sheetName, expectedHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      sheetName: sheetName,
      status: "missing_sheet",
      headerCount: 0,
      expectedCount: expectedHeaders.length,
      missingHeaders: expectedHeaders,
      extraHeaders: [],
      orderMismatches: [],
    };
  }

  var lastCol = sheet.getLastColumn();
  var headers =
    lastCol > 0
      ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
          return String(h || "").trim();
        })
      : [];
  var missingHeaders = expectedHeaders.filter(function (header) {
    return headers.indexOf(header) === -1;
  });
  var extraHeaders = headers.filter(function (header) {
    return header && expectedHeaders.indexOf(header) === -1;
  });
  var orderMismatches = [];

  expectedHeaders.forEach(function (header, index) {
    if (headers[index] !== header) {
      orderMismatches.push({
        column: index + 1,
        expected: header,
        actual: headers[index] || "",
      });
    }
  });

  return {
    sheetName: sheetName,
    status:
      missingHeaders.length === 0 && orderMismatches.length === 0
        ? "ok"
        : "schema_mismatch",
    headerCount: headers.length,
    expectedCount: expectedHeaders.length,
    missingHeaders: missingHeaders,
    extraHeaders: extraHeaders,
    orderMismatches: orderMismatches,
  };
}

function getSchemaAudit() {
  var ss = getSpreadsheet();
  var sheetNames = Object.keys(CRITICAL_SCHEMA_HEADERS);
  var sheets = sheetNames.map(function (sheetName) {
    return auditSheetSchema(ss, sheetName, CRITICAL_SCHEMA_HEADERS[sheetName]);
  });
  var failed = sheets.filter(function (sheet) {
    return sheet.status !== "ok";
  });

  return {
    mode: "read_only",
    repairApproved: getSchemaRepairApproved(),
    checkedAt: new Date(),
    checkedSheets: sheets.length,
    status: failed.length === 0 ? "ok" : "attention_required",
    sheets: sheets,
  };
}

function getThaiFiscalYearFromDate(value) {
  var date = new Date(value);
  if (isNaN(date.getTime())) return null;
  var gregorianYear = date.getFullYear();
  var fiscalYear = date.getMonth() >= 9 ? gregorianYear + 544 : gregorianYear + 543;
  return fiscalYear;
}

function getCurrentThaiFiscalYear(now) {
  return getThaiFiscalYearFromDate(now || new Date());
}

function getArchiveActiveFiscalYear(payload) {
  var activeFiscalYear = payload && payload.activeFiscalYear
    ? Number(payload.activeFiscalYear)
    : getCurrentThaiFiscalYear(new Date());
  if (!activeFiscalYear || activeFiscalYear < 2500) {
    throw new Error("Invalid active fiscal year for archive rollover");
  }
  return activeFiscalYear;
}

function toHexDigest(bytes) {
  return bytes
    .map(function (byte) {
      var value = byte;
      if (value < 0) value += 256;
      return ("0" + value.toString(16)).slice(-2);
    })
    .join("");
}

function computeArchiveChecksum(sheetName, rows) {
  var text = sheetName + "|" + JSON.stringify(rows || []);
  if (typeof Utilities !== "undefined" && Utilities.computeDigest) {
    return toHexDigest(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text));
  }
  var hash = 0;
  for (var i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return String(hash);
}

function collectArchiveRowsForSheet(ss, sheetName, activeFiscalYear) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      sheetName: sheetName,
      status: "missing_sheet",
      headers: [],
      rows: [],
      rowCount: 0,
      checksum: computeArchiveChecksum(sheetName, []),
    };
  }

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return {
      sheetName: sheetName,
      status: "ok",
      headers: values[0] || [],
      rows: [],
      rowCount: 0,
      checksum: computeArchiveChecksum(sheetName, []),
    };
  }

  var headers = values[0];
  var timestampIdx = headers.indexOf("Timestamp");
  if (timestampIdx === -1) {
    return {
      sheetName: sheetName,
      status: "missing_timestamp",
      headers: headers,
      rows: [],
      rowCount: 0,
      checksum: computeArchiveChecksum(sheetName, []),
    };
  }

  var rows = [];
  var firstDate = "";
  var lastDate = "";
  var fiscalYearMap = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var fiscalYear = getThaiFiscalYearFromDate(row[timestampIdx]);
    if (fiscalYear && fiscalYear < activeFiscalYear) {
      rows.push(row);
      fiscalYearMap[fiscalYear] = true;
      var formatted = formatYYYYMMDD(row[timestampIdx]);
      if (!firstDate || formatted < firstDate) firstDate = formatted;
      if (!lastDate || formatted > lastDate) lastDate = formatted;
    }
  }

  return {
    sheetName: sheetName,
    status: "ok",
    headers: headers,
    rows: rows,
    rowCount: rows.length,
    checksum: computeArchiveChecksum(sheetName, rows),
    fiscalYears: Object.keys(fiscalYearMap).map(function (year) {
      return Number(year);
    }).sort(),
    firstDate: firstDate,
    lastDate: lastDate,
  };
}

function buildArchiveRolloverPlan(ss, activeFiscalYear) {
  var sourceSpreadsheetId = ss.getId ? ss.getId() : "";
  var sheets = ARCHIVE_TRANSACTION_SHEETS.map(function (sheetName) {
    var result = collectArchiveRowsForSheet(ss, sheetName, activeFiscalYear);
    return {
      sheetName: result.sheetName,
      status: result.status,
      rowCount: result.rowCount,
      checksum: result.checksum,
      fiscalYears: result.fiscalYears || [],
      firstDate: result.firstDate || "",
      lastDate: result.lastDate || "",
    };
  });
  var totalRows = sheets.reduce(function (sum, sheet) {
    return sum + sheet.rowCount;
  }, 0);

  return {
    mode: "dry_run",
    activeFiscalYear: activeFiscalYear,
    sourceSpreadsheetId: sourceSpreadsheetId,
    checkedAt: new Date(),
    totalRows: totalRows,
    sheets: sheets,
    deleteApproved: getScriptPropertyValue("ARCHIVE_DELETE_APPROVED") === "true",
  };
}

function getScriptPropertyValue(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function ensureArchiveIndexSheet(ss) {
  var sheet = ss.getSheetByName("Archive_Index");
  if (!sheet) {
    sheet = ss.insertSheet("Archive_Index");
    sheet.appendRow(ARCHIVE_INDEX_HEADERS);
    return sheet;
  }
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (headers.join("|") !== ARCHIVE_INDEX_HEADERS.join("|")) {
    throw new Error("Archive_Index schema mismatch; manual review required");
  }
  return sheet;
}

function copyRowsToArchiveSheet(archiveSS, sheetName, headers, rows) {
  var archiveSheet = archiveSS.getSheetByName(sheetName);
  if (!archiveSheet) {
    archiveSheet = archiveSS.insertSheet(sheetName);
    archiveSheet.appendRow(headers);
  }
  if (rows.length > 0) {
    var startRow = archiveSheet.getLastRow() + 1;
    archiveSheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
  }
  return rows.length;
}

function appendArchiveIndex(indexSheet, plan, archiveSpreadsheetId, mode, status) {
  plan.sheets.forEach(function (sheet) {
    var fiscalYears = sheet.fiscalYears && sheet.fiscalYears.length
      ? sheet.fiscalYears
      : [plan.activeFiscalYear];
    fiscalYears.forEach(function (fiscalYear) {
      indexSheet.appendRow([
        new Date(),
        fiscalYear,
        plan.sourceSpreadsheetId,
        archiveSpreadsheetId,
        sheet.sheetName,
        sheet.rowCount,
        sheet.checksum,
        mode,
        status,
      ]);
    });
  });
}

function runArchiveRollover(payload) {
  var mode = payload && payload.mode ? String(payload.mode) : "dry_run";
  var ss = getSpreadsheet();
  var activeFiscalYear = getArchiveActiveFiscalYear(payload);
  var plan = buildArchiveRolloverPlan(ss, activeFiscalYear);

  if (mode === "dry_run") {
    return plan;
  }

  if (mode === "delete") {
    if (getScriptPropertyValue("ARCHIVE_DELETE_APPROVED") !== "true") {
      throw new Error("Archive deletion blocked: ARCHIVE_DELETE_APPROVED is not true");
    }
    throw new Error("Archive deletion mode is not implemented in this local Phase C safety pass");
  }

  if (mode !== "copy_only") {
    throw new Error("Invalid archive rollover mode: " + mode);
  }

  if (getScriptPropertyValue("ARCHIVE_COPY_APPROVED") !== "true") {
    throw new Error("Archive copy blocked: ARCHIVE_COPY_APPROVED is not true");
  }

  var archiveSpreadsheetId = getScriptPropertyValue("ARCHIVE_SPREADSHEET_ID");
  if (!archiveSpreadsheetId) {
    throw new Error("Archive copy blocked: ARCHIVE_SPREADSHEET_ID is missing");
  }

  var archiveSS = SpreadsheetApp.openById(archiveSpreadsheetId);
  var copyResults = ARCHIVE_TRANSACTION_SHEETS.map(function (sheetName) {
    var collected = collectArchiveRowsForSheet(ss, sheetName, activeFiscalYear);
    if (collected.status !== "ok") {
      return {
        sheetName: sheetName,
        status: collected.status,
        copiedRows: 0,
        checksum: collected.checksum,
      };
    }
    return {
      sheetName: sheetName,
      status: "copied",
      copiedRows: copyRowsToArchiveSheet(
        archiveSS,
        sheetName,
        collected.headers,
        collected.rows,
      ),
      checksum: collected.checksum,
    };
  });

  var indexSheet = ensureArchiveIndexSheet(ss);
  appendArchiveIndex(indexSheet, plan, archiveSpreadsheetId, mode, "copied_no_delete");

  return {
    mode: mode,
    activeFiscalYear: activeFiscalYear,
    archiveSpreadsheetId: archiveSpreadsheetId,
    deletePerformed: false,
    totalCopiedRows: copyResults.reduce(function (sum, item) {
      return sum + item.copiedRows;
    }, 0),
    sheets: copyResults,
  };
}

function getArchiveIndexEntries(ss) {
  var sheet = ss.getSheetByName("Archive_Index");
  if (!sheet) return [];
  var rows = getSheetDataAsObjects(sheet);
  return rows.filter(function (row) {
    return row.ArchiveSpreadsheetId && row.FiscalYear && row.SheetName;
  }).map(function (row) {
    return {
      fiscalYear: Number(row.FiscalYear),
      archiveSpreadsheetId: String(row.ArchiveSpreadsheetId),
      sheetName: String(row.SheetName),
      mode: String(row.Mode || ""),
      status: String(row.Status || ""),
    };
  });
}

function getFiscalYearsForDateRange(startDateStr, endDateStr) {
  var currentFiscalYear = getCurrentThaiFiscalYear(new Date());
  var startFiscalYear = startDateStr ? getThaiFiscalYearFromDate(startDateStr) : currentFiscalYear;
  var endFiscalYear = endDateStr ? getThaiFiscalYearFromDate(endDateStr) : currentFiscalYear;
  if (!startFiscalYear) startFiscalYear = currentFiscalYear;
  if (!endFiscalYear) endFiscalYear = currentFiscalYear;
  if (startFiscalYear > endFiscalYear) {
    var tmp = startFiscalYear;
    startFiscalYear = endFiscalYear;
    endFiscalYear = tmp;
  }

  var fiscalYears = [];
  for (var year = startFiscalYear; year <= endFiscalYear; year++) {
    fiscalYears.push(year);
  }
  return fiscalYears;
}

function getReadSourcesForDateRange(startDateStr, endDateStr) {
  var activeSS = getSpreadsheet();
  var activeFiscalYear = getCurrentThaiFiscalYear(new Date());
  var fiscalYears = getFiscalYearsForDateRange(startDateStr, endDateStr);
  var archiveIndex = getArchiveIndexEntries(activeSS);
  var sources = [];
  var missingArchiveYears = [];
  var openedArchiveMap = {};

  fiscalYears.forEach(function (fiscalYear) {
    if (fiscalYear >= activeFiscalYear) {
      if (!sources.some(function (source) {
        return source.sourceType === "active";
      })) {
        sources.push({
          sourceType: "active",
          fiscalYear: activeFiscalYear,
          spreadsheet: activeSS,
          spreadsheetId: activeSS.getId ? activeSS.getId() : "",
        });
      }
      return;
    }

    var archiveEntry = archiveIndex.find(function (entry) {
      return entry.fiscalYear === fiscalYear &&
        ARCHIVE_TRANSACTION_SHEETS.indexOf(entry.sheetName) !== -1 &&
        entry.archiveSpreadsheetId;
    });
    if (!archiveEntry) {
      missingArchiveYears.push(fiscalYear);
      return;
    }

    var archiveSS = openedArchiveMap[archiveEntry.archiveSpreadsheetId];
    if (!archiveSS) {
      archiveSS = SpreadsheetApp.openById(archiveEntry.archiveSpreadsheetId);
      openedArchiveMap[archiveEntry.archiveSpreadsheetId] = archiveSS;
    }
    sources.push({
      sourceType: "archive",
      fiscalYear: fiscalYear,
      spreadsheet: archiveSS,
      spreadsheetId: archiveEntry.archiveSpreadsheetId,
    });
  });

  return {
    activeFiscalYear: activeFiscalYear,
    fiscalYears: fiscalYears,
    sources: sources,
    missingArchiveYears: missingArchiveYears,
    archiveUsed: sources.some(function (source) {
      return source.sourceType === "archive";
    }),
  };
}

function tagSource(row, source) {
  var copy = {};
  Object.keys(row).forEach(function (key) {
    copy[key] = row[key];
  });
  copy.SourceFiscalYear = getThaiFiscalYearFromDate(row.Timestamp) || source.fiscalYear;
  copy.SourceType = source.sourceType;
  copy.SourceSpreadsheetId = source.spreadsheetId || "";
  return copy;
}

function rowMatchesDateAndSource(row, startDateStr, endDateStr, source) {
  var rowDateStr = row.Timestamp ? formatYYYYMMDD(row.Timestamp) : "";
  if (startDateStr && rowDateStr < startDateStr) return false;
  if (endDateStr && rowDateStr > endDateStr) return false;

  if (source.sourceType === "archive") {
    var rowFiscalYear = getThaiFiscalYearFromDate(row.Timestamp);
    if (rowFiscalYear !== source.fiscalYear) return false;
  } else if (source.sourceType === "active") {
    var activeRowFiscalYear = getThaiFiscalYearFromDate(row.Timestamp);
    if (activeRowFiscalYear && activeRowFiscalYear < source.fiscalYear) return false;
  }
  return true;
}

function getHealth() {
  var metadata = getMetaData();
  return {
    backendVersion: BACKEND_VERSION,
    timestamp: new Date().toISOString(),
    departments: metadata.departments ? metadata.departments.length : 0,
    services: metadata.services ? metadata.services.length : 0,
    appName: metadata.config && metadata.config.appName ? metadata.config.appName : "DCG Smart Service",
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
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isDisposableEmail(email) {
  var domain = normalizeEmail(email).split("@")[1] || "";
  var blockedDomains = {
    "10minutemail.com": true,
    "guerrillamail.com": true,
    "mailinator.com": true,
    "tempmail.com": true,
    "temp-mail.org": true,
    "yopmail.com": true,
  };
  return blockedDomains[domain] === true;
}

function generateSixDigitOTP(seed) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + "|" + new Date().getTime() + "|" + seed,
  );
  var value = 0;
  for (var i = 0; i < 4; i++) {
    value = value * 256 + (bytes[i] & 0xff);
  }
  return String(100000 + (Math.abs(value) % 900000));
}

function getFridayEndOfWeek(now) {
  var expires = new Date(now);
  var day = expires.getDay();
  var daysUntilFriday = (5 - day + 7) % 7;
  expires.setDate(expires.getDate() + daysUntilFriday);
  expires.setHours(23, 59, 59, 999);
  return expires;
}

function getEndOfDay(now) {
  var expires = new Date(now);
  expires.setHours(23, 59, 59, 999);
  return expires;
}

function getSelfServiceOtpSheet(ss) {
  var sheet = ss.getSheetByName("Tx_SelfServiceOTPStore");
  if (!sheet) {
    sheet = ss.insertSheet("Tx_SelfServiceOTPStore");
    sheet.appendRow([
      "Email",
      "OTPCode",
      "OTPExpiresAt",
      "SessionToken",
      "SessionExpiresAt",
      "FailedAttempts",
      "LastRequestedAt",
    ]);
  }
  return sheet;
}

var SELF_SERVICE_LOG_SHEET_NAME = "Tx_SelfServiceLog";
var SELF_SERVICE_LOG_HEADERS = [
  "Timestamp",
  "Email",
  "Action",
  "QueryText",
  "QueryMode",
  "SelectedDeptName",
  "BudgetOwnerEffective",
  "MatchedDeptCount",
  "DateMode",
  "StartDate",
  "EndDate",
  "FiscalYear",
  "ResultCountRun",
  "ResultCountSort",
  "ResultCountExt",
  "ExportFormat",
  "TrackingMode",
  "Status",
  "UserAgent",
  "ErrorCode",
  "ErrorMessage",
];

function limitSelfServiceLogText(value, maxLength) {
  return String(value || "").trim().substring(0, maxLength);
}

function getSelfServiceLogSheet(ss) {
  return ss.getSheetByName(SELF_SERVICE_LOG_SHEET_NAME);
}

function appendSelfServiceLog(payload) {
  try {
    var ss = getSpreadsheet();
    var sheet = getSelfServiceLogSheet(ss);
    if (!sheet) {
      return { logged: false, logStatus: "failed", reason: "missing_sheet" };
    }

    var row = [
      new Date(),
      normalizeEmail(payload.email),
      limitSelfServiceLogText(payload.action, 60),
      limitSelfServiceLogText(payload.queryText, 120),
      limitSelfServiceLogText(payload.queryMode, 40),
      limitSelfServiceLogText(payload.selectedDeptName, 160),
      limitSelfServiceLogText(payload.budgetOwnerEffective, 160),
      Number(payload.matchedDeptCount || 0),
      limitSelfServiceLogText(payload.dateMode, 40),
      limitSelfServiceLogText(payload.startDate, 20),
      limitSelfServiceLogText(payload.endDate, 20),
      limitSelfServiceLogText(payload.fiscalYear, 10),
      Number(payload.resultCountRun || 0),
      Number(payload.resultCountSort || 0),
      Number(payload.resultCountExt || 0),
      limitSelfServiceLogText(payload.exportFormat, 40),
      limitSelfServiceLogText(payload.trackingMode, 40),
      limitSelfServiceLogText(payload.status, 20),
      limitSelfServiceLogText(payload.userAgent, 80),
      limitSelfServiceLogText(payload.errorCode, 60),
      limitSelfServiceLogText(payload.errorMessage, 200),
    ].map(sanitizeInput);

    sheet.appendRow(row);
    return { logged: true, logStatus: "success" };
  } catch (err) {
    console.warn("Self-service log append failed: " + (err.message || err.toString()));
    return { logged: false, logStatus: "failed", reason: err.message || err.toString() };
  }
}

function logSelfServiceEvent(payload) {
  if (!payload || !payload.action) {
    return { logged: false, logStatus: "failed", reason: "missing_action" };
  }

  if (
    payload.action !== "self_service_otp_verified" &&
    payload.action !== "self_service_search" &&
    payload.action !== "self_service_error" &&
    payload.action !== "self_service_export"
  ) {
    return { logged: false, logStatus: "failed", reason: "unsupported_action" };
  }

  return appendSelfServiceLog(payload);
}

function logStaffReportEvent(payload, staffUser) {
  if (!payload || !payload.action) {
    return { logged: false, logStatus: "failed", reason: "missing_action" };
  }

  if (
    payload.action !== "staff_report_search" &&
    payload.action !== "staff_report_export"
  ) {
    return { logged: false, logStatus: "failed", reason: "unsupported_action" };
  }

  payload.email = staffUser && staffUser.email ? staffUser.email : "";
  payload.queryMode = payload.queryMode || "staff_report";
  payload.trackingMode = payload.trackingMode || "archive_report";
  return appendSelfServiceLog(payload);
}

function writeSelfServiceSessionRecord(
  sheet,
  email,
  otpCode,
  otpExpires,
  sessionToken,
  sessionExpires,
  failedAttempts,
  lastRequestedAt,
) {
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var emailIdx = headers.indexOf("Email");
  var otpCodeIdx = headers.indexOf("OTPCode");
  var otpExpiresIdx = headers.indexOf("OTPExpiresAt");
  var tokenIdx = headers.indexOf("SessionToken");
  var tokenExpiresIdx = headers.indexOf("SessionExpiresAt");
  var failedAttemptsIdx = headers.indexOf("FailedAttempts");
  var lastRequestedIdx = headers.indexOf("LastRequestedAt");

  var foundRow = -1;
  var searchEmail = normalizeEmail(email);
  for (var i = 1; i < values.length; i++) {
    if (normalizeEmail(values[i][emailIdx]) === searchEmail) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow === -1) {
    var newRow = new Array(headers.length);
    newRow[emailIdx] = email;
    newRow[otpCodeIdx] = otpCode;
    newRow[otpExpiresIdx] = otpExpires;
    newRow[tokenIdx] = sessionToken;
    newRow[tokenExpiresIdx] = sessionExpires;
    newRow[failedAttemptsIdx] = failedAttempts || 0;
    newRow[lastRequestedIdx] = lastRequestedAt;
    sheet.appendRow(newRow);
    return;
  }

  if (otpCode !== null) sheet.getRange(foundRow, otpCodeIdx + 1).setValue(otpCode);
  if (otpExpires !== null) sheet.getRange(foundRow, otpExpiresIdx + 1).setValue(otpExpires);
  if (sessionToken !== null) sheet.getRange(foundRow, tokenIdx + 1).setValue(sessionToken);
  if (sessionExpires !== null) sheet.getRange(foundRow, tokenExpiresIdx + 1).setValue(sessionExpires);
  if (failedAttempts !== undefined && failedAttempts !== null) {
    sheet.getRange(foundRow, failedAttemptsIdx + 1).setValue(failedAttempts);
  }
  if (lastRequestedAt !== undefined && lastRequestedAt !== null) {
    sheet.getRange(foundRow, lastRequestedIdx + 1).setValue(lastRequestedAt);
  }
}

function verifySelfServiceSessionToken(sessionToken) {
  if (!sessionToken) {
    throw new Error("กรุณายืนยันตัวตนด้วย OTP ก่อนค้นหาข้อมูล");
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("Tx_SelfServiceOTPStore");
  if (!sheet) {
    throw new Error("ไม่พบ session สำหรับ self-service");
  }

  var records = getSheetDataAsObjects(sheet);
  var record = records.find(function (r) {
    return r.SessionToken === sessionToken;
  });
  if (!record) {
    throw new Error("session สำหรับ self-service ไม่ถูกต้อง");
  }

  var now = new Date();
  var expiresAt = new Date(record.SessionExpiresAt);
  if (now > expiresAt) {
    throw new Error("session สำหรับ self-service หมดอายุแล้ว กรุณายืนยัน OTP ใหม่");
  }

  return { email: record.Email };
}

function requestSelfServiceOTP(payload) {
  var email = normalizeEmail(payload && payload.email);
  if (!email) {
    throw new Error("กรุณากรอกอีเมลสำหรับรับรหัส OTP");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("กรุณากรอกรูปแบบอีเมลให้ถูกต้อง");
  }
  if (isDisposableEmail(email)) {
    throw new Error("ไม่อนุญาตให้ใช้อีเมลชั่วคราวสำหรับ self-service");
  }

  var ss = getSpreadsheet();
  var sheet = getSelfServiceOtpSheet(ss);
  var now = new Date();
  var records = getSheetDataAsObjects(sheet);
  var record = records.find(function (r) {
    return normalizeEmail(r.Email) === email;
  });

  if (record && record.LastRequestedAt) {
    var lastRequestedAt = new Date(record.LastRequestedAt);
    var diffMs = now.getTime() - lastRequestedAt.getTime();
    if (diffMs > 0 && diffMs < 60 * 1000) {
      var secondsLeft = Math.ceil((60 * 1000 - diffMs) / 1000);
      throw new Error("กรุณารออีก " + secondsLeft + " วินาทีก่อนขอรหัส OTP ใหม่");
    }
  }

  var otpCode = generateSixDigitOTP(email);
  var otpExpires = new Date(now.getTime() + 15 * 60 * 1000);
  writeSelfServiceSessionRecord(sheet, email, otpCode, otpExpires, "", new Date(0), 0, now);

  MailApp.sendEmail({
    to: email,
    subject: "DCG Smart Service - รหัส OTP สำหรับตรวจสอบข้อมูลหน่วยงาน",
    htmlBody:
      "<div style='font-family:sans-serif;padding:20px;max-width:520px;border:1px solid #eee;border-radius:12px'>" +
      "<h2 style='color:#6A2C70'>DCG Smart Service</h2>" +
      "<p>รหัส OTP สำหรับตรวจสอบการใช้บริการของหน่วยงานคือ</p>" +
      "<div style='background:#f7f7fa;padding:16px;border-radius:8px;text-align:center;margin:18px 0'>" +
      "<span style='font-size:32px;font-weight:bold;letter-spacing:6px;color:#4F46E5'>" +
      otpCode +
      "</span></div>" +
      "<p style='font-size:12px;color:#666'>รหัสนี้หมดอายุใน 15 นาที และ session หลังยืนยันสำเร็จจะใช้ได้ถึงสิ้นวัน</p>" +
      "</div>",
  });

  return { message: "ส่งรหัส OTP ไปยังอีเมล " + email + " แล้ว" };
}

function verifySelfServiceOTP(payload) {
  var email = normalizeEmail(payload && payload.email);
  var code = payload && payload.code ? String(payload.code).trim() : "";
  if (!email || !code) {
    throw new Error("กรุณากรอกอีเมลและรหัส OTP ให้ครบถ้วน");
  }

  var ss = getSpreadsheet();
  var sheet = getSelfServiceOtpSheet(ss);
  var records = getSheetDataAsObjects(sheet);
  var record = records.find(function (r) {
    return normalizeEmail(r.Email) === email;
  });
  if (!record) {
    throw new Error("ไม่พบรายการขอรหัส OTP สำหรับอีเมลนี้");
  }

  if (String(record.OTPCode).trim() !== code) {
    var failedAttempts = Number(record.FailedAttempts || 0) + 1;
    if (failedAttempts >= 5) {
      writeSelfServiceSessionRecord(sheet, email, "", new Date(0), null, null, 0, null);
      throw new Error("รหัส OTP ถูกระงับเนื่องจากกรอกผิดเกิน 5 ครั้ง กรุณาขอรหัสใหม่");
    }
    writeSelfServiceSessionRecord(sheet, email, null, null, null, null, failedAttempts, null);
    throw new Error("รหัส OTP ไม่ถูกต้อง");
  }

  var now = new Date();
  var otpExpires = new Date(record.OTPExpiresAt);
  if (now > otpExpires) {
    throw new Error("รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่");
  }

  var sessionToken =
    "SS-" +
    Utilities.getUuid().replace(/-/g, "").substring(0, 24).toUpperCase();
  var sessionExpires = getEndOfDay(now);
  writeSelfServiceSessionRecord(sheet, email, "", new Date(0), sessionToken, sessionExpires, 0, null);
  var logResult = appendSelfServiceLog({
    email: email,
    action: "self_service_otp_verified",
    status: "success",
  });

  return {
    email: email,
    sessionToken: sessionToken,
    sessionExpiresAt: sessionExpires,
    logStatus: logResult.logStatus,
  };
}

function selfServiceSearch(payload, auth) {
  var token = auth && auth.selfServiceSessionToken;
  var sessionUser = verifySelfServiceSessionToken(token);
  var result = publicSearchCrossYear(payload);
  var meta = result.meta || {};
  var logResult = appendSelfServiceLog({
    email: sessionUser.email,
    action: "self_service_search",
    queryText: payload && payload.deptName,
    queryMode: meta.queryMode,
    selectedDeptName: meta.deptName,
    budgetOwnerEffective: meta.budgetOwner,
    matchedDeptCount: meta.matchedDepartments ? meta.matchedDepartments.length : 0,
    dateMode: payload && payload.dateMode,
    startDate: payload && payload.startDate,
    endDate: payload && payload.endDate,
    fiscalYear: payload && payload.fiscalYear,
    resultCountRun: result.run ? result.run.length : 0,
    resultCountSort: result.sort ? result.sort.length : 0,
    resultCountExt: result.ext ? result.ext.length : 0,
    trackingMode: meta.archiveUsed ? "masked_archive" : "masked",
    status: "success",
    userAgent: payload && payload.userAgent,
  });
  if (!result.meta) result.meta = {};
  result.meta.logStatus = logResult.logStatus;
  return result;
}

function maskPublicTrackingNo(trackingNo) {
  var value = String(trackingNo || "").trim();
  if (!value || value === "-") return "-";
  if (value.length <= 8) return value.substring(0, 2) + "***";
  return value.substring(0, 5) + "***" + value.substring(value.length - 4);
}

function normalizePublicFundSource(fundSource) {
  var value = String(fundSource || "").trim();
  if (value === "งบประมาณส่วนกลาง" || value === "งบประมาณมหาวิทยาลัย") {
    return "งบประมาณมหาวิทยาลัย";
  }
  if (value === "งบโครงการ" || value === "งบประมาณโครงการ") {
    return "งบประมาณโครงการ";
  }
  if (value === "งบวิสาหกิจ" || value === "งบประมาณวิสาหกิจ") {
    return "งบประมาณวิสาหกิจ";
  }
  return "งบประมาณมหาวิทยาลัย";
}

function publicSearch(payload) {
  var deptName = payload.deptName;
  if (!deptName) {
    return { run: [], sort: [], ext: [] };
  }
  var deptNames = [deptName];
  if (payload.matchedDepartments && payload.matchedDepartments.length) {
    deptNames = payload.matchedDepartments
      .map(function (name) {
        return String(name || "").trim();
      })
      .filter(function (name) {
        return name !== "";
      });
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
        if (deptNames.indexOf(row[deptIdx]) !== -1) {
          runResults.push({
            date: formatTimestamp(row[timeIdx]),
            dept: row[deptIdx],
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
        if (deptNames.indexOf(row[deptIdx]) !== -1) {
          sortResults.push({
            date: formatTimestamp(row[timeIdx]),
            dept: row[deptIdx],
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
        if (deptNames.indexOf(row[deptIdx]) !== -1) {
          extResults.push({
            date: formatTimestamp(row[timeIdx]),
            dept: row[deptIdx],
            service: row[serviceIdx] || "ทั่วไป",
            cost: row[costIdx] || 0,
            count: row[countIdx] || 0,
            tracking: maskPublicTrackingNo(row[trackIdx]),
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
    meta: {
      queryMode: payload.queryMode || "department",
      deptName: deptName,
      budgetOwner: payload.budgetOwner || deptName,
      matchedDepartments: deptNames,
    },
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
function publicSearchCrossYear(payload) {
  var deptName = payload.deptName;
  if (!deptName) {
    return { run: [], sort: [], ext: [], meta: { archiveUsed: false } };
  }
  var deptNames = [deptName];
  if (payload.matchedDepartments && payload.matchedDepartments.length) {
    deptNames = payload.matchedDepartments
      .map(function (name) {
        return String(name || "").trim();
      })
      .filter(function (name) {
        return name !== "";
      });
  }

  var startDateStr = payload.startDate ? formatYYYYMMDD(payload.startDate) : "";
  var endDateStr = payload.endDate ? formatYYYYMMDD(payload.endDate) : "";
  var readPlan = getReadSourcesForDateRange(startDateStr, endDateStr);
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
    if (str.indexOf(" ") > -1) return str.split(" ")[0];
    return str;
  }

  function sourceFields(timestamp, source) {
    return {
      sourceFiscalYear: getThaiFiscalYearFromDate(timestamp) || source.fiscalYear,
      sourceType: source.sourceType,
      sourceSpreadsheetId: source.spreadsheetId || "",
    };
  }

  readPlan.sources.forEach(function (source) {
    var ss = source.spreadsheet;
    var runSheet = ss.getSheetByName("Tx_InternalRun");
    if (runSheet) {
      var runData = runSheet.getDataRange().getValues();
      if (runData.length > 1) {
        var runHeaders = runData[0];
        var runDeptIdx = runHeaders.indexOf("DeptName");
        var runTimeIdx = runHeaders.indexOf("Timestamp");
        var routeIdx = runHeaders.indexOf("Route");
        var roundIdx = runHeaders.indexOf("Round");
        var runCountIdx = runHeaders.indexOf("ItemCount");
        var runNoteIdx = runHeaders.indexOf("Note");

        for (var i = 1; i < runData.length; i++) {
          var runRow = runData[i];
          var runRowObject = { Timestamp: runRow[runTimeIdx] };
          if (deptNames.indexOf(runRow[runDeptIdx]) === -1) continue;
          if (!rowMatchesDateAndSource(runRowObject, startDateStr, endDateStr, source)) continue;
          runResults.push(Object.assign({
            date: formatTimestamp(runRow[runTimeIdx]),
            dept: runRow[runDeptIdx],
            route: runRow[routeIdx] || "เธชเธฒเธขเธชเนเธเธ—เธฑเนเธงเนเธ",
            round: runRow[roundIdx] || "เธฃเธญเธเธ—เธฑเนเธงเนเธ",
            count: runRow[runCountIdx] || 0,
            note: runRow[runNoteIdx] || "",
          }, sourceFields(runRow[runTimeIdx], source)));
        }
      }
    }

    var sortSheet = ss.getSheetByName("Tx_InternalSort");
    if (sortSheet) {
      var sortData = sortSheet.getDataRange().getValues();
      if (sortData.length > 1) {
        var sortHeaders = sortData[0];
        var sortDeptIdx = sortHeaders.indexOf("DeptName");
        var sortTimeIdx = sortHeaders.indexOf("Timestamp");
        var normalIdx = sortHeaders.indexOf("NormalCount");
        var regIdx = sortHeaders.indexOf("RegisterCount");
        var privateIdx = sortHeaders.indexOf("PrivateCount");
        var totalIdx = sortHeaders.indexOf("Total");
        var sortNoteIdx = sortHeaders.indexOf("Note");

        for (var j = 1; j < sortData.length; j++) {
          var sortRow = sortData[j];
          var sortRowObject = { Timestamp: sortRow[sortTimeIdx] };
          if (deptNames.indexOf(sortRow[sortDeptIdx]) === -1) continue;
          if (!rowMatchesDateAndSource(sortRowObject, startDateStr, endDateStr, source)) continue;
          sortResults.push(Object.assign({
            date: formatTimestamp(sortRow[sortTimeIdx]),
            dept: sortRow[sortDeptIdx],
            normal: sortRow[normalIdx] || 0,
            register: sortRow[regIdx] || 0,
            private: privateIdx > -1 ? sortRow[privateIdx] || 0 : 0,
            total: sortRow[totalIdx] || 0,
            note: sortRow[sortNoteIdx] || "",
          }, sourceFields(sortRow[sortTimeIdx], source)));
        }
      }
    }

    var extSheet = ss.getSheetByName("Tx_ExternalPost");
    if (extSheet) {
      var extData = extSheet.getDataRange().getValues();
      if (extData.length > 1) {
        var extHeaders = extData[0];
        var extDeptIdx = extHeaders.indexOf("RequestingDept");
        var extTimeIdx = extHeaders.indexOf("Timestamp");
        var serviceIdx = extHeaders.indexOf("ServiceType");
        var costIdx = extHeaders.indexOf("Cost");
        var extCountIdx = extHeaders.indexOf("ItemCount");
        var trackIdx = extHeaders.indexOf("TrackingNo");
        var fundIdx = extHeaders.indexOf("FundSource");

        for (var k = 1; k < extData.length; k++) {
          var extRow = extData[k];
          var extRowObject = { Timestamp: extRow[extTimeIdx] };
          if (deptNames.indexOf(extRow[extDeptIdx]) === -1) continue;
          if (!rowMatchesDateAndSource(extRowObject, startDateStr, endDateStr, source)) continue;
          extResults.push(Object.assign({
            date: formatTimestamp(extRow[extTimeIdx]),
            dept: extRow[extDeptIdx],
            service: extRow[serviceIdx] || "เธ—เธฑเนเธงเนเธ",
            cost: extRow[costIdx] || 0,
            count: extRow[extCountIdx] || 0,
            tracking: maskPublicTrackingNo(extRow[trackIdx]),
            fund: extRow[fundIdx] || "เธเธเธเธฃเธฐเธกเธฒเธ“เธซเธเนเธงเธขเธเธฒเธ",
          }, sourceFields(extRow[extTimeIdx], source)));
        }
      }
    }
  });

  return {
    run: runResults,
    sort: sortResults,
    ext: extResults,
    meta: {
      queryMode: payload.queryMode || "department",
      deptName: deptName,
      budgetOwner: payload.budgetOwner || deptName,
      matchedDepartments: deptNames,
      activeFiscalYear: readPlan.activeFiscalYear,
      fiscalYears: readPlan.fiscalYears,
      archiveUsed: readPlan.archiveUsed,
      missingArchiveYears: readPlan.missingArchiveYears,
    },
  };
}

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
  // Staff session lasts through Friday to reduce repeated OTP requests during workweek.
  var sessionExpires = getFridayEndOfWeek(today);

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
