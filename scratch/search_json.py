import json

with open(r"D:\[DEV] __WUS_Track_DB\scratch\live_metadata.json", "r", encoding="utf-8") as f:
    data = json.load(f)

depts = data.get("data", {}).get("departments", [])
print(f"Total departments in live metadata: {len(depts)}")

target_ids = ["D041", "D042", "D083", "D085"]
for d in depts:
    if d.get("DeptID") in target_ids:
        print("Found in live API:", d)
