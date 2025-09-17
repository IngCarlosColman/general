import sys
import os
import unicodedata
import re
from collections import Counter

def sanitize_text(text, report):
    original_length = len(text)

    # Normalización Unicode
    text = unicodedata.normalize('NFKC', text)

    # Detectar y eliminar caracteres invisibles
    invisible_chars = [
        '\u200B', '\u200C', '\u200D', '\uFEFF', '\u2060', '\u202A', '\u202B',
        '\u202C', '\u202D', '\u202E'
    ]
    found_invisible = [c for c in text if c in invisible_chars]
    report['invisible_chars'] = Counter(found_invisible)
    for ch in invisible_chars:
        text = text.replace(ch, '')

    # Detectar y eliminar caracteres no imprimibles
    non_printables = [c for c in text if not c.isprintable() and c not in '\n\t']
    report['non_printables'] = Counter(non_printables)
    text = ''.join(c for c in text if c.isprintable() or c in '\n\t')

    # Detectar saltos de línea inconsistentes
    crlf_count = text.count('\r\n')
    cr_count = text.count('\r')
    if crlf_count or cr_count:
        report['line_endings'] = {'CRLF': crlf_count, 'CR': cr_count}
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Eliminar espacios al final de línea
    trailing_spaces = sum(1 for line in text.split('\n') if line.endswith(' '))
    report['trailing_spaces'] = trailing_spaces
    text = '\n'.join(line.rstrip() for line in text.split('\n'))

    report['original_length'] = original_length
    report['sanitized_length'] = len(text)

    return text

def sanitize_file(file_path):
    if not os.path.isfile(file_path):
        print(f"❌ Archivo no encontrado: {file_path}")
        return

    report = {}

    try:
        with open(file_path, 'rb') as f:
            raw_bytes = f.read()

        text = raw_bytes.decode('utf-8', errors='ignore')
        sanitized = sanitize_text(text, report)

        # Reemplazar el archivo original
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(sanitized)

        # Generar reporte
        report_path = file_path + '.sanitization_report.txt'
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("🧼 Reporte de Sanitización\n")
            f.write(f"Archivo: {file_path}\n")
            f.write(f"Longitud original: {report['original_length']}\n")
            f.write(f"Longitud sanitizada: {report['sanitized_length']}\n\n")

            if report.get('invisible_chars'):
                f.write("Caracteres invisibles eliminados:\n")
                for ch, count in report['invisible_chars'].items():
                    f.write(f"  U+{ord(ch):04X} ({repr(ch)}): {count}\n")

            if report.get('non_printables'):
                f.write("\nCaracteres no imprimibles eliminados:\n")
                for ch, count in report['non_printables'].items():
                    f.write(f"  U+{ord(ch):04X} ({repr(ch)}): {count}\n")

            if report.get('line_endings'):
                f.write("\nSaltos de línea inconsistentes:\n")
                for k, v in report['line_endings'].items():
                    f.write(f"  {k}: {v}\n")

            f.write(f"\nLíneas con espacios al final: {report['trailing_spaces']}\n")

        print(f"✅ Archivo sanitizado y reemplazado: {file_path}")
        print(f"📄 Reporte generado en: {report_path}")

    except Exception as e:
        print(f"⚠️ Error al procesar el archivo: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python sanitize.py <ruta_del_archivo>")
    else:
        sanitize_file(sys.argv[1])