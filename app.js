//Jose Palencia
//Elementos del DOM
const btnScan = document.getElementById('btn-scan');

//Iconos SVG reutilizables
const SVG_ANTENNA = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon" style="vertical-align: middle; margin-right: 6px;"><circle cx="12" cy="12" r="2"></circle><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M12 6a6 6 0 0 1 6 6"></path><path d="M12 22v-4"></path><path d="M2 12a10 10 0 0 1 10-10"></path><path d="M6 12a6 6 0 0 1 6-6"></path></svg>`;

const SVG_LOADING = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svg-icon-spin animate-spin" style="vertical-align: middle; margin-right: 6px;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`;

const SVG_WIFI_MINI = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon-mini" style="vertical-align: middle; opacity: 0.7; margin-right: 6px;"><circle cx="12" cy="12" r="2"></circle><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M12 6a6 6 0 0 1 6 6"></path><path d="M2 12a10 10 0 0 1 10-10"></path><path d="M6 12a6 6 0 0 1 6-6"></path></svg>`;
const scanStatus = document.getElementById('scan-status');
const interfaceTabs = document.getElementById('interface-tabs');
const radarDotsContainer = document.getElementById('radar-dots-container');
const recTitle = document.getElementById('rec-title');
const recDesc = document.getElementById('rec-desc');
const recBanner = document.getElementById('recommendation-banner');
const channelsGrid = document.getElementById('channels-grid');
const networksCount = document.getElementById('networks-count');
const networksListBody = document.getElementById('networks-list-body');
const spectrumWavesContainer = document.getElementById('spectrum-waves-container');
const adapterNameBadge = document.getElementById('adapter-name-badge');

//Estado de la aplicacion
let appState = {
    interfaces: {},
    selectedInterface: '',
    isScanning: false
};

//Funcion para calcular interferencia por solapamiento y analizar espectro
function analizarEspectro(redes) {
    const conteoCanales = {};
    const bandasCanales = {}; //Guardar si el canal es de 2.4 GHz o 5 GHz
    const redesPorCanal = {};

    redes.forEach(red => {
        conteoCanales[red.canal] = (conteoCanales[red.canal] || 0) + 1;
        bandasCanales[red.canal] = red.banda;
        if (!redesPorCanal[red.canal]) {
            redesPorCanal[red.canal] = [];
        }
        redesPorCanal[red.canal].push(red);
    });

    //Canales unicos detectados y ordenados numericamente
    const canalesDetectados = Object.keys(conteoCanales)
        .map(Number)
        .sort((a, b) => a - b);

    const analisis = {};

    canalesDetectados.forEach(c => {
        const directas = conteoCanales[c];
        const banda = bandasCanales[c];
        let adyacentes = 0;
        const redesAdyacentesDetalle = [];

        if (banda === '2.4 GHz') {
            //Calcular solapamiento para canales 2.4 GHz
            for (let canalActivo in conteoCanales) {
                const canalActivoNum = Number(canalActivo);
                if (bandasCanales[canalActivoNum] === '2.4 GHz') {
                    const distancia = Math.abs(canalActivoNum - c);
                    if (distancia > 0 && distancia < 5) {
                        const cantidad = conteoCanales[canalActivoNum];
                        adyacentes += cantidad;
                        redesAdyacentesDetalle.push(`Ch${canalActivoNum}x${cantidad}`);
                    }
                }
            }
        }

        const totalPuntos = directas + adyacentes;
        let estado = 'free';
        let estadoTexto = '';

        if (banda === '2.4 GHz') {
            if (directas >= 3 || totalPuntos >= 5) {
                estado = 'saturated';
                estadoTexto = `SATURADO (${directas} directas + ${adyacentes} adyacentes)`;
            } else if (directas >= 1 || totalPuntos >= 2) {
                estado = 'moderate';
                estadoTexto = `MODERADO (${directas} directas + ${adyacentes} adyacentes)`;
            } else {
                estado = 'free';
                estadoTexto = 'LIBRE (Cero interferencias)';
            }
        } else {
            //Para 5 GHz no hay solapamiento directo estandar (se considera saturado si hay muchas directas)
            if (directas >= 3) {
                estado = 'saturated';
                estadoTexto = `SATURADO (${directas} directas)`;
            } else {
                estado = 'moderate';
                estadoTexto = `MODERADO (${directas} directas)`;
            }
        }

        const redesCanal = redesPorCanal[c] || [];
        const maxSenal = redesCanal.reduce((max, r) => Math.max(max, r.senal), 0);
        const listaSsid = redesCanal.map(r => `${r.ssid} (${r.senal}%)`).join(', ');

        analisis[c] = {
            canal: c,
            banda: banda,
            directas,
            adyacentes,
            totalPuntos,
            estado,
            estadoTexto,
            maxSenal,
            listaSsid,
            detalleSolapados: redesAdyacentesDetalle.join(', ')
        };
    });

    return analisis;
}

//Funcion para generar el icono wifi vectorial SVG segun la potencia de senial
function getWifiSvg(senal) {
    let opacity1 = senal >= 25 ? '1' : '0.25';
    let opacity2 = senal >= 50 ? '1' : '0.25';
    let opacity3 = senal >= 75 ? '1' : '0.25';
    let color = 'var(--color-red)';
    if (senal >= 70) color = 'var(--color-green)';
    else if (senal >= 40) color = 'var(--color-yellow)';
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svg-wifi-icon" style="vertical-align: middle; margin-right: 6px;">
        <path d="M12 20h.01" />
        <path d="M8.5 16.5a5 5 0 0 1 7 0" style="opacity: ${opacity1};" />
        <path d="M5 13a10 10 0 0 1 14 0" style="opacity: ${opacity2};" />
        <path d="M1.5 9.5a15 15 0 0 1 21 0" style="opacity: ${opacity3};" />
    </svg>`;
}

//Renderiza el estado actual en la UI
function renderUI() {
    const interfacesDisponibles = Object.keys(appState.interfaces);
    
    //1. Renderizar pestanias de interfaces si no hay o han cambiado
    interfaceTabs.innerHTML = '';
    if (interfacesDisponibles.length === 0) {
        interfaceTabs.innerHTML = '<div class="table-empty">No se detectaron interfaces de Wi-Fi</div>';
        recTitle.textContent = "No hay adaptadores Wi-Fi";
        recDesc.textContent = "Conecta un adaptador inalambrico o activa el interruptor de red inalambrica.";
        channelsGrid.innerHTML = '<div class="channel-card-placeholder">Esperando datos de espectro...</div>';
        spectrumWavesContainer.innerHTML = '<div class="channel-card-placeholder">Esperando datos de espectro para generar ondas...</div>';
        networksListBody.innerHTML = '<tr><td colspan="4" class="table-empty">Sin redes disponibles.</td></tr>';
        networksCount.textContent = "0 Redes";
        radarDotsContainer.innerHTML = '';
        if (adapterNameBadge) adapterNameBadge.textContent = 'Sin adaptador';
        return;
    }

    interfacesDisponibles.forEach((intf, idx) => {
        const btn = document.createElement('button');
        btn.id = `tab-${intf.toLowerCase().replace(/\s+/g, '-')}`;
        btn.className = `tab-btn ${intf === appState.selectedInterface ? 'active' : ''}`;
        
        const count = appState.interfaces[intf].length;
        btn.innerHTML = `${intf} <span class="tab-networks-count">${count}</span>`;
        
        btn.addEventListener('click', () => {
            appState.selectedInterface = intf;
            renderUI();
        });
        interfaceTabs.appendChild(btn);
    });

    const redes = appState.interfaces[appState.selectedInterface] || [];
    if (adapterNameBadge) {
        adapterNameBadge.textContent = appState.selectedInterface || 'Sin adaptador';
    }
    
    //2. Renderizar Radar
    radarDotsContainer.innerHTML = '';
    redes.forEach((red, idx) => {
        const dot = document.createElement('div');
        dot.className = `radar-dot ${red.banda === '2.4 GHz' ? 'dot-24' : 'dot-5'}`;
        
        //Calcular posicion polar a cartesiana relativa a la pantalla de 260px (radio maximo = 120px)
        const radioCentro = 130;
        //Senial 100% -> Radio 30px (cerca del centro)
        //Senial 0% -> Radio 120px (borde exterior)
        const r = 30 + 90 * (1 - red.senal / 100);
        
        //Angulo segun canal
        let angulo = 0;
        if (red.banda === '2.4 GHz') {
            //Canales 1-14 de 2.4GHz en la mitad superior (0 a 180 grados)
            angulo = (red.canal / 14) * Math.PI;
        } else {
            //Canales 5GHz en la mitad inferior (180 a 360 grados)
            //Canales tipicos de 36 a 165
            const canalMin = 36;
            const canalMax = 165;
            const porcentajeCanal = (red.canal - canalMin) / (canalMax - canalMin);
            angulo = Math.PI + porcentajeCanal * Math.PI;
        }
        
        const x = radioCentro + r * Math.cos(angulo);
        const y = radioCentro - r * Math.sin(angulo); //Resta porque el eje Y va hacia abajo en CSS
        
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        
        //Guardamos el angulo en grados en un atributo personalizado para el barrido del radar
        dot.setAttribute('data-angle', (angulo * 180 / Math.PI).toFixed(1));
        
        //Tooltip
        const tooltip = document.createElement('span');
        tooltip.className = 'radar-dot-label';
        tooltip.textContent = `${red.ssid} (Ch ${red.canal})`;
        dot.appendChild(tooltip);
        
        radarDotsContainer.appendChild(dot);
    });

    //3. Renderizar Analisis de Espectro
    const analisis = analizarEspectro(redes);
    channelsGrid.innerHTML = '';
    
    const canalesDetectados = Object.keys(analisis).map(Number);
    
    if (canalesDetectados.length === 0) {
        channelsGrid.innerHTML = '<div class="channel-card-placeholder">No se detectaron redes en el espectro.</div>';
    } else {
        canalesDetectados.forEach(chNum => {
            const info = analisis[chNum];
            const card = document.createElement('div');
            card.className = `channel-card ${info.estado}`;
            
            //Si es de 5 GHz no mostramos datos de solapamiento
            const es24 = info.banda === '2.4 GHz';
            const sublabel = es24 ? '2.4 GHz' : '5 GHz';
            
            card.innerHTML = `
                <div class="channel-info">
                    <span class="channel-number">Canal ${String(chNum).padStart(2, '0')} <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-secondary);">(${sublabel})</span></span>
                    <span class="status-indicator">${info.estado.toUpperCase()}</span>
                </div>
                <div class="channel-stats">
                    <div class="stat-row">
                        <span class="stat-label">Redes directas:</span>
                        <span class="stat-value">${info.directas}</span>
                    </div>
                    ${es24 ? `
                    <div class="stat-row">
                        <span class="stat-label">Interf. solapamiento:</span>
                        <span class="stat-value">+${info.adyacentes}</span>
                    </div>
                    ` : ''}
                </div>
                ${es24 ? `
                <div class="channel-overlaps">
                    ${info.detalleSolapados ? `Solapamientos: ${info.detalleSolapados}` : 'Sin canales solapados activos'}
                </div>
                ` : `
                <div class="channel-overlaps">
                    Canal no solapado (Frecuencia 5 GHz)
                </div>
                `}
            `;
            channelsGrid.appendChild(card);
        });
    }

    //3b. Renderizar Ondas de Espectro (Visualizador de Solapamiento)
    spectrumWavesContainer.innerHTML = '';
    
    //Eje x: Ticks de canales 1 a 14
    for (let c = 1; c <= 14; c++) {
        const label = document.createElement('div');
        label.className = 'spectrum-axis-label';
        label.style.left = `${12 + (c - 1) * (76 / 13)}%`;
        label.textContent = c;
        spectrumWavesContainer.appendChild(label);
    }

    const canales24 = Object.values(analisis).filter(info => info.banda === '2.4 GHz');
    if (canales24.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'channel-card-placeholder';
        placeholder.style.position = 'absolute';
        placeholder.style.width = '100%';
        placeholder.style.top = '40%';
        placeholder.textContent = 'Sin redes de 2.4 GHz detectadas para generar ondas.';
        spectrumWavesContainer.appendChild(placeholder);
    } else {
        canales24.forEach(info => {
            const wave = document.createElement('div');
            wave.className = `spectrum-wave ${info.estado}`;
            wave.style.left = `${12 + (info.canal - 1) * (76 / 13)}%`;
            wave.style.width = '24%'; //Ancho de canal de 22 MHz teorico (aproximadamente 4.1 canales de ancho)
            
            const tooltip = document.createElement('span');
            tooltip.className = 'spectrum-wave-tooltip';
            tooltip.textContent = `Ch ${info.canal} (${info.estado.toUpperCase()}) | Max Senial: ${info.maxSenal}% | Redes: ${info.listaSsid}`;
            wave.appendChild(tooltip);
            
            spectrumWavesContainer.appendChild(wave);
            
            //Animacion progresiva de altura
            setTimeout(() => {
                wave.style.height = `${info.maxSenal * 0.9}%`;
            }, 50);
        });
    }

    //4. Renderizar Recomendacion Tactica
    //Evaluamos los canales estandar [1, 6, 11] basandonos en todas las redes de 2.4 GHz detectadas
    const canalesPrincipales = [1, 6, 11];
    let mejorCanal = 1;
    let minInterferencia = Infinity;

    //Crear un conteo de todos los canales de 2.4 GHz detectados
    const conteo24 = {};
    redes.forEach(r => {
        if (r.banda === '2.4 GHz') {
            conteo24[r.canal] = (conteo24[r.canal] || 0) + 1;
        }
    });

    canalesPrincipales.forEach(c => {
        const directas = conteo24[c] || 0;
        let adyacentes = 0;
        for (let canalActivo in conteo24) {
            const canalActivoNum = Number(canalActivo);
            const distancia = Math.abs(canalActivoNum - c);
            if (distancia > 0 && distancia < 5) {
                adyacentes += conteo24[canalActivoNum];
            }
        }
        const totalPuntos = directas + adyacentes;
        if (totalPuntos < minInterferencia) {
            minInterferencia = totalPuntos;
            mejorCanal = c;
        }
    });

    if (redes.some(r => r.banda === '2.4 GHz')) {
        recTitle.textContent = `CONFIGURAR CANAL ${mejorCanal}`;
        recDesc.textContent = `El espectro de 2.4 GHz de la antena "${appState.selectedInterface}" indica que el canal ${mejorCanal} ofrece las mejores condiciones (nivel de interferencia de ${minInterferencia} puntos).`;
    } else if (redes.length > 0) {
        recTitle.textContent = `ESPECTRO 5 GHz DETECTADO`;
        recDesc.textContent = `Todas las redes captadas por "${appState.selectedInterface}" estan en la banda de 5 GHz, libre de solapamientos estandar de 2.4 GHz.`;
    } else {
        recTitle.textContent = `Analizando canales...`;
        recDesc.textContent = `Inicia un escaneo para determinar la mejor configuracion fisica para tu red privada.`;
    }

    //5. Renderizar lista de redes en tabla
    networksCount.textContent = `${redes.length} Redes`;
    networksListBody.innerHTML = '';
    
    if (redes.length === 0) {
        networksListBody.innerHTML = '<tr><td colspan="4" class="table-empty">No se captaron redes inalambricas en esta antena.</td></tr>';
        return;
    }

    //Ordenar redes por fuerza de senial descendente
    const redesOrdenadas = [...redes].sort((a, b) => b.senal - a.senal);

    redesOrdenadas.forEach((red, idx) => {
        const row = document.createElement('tr');
        
        //Estilo de la barra de senial
        let signalClass = 'weak';
        if (red.senal >= 70) signalClass = 'strong';
        else if (red.senal >= 40) signalClass = 'medium';
        
        const badgeClass = red.banda === '2.4 GHz' ? 'badge-24' : 'badge-5';
        
        row.innerHTML = `
            <td>
                <div class="ssid-cell">
                    ${getWifiSvg(red.senal)}
                    <span>${red.ssid}</span>
                </div>
            </td>
            <td><strong>${red.canal}</strong></td>
            <td><span class="${badgeClass}">${red.banda}</span></td>
            <td>
                <div class="signal-cell">
                    <span class="signal-value">${red.senal}%</span>
                    <div class="signal-bar-bg">
                        <div class="signal-bar-fill ${signalClass}" style="width: ${red.senal}%"></div>
                    </div>
                </div>
            </td>
        `;
        networksListBody.appendChild(row);
    });
}

//Funcion para obtener el angulo de rotacion actual del barrido en grados
function getSweepAngle() {
    const sweep = document.querySelector('.radar-sweep');
    if (!sweep) return 0;
    const style = window.getComputedStyle(sweep);
    const transform = style.transform || style.webkitTransform;
    if (!transform || transform === 'none') return 0;
    const values = transform.split('(')[1].split(')')[0].split(',');
    const a = parseFloat(values[0]);
    const b = parseFloat(values[1]);
    let angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
    if (angle < 0) angle += 360;
    return angle;
}

//Bucle de animacion en tiempo real para iluminar los puntos del radar
let sweepLoopActive = false;
function startRadarSweepLoop() {
    if (sweepLoopActive) return;
    sweepLoopActive = true;
    
    function tick() {
        const sweepAngle = getSweepAngle();
        //Convertir el angulo CSS del barrido (sentido horario, 0 arriba) a angulo polar
        let sweepPolar = (90 - sweepAngle) % 360;
        if (sweepPolar < 0) sweepPolar += 360;
        
        const dots = document.querySelectorAll('.radar-dot');
        dots.forEach(dot => {
            const angleDeg = parseFloat(dot.getAttribute('data-angle') || '0');
            let diff = Math.abs(sweepPolar - angleDeg);
            if (diff > 180) diff = 360 - diff;
            
            //Si la linea de barrido esta sobre el punto, lo activa (iluminado y visible)
            if (diff < 12) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
        
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

//Funcion para solicitar un escaneo a la API
async function realizarEscaneo() {
    if (appState.isScanning) return;
    
    appState.isScanning = true;
    btnScan.classList.add('scanning');
    btnScan.disabled = true;
    btnScan.innerHTML = `${SVG_LOADING} Escaneando Espectro...`;
    scanStatus.textContent = 'Buscando redes en el aire...';
    
    //Aniadir animacion al radar
    document.querySelector('.radar-sweep').style.animationDuration = '1.5s';
    
    try {
        const response = await fetch('/api/scan');
        if (!response.ok) throw new Error('Error en el escaneo.');
        
        const data = await response.json();
        
        //Si hay algun error en el backend
        if (data.error) {
            alert(`Error de escaneo: ${data.error}`);
            scanStatus.textContent = 'Error al escanear';
            return;
        }
        
        appState.interfaces = data;
        
        //Si la interfaz seleccionada ya no existe, o si es la primera carga
        const keys = Object.keys(data);
        if (keys.length > 0) {
            //Preferir la primera interfaz disponible si no hay seleccion previa o ya no existe
            if (!appState.selectedInterface || !data[appState.selectedInterface]) {
                appState.selectedInterface = keys[0];
            }
            scanStatus.textContent = `Escaneo finalizado con exito a las ${new Date().toLocaleTimeString()}`;
        } else {
            appState.selectedInterface = '';
            scanStatus.textContent = 'No se detectaron redes';
        }
        
        renderUI();
    } catch (error) {
        console.error(error);
        scanStatus.textContent = 'Fallo en la comunicacion con el servidor';
    } finally {
        appState.isScanning = false;
        btnScan.classList.remove('scanning');
        btnScan.disabled = false;
        btnScan.innerHTML = `${SVG_ANTENNA} Reescanear Espectro`;
        document.querySelector('.radar-sweep').style.animationDuration = '4s';
    }
}

//Listeners
btnScan.addEventListener('click', realizarEscaneo);

//Escaneo inicial y activacion del barrido
window.addEventListener('DOMContentLoaded', () => {
    realizarEscaneo();
    startRadarSweepLoop();
});
