import zipfile
import re

docx_path = r"D:\[DEV] __WUS_Track_DB\คู่มือการใช้งานระบบบริหารงานไปรษณีย์\คู่มือการใช้งานระบบบริหารงานไปรษณีย์.docx"
txt_output = r"D:\[DEV] __WUS_Track_DB\scratch\docx_plain.txt"

try:
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read("word/document.xml").decode("utf-8")
        plain_text = re.sub(r'<[^>]+>', '\n', xml_content)
        
        # Clean up empty lines
        lines = [line.strip() for line in plain_text.split('\n') if line.strip()]
        
        with open(txt_output, "w", encoding="utf-8") as f:
            f.write('\n'.join(lines))
        print("Successfully written to docx_plain.txt")
except Exception as e:
    print("Error:", e)
