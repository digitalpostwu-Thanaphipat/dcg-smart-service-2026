import json

with open(r"D:\[DEV] __WUS_Track_DB\scratch\primary_sheet_dump.json", "r", encoding="utf-8") as f:
    data = json.load(f)

depts = data.get("Master_Departments", [])
print("Total rows:", len(depts))

# Print sorted IDs
ids = []
for idx, r in enumerate(depts[1:]):
    ids.append((r[0], r[1], idx + 2))

ids.sort()
print("\nSorted DeptIDs:")
for dept_id, name, row_num in ids:
    print(f"Row {row_num}: {dept_id} -> {name}")
