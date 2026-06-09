import json

with open("scratch/primary_sheet_dump.json", "r", encoding="utf-8") as f:
    data = json.load(f)

run_rows = data.get("Tx_InternalRun", [])
print(f"Total rows in Tx_InternalRun: {len(run_rows)}")
print("\nLast 15 rows:")
for i in range(max(0, len(run_rows) - 15), len(run_rows)):
    print(f"Row {i+1}: {run_rows[i]}")
