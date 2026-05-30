# Radar de Espectro Digital

Autor: Jose Palencia

Este es un analizador y radar de espectro digital para redes Wi-Fi (bandas de 2.4 GHz y 5 GHz) que incluye un recomendador tactico de canales y un visualizador de solapamiento fisico de frecuencia. El proyecto corre de forma local e interactiva a traves de una interfaz web cyberpunk.

## Caracteristicas

- **Radar Pasivo en Tiempo Real**: Escanea el aire en busca de redes y posiciona graficamente las seniales en un radar circular con barrido de fosforo activo.
- **Visualizador de Ondas de Espectro**: Representa las campanas de Gauss (ondas) de cada canal de 2.4 GHz para ver de forma grafica como se solapan fisicamente entre si.
- **Analisis de Saturacion**: Mapea y clasifica la saturacion de los canales (libre, moderado, saturado) calculando la interferencia directa y por solapamiento adyacente.
- **Recomendador Tactico**: Recomienda de manera automatica el canal fisico mas libre (1, 6 u 11) para optimizar el rendimiento.
- **Multiantena**: Soporta la seleccion dinamica entre multiples adaptadores de red inalambricos de forma nativa.

## Estructura del Proyecto

- `radar.py`: Script de consola que ejecuta el escaneo nativo en Windows y muestra un analisis rapido del espectro.
- `gui.py`: Servidor HTTP ligero en Python que expone una API REST (`/api/scan`) y sirve los archivos de la interfaz grafica.
- `index.html`: Estructura HTML5 semantica de la interfaz web con iconos vectoriales SVG.
- `style.css`: Estilo cyberpunk responsivo con efectos de cristal (glassmorphism), neon y lineas de barrido CRT.
- `app.js`: Logica de control de la interfaz web, calculos de solapamiento, graficos dinamicos de ondas y animaciones en tiempo real.

## Requisitos e Instalacion

1. Sistema Operativo: Windows (utiliza comandos nativos de `netsh wlan`).
2. Python 3.x instalado.

No requiere dependencias externas adicionales, ya que utiliza librerias nativas de Python y tecnologias web estandar (HTML5, CSS3, Javascript Vanilla).

## Como Iniciar

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta el servidor web:
   ```bash
   python gui.py
   ```
3. Se abrira automaticamente el navegador en `http://localhost:8000`. Tambien puedes abrir el enlace manualmente.
4. Presiona el boton **"Reescanear Espectro"** para comenzar el escaneo.
