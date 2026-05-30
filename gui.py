#Jose Palencia
import os
import sys
import json
import subprocess
import re
import webbrowser
from http.server import SimpleHTTPRequestHandler
import socketserver

#Forzar salida en utf-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def obtener_datos_escaneo():
    #Si la plataforma es Linux, usamos nmcli
    if sys.platform.startswith('linux'):
        resultado = {}
        try:
            #Ejecutamos nmcli para listar dispositivos de tipo wifi
            proc_dev = subprocess.Popen(["nmcli", "-t", "-f", "DEVICE,TYPE", "dev"], 
                                        stdout=subprocess.PIPE, 
                                        stderr=subprocess.PIPE, 
                                        encoding='utf-8',
                                        errors='replace')
            stdout_dev, _ = proc_dev.communicate()
            
            interfaces = []
            for linea in stdout_dev.strip().split('\n'):
                partes = linea.split(':')
                if len(partes) >= 2 and partes[1].strip() == 'wifi':
                    interfaces.append(partes[0].strip())
                    
            if not interfaces:
                interfaces = ["wlan0"]
                
            for intf in interfaces:
                proc_scan = subprocess.Popen(["nmcli", "-t", "-f", "SSID,BSSID,CHAN,SIGNAL,BAND", "dev", "wifi", "list", "ifname", intf], 
                                             stdout=subprocess.PIPE, 
                                             stderr=subprocess.PIPE, 
                                             encoding='utf-8',
                                             errors='replace')
                stdout_scan, _ = proc_scan.communicate()
                
                redes_detectadas = []
                for linea in stdout_scan.strip().split('\n'):
                    if not linea:
                        continue
                    match = re.search(r'^(.*):([0-9a-fA-F\\:]{17,23}):(\d+):(\d+):(.*)$', linea)
                    if match:
                        ssid = match.group(1).strip()
                        if not ssid:
                            ssid = "[RED OCULTA]"
                        canal_num = int(match.group(3))
                        senal_num = int(match.group(4))
                        
                        es_24 = (1 <= canal_num <= 14)
                        
                        redes_detectadas.append({
                            'ssid': ssid,
                            'canal': canal_num,
                            'senal': senal_num,
                            'banda': '2.4 GHz' if es_24 else '5 GHz'
                        })
                resultado[intf] = redes_detectadas
        except Exception as e:
            return {"error": str(e)}
        return resultado

    #Para Windows (win32) o fallbacks
    try:
        proceso = subprocess.Popen(["netsh", "wlan", "show", "networks", "mode=bssid"], 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE, 
                                   encoding='utf-8',
                                   errors='replace')
        stdout, stderr = proceso.communicate()
    except Exception as e:
        return {"error": str(e)}

    #Dividimos la salida por cada interfaz inalambrica encontrada
    bloques_interfaz = re.split(r'\n(?:Nombre de interfaz|Interface name)\s*:\s*', stdout)
    
    if bloques_interfaz:
        bloques_interfaz.pop(0) #Eliminar la cabecera
        
    resultado = {}

    for bloque_int in bloques_interfaz:
        lineas = bloque_int.split('\n')
        if not lineas:
            continue
        
        nombre_interfaz = lineas[0].strip()
        resto_bloque = "\n".join(lineas[1:])
        
        bloques_ssid = re.split(r'\n(?=SSID \d+\s*:\s*)', resto_bloque)
        if bloques_ssid and not re.match(r'^\s*SSID \d+\s*:\s*', bloques_ssid[0]):
            bloques_ssid.pop(0)
            
        redes_detectadas = []
        
        for bloque_ssid_text in bloques_ssid:
            lineas_ssid = bloque_ssid_text.strip().split('\n')
            if not lineas_ssid:
                continue
                
            primera_linea = lineas_ssid[0]
            match_ssid = re.search(r'SSID \d+\s*:\s*(.*)', primera_linea)
            if not match_ssid:
                continue
                
            ssid_nombre = match_ssid.group(1).strip()
            if not ssid_nombre:
                ssid_nombre = "[RED OCULTA]"
                
            #Dividimos el bloque por cada BSSID
            bloques_bssid = re.split(r'\n\s*BSSID\s+\d+', bloque_ssid_text)
            if bloques_bssid:
                bloques_bssid.pop(0) #Eliminar la cabecera
                
            for bssid_text in bloques_bssid:
                match_canal = re.search(r'^\s*(?:Canal|Channel)\s*:\s*(\d+)', bssid_text, re.MULTILINE | re.IGNORECASE)
                match_senal = re.search(r'^\s*(?:Se.{1,2}al|Signal)\s*:\s*(\d+)%', bssid_text, re.MULTILINE | re.IGNORECASE)
                
                if match_canal and match_senal:
                    canal_num = int(match_canal.group(1))
                    senal_num = int(match_senal.group(1))
                    
                    #Banda 2.4 GHz vs 5 GHz
                    es_24 = (1 <= canal_num <= 14)
                    
                    redes_detectadas.append({
                        'ssid': ssid_nombre,
                        'canal': canal_num,
                        'senal': senal_num,
                        'banda': '2.4 GHz' if es_24 else '5 GHz'
                    })
                
        resultado[nombre_interfaz] = redes_detectadas
        
    return resultado

class RadarHTTPRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/scan':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.end_headers()
            data = obtener_datos_escaneo()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        else:
            #Servir archivos estaticos normalmente
            super().do_GET()

def iniciar_servidor():
    PORT = 8000
    #Permitir reutilizar el puerto para evitar problemas de reinicio rapido
    socketserver.TCPServer.allow_reuse_address = True
    
    #Cambiar de directorio al directorio de este script para servir los archivos
    dir_script = os.path.dirname(os.path.abspath(__file__))
    os.chdir(dir_script)
    
    with socketserver.TCPServer(("", PORT), RadarHTTPRequestHandler) as httpd:
        print(f"Servidor Web del Radar corriendo en: http://localhost:{PORT}")
        print("Cierra esta ventana o presiona Ctrl+C para apagar el servidor.")
        
        #Abrimos el navegador automaticamente
        webbrowser.open(f"http://localhost:{PORT}")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor apagado correctamente.")
            sys.exit(0)

if __name__ == '__main__':
    iniciar_servidor()
