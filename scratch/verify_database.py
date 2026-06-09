import json
import sys

def verify_db():
    dump_path = "scratch/primary_sheet_dump.json"
    print(f"Reading dumped data from {dump_path}...")
    try:
        with open(dump_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading dump file: {e}")
        sys.exit(1)

    expected_schemas = {
        "Master_Users": ["UserID", "Email", "FullName", "Role", "Status"],
        "Master_Departments": ["DeptID", "DeptName", "RouteGroup", "Building"],
        "Master_Services": ["ServiceID", "ServiceName", "Description"],
        "Tx_InternalRun": ["TxID", "Timestamp", "DeptName", "Route", "Round", "ItemCount", "Note", "StaffEmail"],
        "Tx_InternalSort": ["TxID", "Timestamp", "DeptName", "NormalCount", "RegisterCount", "PrivateCount", "Total", "Note", "StaffEmail"],
        "Tx_ExternalPost": ["TxID", "Timestamp", "RequestingDept", "ServiceType", "Cost", "ItemCount", "TrackingNo", "FundSource", "StaffEmail"],
        "Tx_OTPStore": ["Email", "OTPCode", "OTPExpiresAt", "SessionToken", "SessionExpiresAt", "FailedAttempts"]
    }

    issues_found = 0

    for sheet_name, expected_cols in expected_schemas.items():
        print(f"\n--- Checking worksheet: {sheet_name} ---")
        if sheet_name not in data:
            print(f"[ERROR] Worksheet {sheet_name} not found in the spreadsheet!")
            issues_found += 1
            continue

        sheet_rows = data[sheet_name]
        if len(sheet_rows) == 0:
            print(f"[ERROR] Worksheet {sheet_name} is completely empty (no headers)!")
            issues_found += 1
            continue

        headers = sheet_rows[0]
        print(f"Actual Headers: {headers}")

        # Check for missing headers
        missing_cols = []
        for col in expected_cols:
            if col not in headers:
                missing_cols.append(col)
        
        if missing_cols:
            print(f"[ERROR] Missing expected columns: {missing_cols}")
            issues_found += 1
        else:
            print("[OK] All expected columns are present.")

        # Check row counts
        row_count = len(sheet_rows) - 1
        print(f"Data rows count: {row_count}")

    print("\n==========================================")
    if issues_found == 0:
        print("SUCCESS: Google Sheets Database structure is fully correct and matches the schema!")
    else:
        print(f"WARNING: Found {issues_found} issues with the Google Sheets database structure.")

if __name__ == "__main__":
    verify_db()
