import json

with open(r"D:\[DEV] __WUS_Track_DB\scratch\primary_sheet_dump.json", "r", encoding="utf-8") as f:
    data = json.load(f)

depts = data.get("Master_Departments", [])
print(f"Total departments in sheet: {len(depts) - 1}")

print("\n--- Departments with ID starting with D04, D08 or name containing 'สาธิต' ---")
for idx, r in enumerate(depts):
    if idx == 0:
        continue
    dept_id = r[0]
    dept_name = r[1]
    if dept_id.startswith("D04") or dept_id.startswith("D08") or "สาธิต" in dept_name or "สาธิต" in dept_id:
        print(f"Row {idx+1}: {r}")
