import { test, expect } from '@playwright/test';

test.describe('DCG Smart Service Complete Sanity Checks & Transaction Workflows', () => {
  
  test.beforeEach(async ({ page }) => {
    const savedLogs = {
      run: [] as any[],
      sort: [] as any[],
      ext: [] as any[],
    };
    const makeTimestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Intercept Google Apps Script API calls to run offline/mocked
    await page.route('**/macros/s/**/exec', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const postData = JSON.parse(request.postData() || '{}');
        const action = postData.action;

        if (action === 'getMetaData') {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              data: {
                users: [
                  { UserID: 'U001', Email: 'admin@wu.ac.th', FullName: 'Admin User', Role: 'Admin' }
                ],
                departments: [
                  {
                    DeptID: 'D999',
                    DeptName: 'Metadata Search Unit',
                    RouteGroup: 'เธชเธฒเธข A',
                    Building: 'Admin Tower',
                    Floor: '2',
                    BudgetOwner: 'Central Office'
                  },
                  { DeptID: 'D001', DeptName: 'สำนักอำนวยการ', RouteGroup: 'สาย A' }
                ],
                services: [
                  { ServiceID: 'S01', ServiceName: 'EMS' }
                ],
                config: {
                  appName: 'DCG Smart Service',
                  appSubtitle: 'ส่วนอำนวยการสารบรรณ',
                  announcement: 'ยินดีต้อนรับสู่ระบบทดสอบ E2E',
                  show: true,
                  restrictWorkdays: false
                }
              }
            })
          });
        } else if (action === 'publicSearch' || action === 'selfServiceSearch') {
          expect(postData.auth?.selfServiceSessionToken).toBe('SS-MOCKTOKEN123');
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              data: {
                run: [
                  {
                    date: '09/06/2026',
                    route: 'สาย A',
                    round: 'รอบเช้า',
                    count: 5,
                    note: 'ทดสอบ E2E'
                  }
                ],
                sort: [],
                ext: []
              }
            })
          });
        } else if (action === 'requestSelfServiceOTP') {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              data: { message: 'ส่งรหัส OTP สำหรับ self-service แล้ว' }
            })
          });
        } else if (action === 'verifySelfServiceOTP') {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              data: {
                email: 'viewer@example.com',
                sessionToken: 'SS-MOCKTOKEN123',
                sessionExpiresAt: '2026-06-12T16:59:59.999Z'
              }
            })
          });
        } else if (action === 'requestOTP') {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              data: { message: 'รหัส OTP ถูกจัดส่งแล้ว' }
            })
          });
        } else if (action === 'verifyOTP') {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              data: {
                email: 'admin@wu.ac.th',
                fullName: 'Admin User',
                role: 'Admin',
                userID: 'U001',
                sessionToken: 'ST-MOCKTOKEN123'
              }
            })
          });
        } else if (action === 'saveBatch') {
          const { txId, type, items, common } = postData.payload;
          const timestamp = makeTimestamp();
          expect(txId).toMatch(new RegExp(`^${type.toUpperCase()}-\\d{8}-\\d{6}-[A-Z0-9]{8}$`));

          if (type === 'run') {
            for (const item of items) {
              savedLogs.run.push({
                TxID: txId,
                Timestamp: timestamp,
                DeptName: item.deptName,
                Route: common.route,
                Round: common.round,
                ItemCount: item.itemCount,
              });
            }
          } else if (type === 'sort') {
            for (const item of items) {
              savedLogs.sort.push({
                TxID: txId,
                Timestamp: timestamp,
                DeptName: item.deptName,
                NormalCount: item.normalCount,
                RegisterCount: item.registerCount,
                PrivateCount: item.privateCount,
                Total: item.total,
              });
            }
          } else if (type === 'ext') {
            for (const item of items) {
              savedLogs.ext.push({
                TxID: txId,
                Timestamp: timestamp,
                RequestingDept: item.deptName,
                ServiceType: item.serviceType,
                TrackingNo: item.trackingNo,
                ItemCount: item.itemCount,
                Cost: item.cost,
                FundSource: item.fundSource,
              });
            }
          }

          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ status: 'success', data: { txId } })
          });
        } else if (action === 'searchLogs') {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              status: 'success',
              data: savedLogs
            })
          });
        } else {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ status: 'success', data: {} })
          });
        }
      } else {
        await route.fulfill({
          contentType: 'text/plain',
          body: 'DCG Smart Track API is running.'
        });
      }
    });
  });

  test('should load application, verify brand header, and switch to public mode (ตรวจสอบการใช้บริการของหน่วยงาน)', async ({ page }) => {
    // 1. Load login page
    await page.goto('/');
    
    // Check loading indicator hides and main login is shown
    await expect(page.locator('h1')).toContainText('DCG Smart Service');
    await expect(page.locator('text=ส่วนอำนวยการสารบรรณ').first()).toBeVisible();

    // 2. Switch to public track view (Verify renamed button)
    await page.click('text=ตรวจสอบการใช้บริการของหน่วยงาน');
    
    // Check elements in Public Track View
    await expect(page.locator('h3')).toContainText('ตรวจสอบการใช้บริการ');
    
    await expect(page.locator('text=ยืนยันตัวตนก่อนตรวจสอบข้อมูล')).toBeVisible();
    await page.fill('input[placeholder="กรอกอีเมลเพื่อรับ OTP"]', 'viewer@example.com');
    await page.click('button:has-text("ขอรหัส OTP")');
    await page.fill('input[placeholder="กรอกรหัส 6 หลัก"]', '123456');
    await page.click('button:has-text("ยืนยัน OTP")');
    await expect(page.locator('text=ยืนยันตัวตนก่อนตรวจสอบข้อมูล')).toHaveCount(0);

    // 3. Search for a department
    await page.fill('input[placeholder="พิมพ์ชื่อหน่วยงานของท่าน..."]', 'สำนักอำนวยการ');
    await page.click('role=option >> text=สำนักอำนวยการ');
    await page.click('button:has-text("ค้นหา")');

    // Check mock search results are displayed
    await expect(page.locator('text=รอบเช้า').first()).toBeVisible();
    await expect(page.locator('text=สาย A').first()).toBeVisible();
    await expect(page.locator('text=5 ซอง').first()).toBeVisible();

    // 4. Test date preset filter clicks
    // "วันนี้" Preset
    await page.click('button:has-text("วันนี้")');
    await expect(page.locator('button:has-text("วันนี้")')).toHaveClass(/bg-purple-600/);

    // "เดือนนี้" Preset
    await page.click('button:has-text("เดือนนี้")');
    await expect(page.locator('button:has-text("เดือนนี้")')).toHaveClass(/bg-purple-600/);

    // "ปีงบประมาณ" Preset
    await page.click('button:has-text("ปีงบประมาณ")');
    await expect(page.locator('button:has-text("ปีงบประมาณ")')).toHaveClass(/bg-purple-600/);

    // 5. Test theme toggle
    const htmlElement = page.locator('html');
    await page.click('button[title="สลับโหมดแสง/มืด"]');
    
    // Switch should toggle dark class (assuming initial theme was light or dark)
    const isDark = await htmlElement.evaluate((el) => el.classList.contains('dark'));
    await page.click('button[title="สลับโหมดแสง/มืด"]');
    const isDarkAfterToggle = await htmlElement.evaluate((el) => el.classList.contains('dark'));
    expect(isDark).not.toBe(isDarkAfterToggle);

    // 6. Navigate back to login page
    await page.click('button:has-text("กลับหน้าเข้าสู่ระบบ")');
    await expect(page.locator('h1')).toContainText('DCG Smart Service');
  });

  test('should handle staff OTP request and mock login flow', async ({ page }) => {
    await page.goto('/');

    // Type university email
    await page.fill('input[type="email"]', 'admin@wu.ac.th');
    await page.click('button:has-text("ขอรหัสผ่านใช้ครั้งเดียว (OTP)")');

    // Verify OTP field is displayed
    await expect(page.locator('text=รหัสยืนยันตัวตน (OTP)')).toBeVisible();

    // Type 6 digit code and submit
    await page.fill('input[placeholder="กรอกรหัส 6 หลัก"]', '123456');
    await page.click('button:has-text("ยืนยันและเข้าสู่ระบบ")');

    // Verify logged in and MainLayout header elements are displayed
    await expect(page.locator('#tab-run')).toBeVisible();
    await expect(page.locator('#tab-sort')).toBeVisible();
    await expect(page.locator('#tab-ext')).toBeVisible();

    await page.click('#tab-sort');
    await page.fill('#sort-dept-search', 'Admin Tower');
    await expect(page.locator('role=option >> text=Metadata Search Unit')).toBeVisible();
    await page.fill('#sort-dept-search', '2');
    await expect(page.locator('role=option >> text=Metadata Search Unit')).toBeVisible();
  });

  test('should simulate transaction submissions on all 3 operational tabs and verify in ReportPage', async ({ page }) => {
    // 1. Log in first
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@wu.ac.th');
    await page.click('button:has-text("ขอรหัสผ่านใช้ครั้งเดียว (OTP)")');
    await page.fill('input[placeholder="กรอกรหัส 6 หลัก"]', '123456');
    await page.click('button:has-text("ยืนยันและเข้าสู่ระบบ")');
    await expect(page.locator('#tab-run')).toBeVisible();

    // 2. [TAB: RunPage] - Submit a Run transaction
    await page.click('#tab-run');
    await page.selectOption('select#run-route-select', 'สาย A');
    
    // Select department checkbox
    await page.click('role=checkbox >> text=สำนักอำนวยการ');
    
    // Submit run transaction
    await page.click('button:has-text("บันทึกการรับ-ส่ง")');
    await expect(page.locator('text=บันทึก 1 รายการลงคิวเรียบร้อย')).toBeVisible();

    // 3. [TAB: SortPage] - Submit a Sort transaction
    await page.click('#tab-sort');
    await page.fill('#sort-dept-search', 'สำนักอำนวยการ');
    await page.click('role=option >> text=สำนักอำนวยการ');
    await page.fill('#sort-normal-count', '10');
    await page.fill('#sort-reg-count', '2');
    await page.fill('#sort-private-count', '3');
    await page.click('button:has-text("เพิ่มลงรายการ")');
    
    // Verify item is added to temporary cart
    await expect(page.locator('h4:has-text("สำนักอำนวยการ")')).toBeVisible();
    await expect(page.locator('text=ธรรมดา: 10 | ลงทะเบียน: 2 | ส่วนตัว: 3')).toBeVisible();
    
    // Confirm and save batch
    await page.click('button:has-text("ยืนยันบันทึกทั้งหมด")');
    await expect(page.locator('text=บันทึกรายการคัดแยกลงคิวเรียบร้อย')).toBeVisible();

    // 4. [TAB: ExternalPage] - Submit an External post transaction
    await page.click('#tab-ext');
    await page.fill('#ext-dept-search', 'สำนักอำนวยการ');
    await page.click('role=option >> text=สำนักอำนวยการ');
    await page.selectOption('select#ext-service', 'EMS');
    await page.fill('#ext-item-cost', '45');
    await page.fill('#ext-item-count', '1');
    await page.fill('#ext-tracking', 'RL123456789TH');
    await page.click('button:has-text("เพิ่มรายการส่งออก")');

    // Verify item is added to temporary cart
    await expect(page.locator('text=RL123456789TH')).toBeVisible();
    
    // Confirm and save external post
    await page.click('button:has-text("ยืนยันนำส่งไปรษณีย์")');
    await expect(page.locator('text=บันทึกรายการนำส่งไปรษณีย์เรียบร้อย')).toBeVisible();

    // 5. [TAB: ReportPage] - Check summaries and list rendering
    await page.click('#tab-report');
    
    // Toggle between report subtabs to ensure no rendering errors
    await page.click('button:has-text("รับ-ส่งภายใน")');
    await page.click('button:has-text("คัดแยก-นำจ่าย")');
    await page.click('button:has-text("นำส่งภายนอก")');
    await page.click('button:has-text("รายการข้อมูล")');

    // 6. [TAB: BudgetReport] - Check budget analysis dashboard
    await page.click('button:has-text("สรุปงบประมาณ")');
    await expect(page.locator('text=ผลประโยชน์ทางการขนส่งสุทธิ')).toBeVisible();
    await expect(page.locator('text=มูลค่าประหยัดสะสม')).toBeVisible();
    await expect(page.locator('text=สัดส่วนค่าบริการภายนอกแยกตามแหล่งงบประมาณ')).toBeVisible();

    // Search in budget table
    await page.fill('input[placeholder="ค้นหาชื่อหน่วยงาน..."]', 'สำนักอำนวยการ');
    await expect(page.locator('td:has-text("สำนักอำนวยการ")').first()).toBeVisible();

    // 7. Verify Excel Export trigger
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("ส่งออก Excel")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xlsx');
  });
});
