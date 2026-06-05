import json

with open(r"D:\[DEV] __WUS_Track_DB\scratch\primary_sheet_dump.json", "r", encoding="utf-8") as f:
    sheet_data = json.load(f)

with open(r"D:\[DEV] __WUS_Track_DB\scratch\live_metadata.json", "r", encoding="utf-8") as f:
    api_data = json.load(f)

sheet_depts = {row[0]: row[1] for row in sheet_data.get("Master_Departments", [])[1:] if row}
api_depts = {d.get("DeptID"): d.get("DeptName") for d in api_data.get("data", {}).get("departments", [])}

print(f"Sheet dept IDs: {len(sheet_depts)}")
print(f"API dept IDs: {len(api_depts)}")

print("\n--- Missing in API ---")
for dept_id, name in sheet_depts.items():
    if dept_id not in api_depts:
        print(f"{dept_id}: {name}")

print("\n--- Missing in Sheet ---")
for dept_id, name in api_depts.items():
    if dept_id not in sheet_depts:
        print(f"{dept_id}: {name}")
