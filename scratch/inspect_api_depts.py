import json

with open(r"D:\[DEV] __WUS_Track_DB\scratch\live_metadata.json", "r", encoding="utf-8") as f:
    data = json.load(f)

depts = data.get("data", {}).get("departments", [])
print(f"Total departments in API: {len(depts)}")

# Sort by ID
depts_sorted = sorted(depts, key=lambda x: x.get("DeptID"))
for d in depts_sorted:
    print(f"{d.get('DeptID')}: {d.get('DeptName')}")
