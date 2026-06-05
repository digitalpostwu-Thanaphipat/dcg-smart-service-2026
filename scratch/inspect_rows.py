import json

with open(r"D:\[DEV] __WUS_Track_DB\scratch\primary_sheet_dump.json", "r", encoding="utf-8") as f:
    sheet_data = json.load(f)

with open(r"D:\[DEV] __WUS_Track_DB\scratch\live_metadata.json", "r", encoding="utf-8") as f:
    api_data = json.load(f)

sheet_rows = sheet_data.get("Master_Departments", [])
api_depts = api_data.get("data", {}).get("departments", [])

api_id_map = {d.get("DeptID"): d for d in api_depts}

print(f"Spreadsheet Rows: {len(sheet_rows)}")
print(f"API Departments: {len(api_depts)}")

print("\n--- Row-by-Row Matching ---")
for idx, r in enumerate(sheet_rows):
    if idx == 0:
        print(f"Row {idx+1} (Header): {r}")
        continue
    dept_id = r[0]
    dept_name = r[1]
    in_api = dept_id in api_id_map
    print(f"Row {idx+1}: ID={dept_id}, Name={dept_name[:20]}, InAPI={in_api}")
