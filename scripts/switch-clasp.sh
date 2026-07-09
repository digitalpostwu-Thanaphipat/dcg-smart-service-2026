#!/bin/bash
# switch-clasp.sh - สลับ .clasp.json ระหว่าง staging/production
# ใช้: ./scripts/switch-clasp.sh [staging|production]

set -e

MODE=${1:-""}

if [ "$MODE" != "staging" ] && [ "$MODE" != "production" ]; then
  echo "วิธีใช้: $0 [staging|production]"
  echo ""
  echo "ตัวอย่าง:"
  echo "  $0 staging      # สลับไป staging"
  echo "  $0 production   # สลับกลับ production"
  exit 1
fi

# สำรอง .clasp.json ปัจจุบัน
if [ -f .clasp.json ]; then
  cp .clasp.json .clasp.backup.json
fi

if [ "$MODE" = "staging" ]; then
  if [ ! -f .clasp.staging.json ]; then
    echo "ไม่พบไฟล์ .clasp.staging.json"
    echo "กรุณาสร้างไฟล์นี้พร้อม staging script ID ของคุณ"
    exit 1
  fi
  
  # ตรวจสอบว่าได้ตั้งค่า staging script ID แล้ว
  if grep -q "PUT_STAGING_SCRIPT_ID_HERE" .clasp.staging.json; then
    echo "กรุณาแก้ไข .clasp.staging.json ด้วย staging script ID ของคุณก่อน"
    exit 1
  fi
  
  cp .clasp.staging.json .clasp.json
  echo "✅ สลับไป STAGING สำเร็จ"
  echo "   Script ID: $(grep scriptId .clasp.json | cut -d'"' -f4)"
  
else
  if [ -f .clasp.production.json ]; then
    cp .clasp.production.json .clasp.json
  elif [ -f .clasp.backup.json ]; then
    cp .clasp.backup.json .clasp.json
  else
    echo "ไม่พบไฟล์ config สำหรับ production"
    exit 1
  fi
  echo "✅ สลับกลับ PRODUCTION สำเร็จ"
  echo "   Script ID: $(grep scriptId .clasp.json | cut -d'"' -f4)"
fi

# ลบไฟล์สำรอง
rm -f .clasp.backup.json

echo ""
echo "⚠️  อย่าลืมรัน clasp push หลังจากสลับ config แล้ว"
