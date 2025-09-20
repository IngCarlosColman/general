import sys
import os

def eliminar_lineas_en_blanco(nombre_archivo):
    if not os.path.isfile(nombre_archivo):
        print(f"❌ El archivo '{nombre_archivo}' no existe.")
        return

    nombre_base, extension = os.path.splitext(nombre_archivo)
    nombre_salida = f"{nombre_base}_xxx.txt"

    with open(nombre_archivo, 'r', encoding='utf-8') as entrada:
        lineas = entrada.readlines()

    lineas_filtradas = [linea for linea in lineas if linea.strip() != '']

    with open(nombre_salida, 'w', encoding='utf-8') as salida:
        salida.writelines(lineas_filtradas)

    print(f"✅ Archivo limpio generado: {nombre_salida}")

# Uso desde línea de comandos
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python limpiar_blancos.py <archivo.txt>")
    else:
        eliminar_lineas_en_blanco(sys.argv[1])