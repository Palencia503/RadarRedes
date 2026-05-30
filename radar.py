#Jose Palencia
import subprocess
import re
import sys
from collections import Counter

#Aseguramos que la consola use UTF-8 para imprimir sin fallar en Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def escanear_aire():
    print("Iniciando escaneo pasivo a traves de todas las antenas detectadas...")
    print("----------------------------------------------------------------------")
    
    #Ejecutamos el comando nativo de Windows para listar redes Wi-Fi a fondo
    try:
        proceso = subprocess.Popen(["netsh", "wlan", "show", "networks", "mode=bssid"], 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE, 
                                   encoding='utf-8',
                                   errors='replace')
        stdout, stderr = proceso.communicate()
    except Exception as e:
        print(f"Error al ejecutar netsh: {e}")
        return
    
    #Dividimos la salida por cada interfaz inalambrica encontrada
    bloques_interfaz = re.split(r'\n(?:Nombre de interfaz|Interface name)\s*:\s*', stdout)
    
    #El primer elemento contiene la cabecera general antes del primer nombre de interfaz
    if bloques_interfaz:
        bloques_interfaz.pop(0)
    
    if not bloques_interfaz:
        print("No se detectaron interfaces inalambricas activas en el sistema.")
        return

    for bloque_int in bloques_interfaz:
        lineas = bloque_int.split('\n')
        if not lineas:
            continue
        
        #El nombre de la interfaz es la primera linea del bloque
        nombre_interfaz = lineas[0].strip()
        print(f"ANTENA / INTERFAZ: {nombre_interfaz}")
        print("=" * (19 + len(nombre_interfaz)))
        
        #El resto del bloque contiene las redes detectadas
        resto_bloque = "\n".join(lineas[1:])
        
        #Dividimos el bloque por cada red (SSID)
        bloques_ssid = re.split(r'\n(?=SSID \d+\s*:\s*)', resto_bloque)
        
        #Descartamos texto de cabecera local de la interfaz si no empieza con SSID
        if bloques_ssid and not re.match(r'^\s*SSID \d+\s*:\s*', bloques_ssid[0]):
            bloques_ssid.pop(0)
            
        if not bloques_ssid:
            print("No se detectaron redes en esta antena (desconectada o sin senial).")
            continue
            
        redes_detectadas = []
        todos_los_canales_24 = []
        
        print("REDES CAPTADAS POR ESTA ANTENA:\n")
        
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
                
            #Dividimos el bloque SSID por cada BSSID
            bloques_bssid = re.split(r'\n\s*BSSID\s+\d+', bloque_ssid_text)
            if bloques_bssid:
                bloques_bssid.pop(0) #Quitamos cabecera del SSID
                
            for bssid_text in bloques_bssid:
                match_canal = re.search(r'^\s*(?:Canal|Channel)\s*:\s*(\d+)', bssid_text, re.MULTILINE | re.IGNORECASE)
                match_senal = re.search(r'^\s*(?:Se.{1,2}al|Signal)\s*:\s*(\d+)%', bssid_text, re.MULTILINE | re.IGNORECASE)
                
                if match_canal and match_senal:
                    canal_num = int(match_canal.group(1))
                    senal_val = match_senal.group(1)
                    senal = senal_val + "%"
                    
                    #Clasificamos banda (2.4 GHz vs 5 GHz)
                    es_24 = (1 <= canal_num <= 14)
                    if es_24:
                        todos_los_canales_24.append(canal_num)
                        
                    redes_detectadas.append({
                        'ssid': ssid_nombre,
                        'canal': canal_num,
                        'senal': senal,
                        'es_24': es_24
                    })
                    
                    banda_str = "2.4 GHz" if es_24 else "5 GHz"
                    print(f"Red: {ssid_nombre:<25} -> Canal: {canal_num:<3} ({banda_str}) | Senial: {senal}")
                
        if not redes_detectadas:
            print("No se procesaron redes validas en esta interfaz.")
            continue
            
        print("\nANALISIS DE ESPECTRO (BANDA 2.4 GHz)")
        print("-" * 45)
        
        #Contamos la cantidad de redes por cada canal 2.4 GHz
        conteo_canales = Counter(todos_los_canales_24)
        canales_principales = [1, 6, 11]
        interferencia_canales = {}
        
        print("Saturacion actual y solapamiento en canales principales:")
        for c in canales_principales:
            directas = conteo_canales[c]
            adcentes_interfiriendo = 0
            redes_adcentes_detalle = []
            
            for canal_activo, cantidad in conteo_canales.items():
                distancia = abs(canal_activo - c)
                if 0 < distancia < 5:
                    adcentes_interfiriendo += cantidad
                    redes_adcentes_detalle.append(f"Ch{canal_activo}x{cantidad}")
                    
            total_puntos = directas + adcentes_interfiriendo
            interferencia_canales[c] = total_puntos
            
            if directas == 0 and adcentes_interfiriendo == 0:
                estado = "LIBRE (Cero interferencias)"
            elif directas >= 3 or total_puntos >= 5:
                estado = f"SATURADO ({directas} directas + {adcentes_interfiriendo} adyacentes)"
            else:
                estado = f"MODERADO ({directas} directas + {adcentes_interfiriendo} adyacentes)"
                
            detalle_adj = f" [Solapados: {', '.join(redes_adcentes_detalle)}]" if redes_adcentes_detalle else ""
            print(f"Canal {c:02d}: {estado}{detalle_adj}")
            
        #Recomendacion tactica para esta antena
        mejor_canal = min(canales_principales, key=lambda c: interferencia_canales[c])
        
        print("-" * 45)
        print(f"RECOMENDACION TACTICA PARA {nombre_interfaz.upper()}")
        print(f"El mejor canal fisico de 2.4 GHz es el: CANAL {mejor_canal}!")
        print(f"(Interferencia de {interferencia_canales[mejor_canal]} puntos frente a otros canales)")
        print("-" * 45 + "\n")

if __name__ == "__main__":
    escanear_aire()