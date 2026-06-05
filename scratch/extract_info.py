import json

with open(r"D:\[DEV] __WUS_Track_DB\scratch\primary_sheet_dump.json", "r", encoding="utf-8") as f:
    data = json.load(f)

services = data.get("Master_Services", [])
departments = data.get("Master_Departments", [])

filtered_depts = [departments[0]]
for dept in departments[1:]:
    if dept[0] in ["D041", "D042", "D083", "D085"]:
        filtered_depts.append(dept)

output = {
    "Master_Services": services,
    "Master_Departments": filtered_depts
}

with open(r"D:\[DEV] __WUS_Track_DB\scratch\master_info.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
print("Extracted successfully")
