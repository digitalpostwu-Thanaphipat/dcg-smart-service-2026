import docx
import os

def extract_text(docx_path, output_path):
    doc = docx.Document(docx_path)
    fullText = []
    for para in doc.paragraphs:
        fullText.append(para.text)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(fullText))

if __name__ == "__main__":
    path = r"d:\[DEV] __WUS_Track_DB\คู่มือการใช้งานระบบบริหารงานไปรษณีย์\คู่มือการใช้งานระบบบริหารงานไปรษณีย์.docx"
    output = r"d:\[DEV] __WUS_Track_DB\scratch\manual_text.txt"
    extract_text(path, output)
    print(f"Extracted text to {output}")
