import zipfile
import re

docx_path = r"D:\[DEV] __WUS_Track_DB\คู่มือการใช้งานระบบบริหารงานไปรษณีย์\คู่มือการใช้งานระบบบริหารงานไปรษณีย์.docx"

try:
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read("word/document.xml").decode("utf-8")
        
        # Remove XML tags to get plain text
        plain_text = re.sub(r'<[^>]+>', '', xml_content)
        
        # Let's search for some patterns
        keywords = ["D041", "D042", "D083", "D085", "สาธิต", "ไปรษณีย์ภัณฑ์ส่วนตัว"]
        print("=== Keyword Search in Docx ===")
        for kw in keywords:
            matches = [m.start() for m in re.finditer(kw, plain_text)]
            print(f"Keyword '{kw}': Found {len(matches)} times")
            for idx, pos in enumerate(matches[:5]):
                start = max(0, pos - 100)
                end = min(len(plain_text), pos + 100)
                context = plain_text[start:end].replace("\n", " ")
                print(f"  Match {idx+1}: ...{context}...")
                
except Exception as e:
    print("Error:", e)
