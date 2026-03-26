// ==========================================
// 1. BASE DE DATOS SIMULADA
// ==========================================
const usuarios_db = {
    "23070526": { nombre: "Salvador (Admin)", carrera: "Ing. Sistemas", mesa_activa: null, deuda: 0, prestamos: [] },
    "23070504": { nombre: "Maria Gonzalez", carrera: "Ing. Industrial", mesa_activa: null, deuda: 0, prestamos: [] },
    "INV-01": { nombre: "Visitante", carrera: "Externa", mesa_activa: null, deuda: 50, prestamos: [] }
};

const libros_db = {
    "LIB-01": { titulo: "Física Universitaria Vol 1", estado: "Disponible" },
    "LIB-02": { titulo: "Cálculo Integral", estado: "Disponible" },
    "LIB-03": { titulo: "Redes de Computadoras", estado: "Prestado a: Maria Gonzalez" },
    "LIB-04": { titulo: "Inteligencia Artificial", estado: "Disponible" }
};

const mesas_db = {
    "M1-PA": { desc: "Planta Baja - Biblioteca A", estado: "Disponible" },
    "M2-P1": { desc: "1er Piso - Biblioteca A", estado: "Disponible" },
    "M3-P2": { desc: "2do Piso - Biblioteca A", estado: "Disponible" },
    "CUB-1": { desc: "Cubículo 1 - Edificio B", estado: "Disponible" },
    "CUB-2": { desc: "Cubículo 2 - Edificio B", estado: "Disponible" }
};

const motivos_reserva = ["Proyecto en Equipo", "Lectura de Clase", "Estudio Individual", "Tutoría Académica"];

// ==========================================
// 2. ESTADO DEL SISTEMA GLOBALES
// ==========================================
let activity_log = [];
let usuarios_en_biblioteca = new Set();
let usuario_activo = null;

let ignoreScans = false;
let logoutTimer = null;
let selectedPreset = "20s";

// ==========================================
// 3. ELEMENTOS DEL DOM
// ==========================================
const statusBanner = document.getElementById("status-banner");
const panelAcciones = document.getElementById("panel-acciones");
const ddLibros = document.getElementById("dd-libros");
const ddMesas = document.getElementById("dd-mesas");
const ddMotivos = document.getElementById("dd-motivos");
const tbodyInventario = document.querySelector("#tabla-inventario tbody");
const tbodyLog = document.querySelector("#tabla-log tbody");
const tbodyDeudores = document.querySelector("#tabla-deudores tbody");
const btnPresets = document.querySelectorAll(".btn-preset");

// DOM Buttons
const btnEntrarSalir = document.getElementById("btn-entrar-salir");
const btnPrestar = document.getElementById("btn-prestar");
const btnReservar = document.getElementById("btn-reservar");
const btnCerrar = document.getElementById("btn-cerrar");

// ==========================================
// 4. LÓGICA DE NEGOCIO Y KIOSCO
// ==========================================

function playAnnoyingBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.5);
        
        gain.gain.setValueAtTime(1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 1);
    } catch(e) {
        console.error("Audio no soportado o bloqueado");
    }
}

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString('es-ES', { hour12: false });
}

function actualizarUiKiosco() {
    // 1. Actualizar tabla de libros
    tbodyInventario.innerHTML = "";
    Object.entries(libros_db).forEach(([id, datos]) => {
        const isDisponible = datos.estado === "Disponible";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${id}</td>
            <td>${datos.titulo}</td>
            <td class="${isDisponible ? 'text-success' : 'text-danger'}">${datos.estado}</td>
        `;
        tbodyInventario.appendChild(tr);
    });

    // 2. Actualizar tabla de logs
    tbodyLog.innerHTML = "";
    activity_log.forEach(log => {
        const tr = document.createElement("tr");
        let badgeClass = "badge-blue";
        if (log.tipo === "ENTRADA") badgeClass = "badge-green";
        else if (log.tipo === "SALIDA") badgeClass = "badge-orange";
        else if (log.tipo === "SEGURIDAD") badgeClass = "badge-red";
        else if (log.tipo === "RESERVA") badgeClass = "badge-purple";
        else if (log.tipo === "PRÉSTAMO") badgeClass = "badge-cyan";

        tr.innerHTML = `
            <td>${log.hora}</td>
            <td><span class="badge ${badgeClass}">${log.tipo}</span></td>
            <td>${log.detalle}</td>
        `;
        tbodyLog.appendChild(tr);
    });

    // 3. Refrescar listas desplegables
    if (usuario_activo) {
        // Libros
        ddLibros.innerHTML = '<option value="" disabled selected>1. Selecciona un libro disponible</option>';
        Object.entries(libros_db).forEach(([id, datos]) => {
            if (datos.estado === "Disponible") {
                const opt = document.createElement("option");
                opt.value = id;
                opt.textContent = datos.titulo;
                ddLibros.appendChild(opt);
            }
        });

        // Mesas
        ddMesas.innerHTML = '<option value="" disabled selected>1. Selecciona un espacio disponible</option>';
        Object.entries(mesas_db).forEach(([id, datos]) => {
            if (datos.estado === "Disponible") {
                const opt = document.createElement("option");
                opt.value = id;
                opt.textContent = datos.desc;
                ddMesas.appendChild(opt);
            }
        });
    }

    // 4. Actualizar tabla de deudores
    if (tbodyDeudores) {
        tbodyDeudores.innerHTML = "";
        Object.entries(usuarios_db).forEach(([id, datos]) => {
            if (datos.deuda > 0) {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${datos.nombre}</td>
                    <td class="text-danger">$${datos.deuda}</td>
                `;
                tbodyDeudores.appendChild(tr);
            }
        });
    }
}

function registrarLog(tipo, detalle) {
    activity_log.unshift({ hora: formatTime(), tipo, detalle });
    if (activity_log.length > 20) activity_log.pop();
    actualizarUiKiosco();
}

function actualizarStatusBanner(mensaje, tipoClase, duracionRevert = 0) {
    statusBanner.className = `status-banner banner-${tipoClase}`;
    statusBanner.innerHTML = mensaje;
}

function procesarAccesoKiosco(qr_data) {
    if (usuario_activo) {
        // Here we handle the admin barcode
        // The admin barcode is the reverse of the user's ID
        const reverso = usuario_activo.split('').reverse().join('');
        if (qr_data === reverso) {
            // It's the admin code!
            if (usuarios_db[usuario_activo].deuda > 0) {
                usuarios_db[usuario_activo].deuda = 0;
                actualizarStatusBanner(`<h3>¡Adeudo Pagado!</h3><p>El edificio administrativo ha liberado tu cuenta.</p>`, "green");
                registrarLog("PAGO", `${usuarios_db[usuario_activo].nombre} liquidó su adeudo.`);
                document.getElementById('instrucciones-admin').classList.add('hidden');
                
                btnEntrarSalir.disabled = false;
                btnPrestar.disabled = false;
                btnReservar.disabled = false;
                
                actualizarUiKiosco();
            }
        }
        return; // Ignorar otros escaneos mientras haya alguien logueado y no sea el código admin
    }

    if (usuarios_db.hasOwnProperty(qr_data)) {
        usuario_activo = qr_data;
        
        // Revisar si ya tiene un adeudo pendiente
        if (usuarios_db[qr_data].deuda > 0) {
            playAnnoyingBeep();
            actualizarStatusBanner(`
                <h3>ACCESO BLOQUEADO</h3>
                <p>Cuentas con un adeudo de $${usuarios_db[qr_data].deuda} pesos. No puedes usar los servicios.</p>
                <p>Pase a pagar al edificio administrativo.</p>
            `, "red");
            document.getElementById('instrucciones-admin').classList.remove('hidden');
            ignoreScans = false; // Permitimos que escanee el admin code
            
            panelAcciones.classList.remove("hidden");
            btnEntrarSalir.disabled = true;
            btnPrestar.disabled = true;
            btnReservar.disabled = true;
            return;
        }

        const nombre = usuarios_db[qr_data].nombre;
        const estandoDentro = usuarios_en_biblioteca.has(qr_data);
        const estadoAcceso = estandoDentro ? "DENTRO de instalaciones" : "FUERA de instalaciones";

        actualizarStatusBanner(`
            <h3>¡Hola ${nombre}!</h3>
            <p>(${estadoAcceso})</p>
            <p>Puedes realizar múltiples trámites. Al finalizar, presiona 'Terminar y Salir'.</p>
        `, "blue");

        // Motivos
        ddMotivos.innerHTML = '<option value="" disabled selected>2. ¿Para qué lo usarás?</option>';
        motivos_reserva.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            ddMotivos.appendChild(opt);
        });

        panelAcciones.classList.remove("hidden");

        // Ignorar lecturas dobles de escáner sin pausar la cámara
        ignoreScans = true;

        actualizarUiKiosco();

        // Limpiamos posible timer
        if (logoutTimer) clearTimeout(logoutTimer);

    } else {
        actualizarStatusBanner(`<h3>ACCESO DENEGADO</h3><p>Código desconocido.</p>`, "red");
        registrarLog("SEGURIDAD", "Intento de acceso fallido");
        playAnnoyingBeep();

        ignoreScans = true;
        if (logoutTimer) clearTimeout(logoutTimer);
        logoutTimer = setTimeout(cerrarSesionKiosco, 2000);
    }
}

function actionEntrarSalir() {
    if (!usuario_activo) return;
    const nombre = usuarios_db[usuario_activo].nombre;

    if (usuarios_en_biblioteca.has(usuario_activo)) {
        usuarios_en_biblioteca.delete(usuario_activo);
        registrarLog("SALIDA", `${nombre} marcó salida.`);
        actualizarStatusBanner(`<h3>Salida registrada</h3><p>¡Que tengas un excelente día, ${nombre}!</p>`, "orange");
    } else {
        usuarios_en_biblioteca.add(usuario_activo);
        registrarLog("ENTRADA", `${nombre} marcó entrada.`);
        actualizarStatusBanner(`<h3>Entrada registrada</h3><p>¡Bienvenido a la biblioteca!</p>`, "green");
    }

    if (logoutTimer) clearTimeout(logoutTimer);
    logoutTimer = setTimeout(cerrarSesionKiosco, 1500);
}

function actionPrestar() {
    const libroId = ddLibros.value;
    if (!libroId) {
        actualizarStatusBanner(`<h3>Error</h3><p>Selecciona un libro primero.</p>`, "red");
        return;
    }

    const nombre = usuarios_db[usuario_activo].nombre;
    libros_db[libroId].estado = `Prestado a: ${nombre}`;

    // Calcular fecha de vencimiento según preset
    let duracionMs = 0;
    if (selectedPreset === "20s") duracionMs = 20 * 1000;
    else if (selectedPreset === "2h") duracionMs = 2 * 60 * 60 * 1000;
    else if (selectedPreset === "2d") duracionMs = 2 * 24 * 60 * 60 * 1000;
    
    usuarios_db[usuario_activo].prestamos.push({
        libro: libroId,
        fecha_prestamo: Date.now(),
        fecha_vencimiento: Date.now() + duracionMs
    });

    registrarLog("PRÉSTAMO", `${nombre} se llevó: ${libros_db[libroId].titulo}`);

    actualizarStatusBanner(`<h3>¡Éxito!</h3><p>Libro asignado con éxito a tu cuenta. Puedes hacer otro trámite o terminar.</p>`, "cyan");
    actualizarUiKiosco();
}

function actionReservar() {
    const mesaId = ddMesas.value;
    const motivo = ddMotivos.value;
    const nombre = usuarios_db[usuario_activo].nombre;

    // REGLA 1: Revisar si el alumno ya tiene mesa
    if (usuarios_db[usuario_activo].mesa_activa !== null) {
        actualizarStatusBanner(`<h3>LÍMITE ALCANZADO</h3><p>Ya tienes la mesa ${usuarios_db[usuario_activo].mesa_activa} reservada. Solo 1 por alumno.</p>`, "red");
        return;
    }

    // REGLA 2: Validar campos vacíos
    if (!mesaId || !motivo) {
        actualizarStatusBanner(`<h3>Error</h3><p>Selecciona el espacio y el motivo.</p>`, "red");
        return;
    }

    // APLICAR RESERVA
    const descMesa = mesas_db[mesaId].desc;
    mesas_db[mesaId].estado = `Ocupada por: ${nombre}`;
    usuarios_db[usuario_activo].mesa_activa = mesaId;

    registrarLog("RESERVA", `${nombre} apartó: ${descMesa}`);

    actualizarStatusBanner(`<h3>¡Reserva Exitosa!</h3><p>${descMesa} es tuya. ¿Deseas hacer algo más?</p>`, "purple");
    actualizarUiKiosco();
}

function cerrarSesionKiosco() {
    usuario_activo = null;
    panelAcciones.classList.add("hidden");
    ignoreScans = false;

    actualizarStatusBanner(`
        <h3>Kiosco de Auto-Servicio</h3>
        <p>Pase su credencial o Código de Barras por la cámara para iniciar.</p>
    `, "default");
    
    // Restaurar botones a su estado original
    btnEntrarSalir.disabled = false;
    btnPrestar.disabled = false;
    btnReservar.disabled = false;
    document.getElementById('instrucciones-admin').classList.add('hidden');

    actualizarUiKiosco();
}

// Check every second for overdue loans
setInterval(() => {
    let changed = false;
    const now = Date.now();
    for (const [id, user] of Object.entries(usuarios_db)) {
        if (user.prestamos && user.prestamos.length > 0) {
            user.prestamos.forEach(p => {
                if (p.fecha_vencimiento < now && user.deuda === 0) {
                    // Overdue detected!
                    user.deuda = 50;
                    playAnnoyingBeep();
                    registrarLog("MULTA", `Adeudo generado para ${user.nombre} por retraso.`);
                    changed = true;
                    
                    if (usuario_activo === id) {
                        actualizarStatusBanner(`
                            <h3>PRÉSTAMO VENCIDO</h3>
                            <p>Tu préstamo expiró. Tienes un adeudo de $50 pesos.</p>
                            <p>Sistema bloqueado. Pase a pagar al edificio administrativo.</p>
                        `, "red");
                        panelAcciones.classList.remove("hidden");
                        document.getElementById('instrucciones-admin').classList.remove('hidden');
                        btnEntrarSalir.disabled = true;
                        btnPrestar.disabled = true;
                        btnReservar.disabled = true;
                        ignoreScans = false;
                    }
                }
            });
        }
    }
    if (changed) {
        actualizarUiKiosco();
    }
}, 1000);

// ==========================================
// 5. INICIALIZACIÓN
// ==========================================
function onScanSuccess(decodedText, decodedResult) {
    if (ignoreScans) return;
    console.log(`Code matched = ${decodedText}`);
    // Si ya estamos logueados, ignorar escaneos
    procesarAccesoKiosco(decodedText);
}

function onScanFailure(error) {
    // Ignorar errores de reconocimiento
}

// Gráfica Chart.js
let chartHoras = null;
function inicializarGrafica() {
    const ctx = document.getElementById('chart-horas').getContext('2d');
    
    // Datos generados fijos para demostración
    const labels = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
    const trafico = [15, 30, 85, 120, 110, 150, 45, 60, 20];

    chartHoras = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Interacciones',
                data: trafico,
                borderColor: '#007acc',
                backgroundColor: 'rgba(0, 122, 204, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(48, 54, 61, 0.5)' },
                    ticks: { color: '#8b949e' }
                },
                x: {
                    grid: { color: 'rgba(48, 54, 61, 0.5)' },
                    ticks: { color: '#8b949e' }
                }
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Event Listeners
    btnEntrarSalir.addEventListener("click", actionEntrarSalir);
    btnPrestar.addEventListener("click", actionPrestar);
    btnReservar.addEventListener("click", actionReservar);
    btnCerrar.addEventListener("click", cerrarSesionKiosco);

    // Event listeners para los presets
    btnPresets.forEach(btn => {
        btn.addEventListener("click", (e) => {
            btnPresets.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            selectedPreset = e.target.getAttribute("data-time");
        });
    });

    // Event listener para simulador manual
    const btnSimular = document.getElementById("btn-simular");
    if (btnSimular) {
        btnSimular.addEventListener("click", () => {
            const val = document.getElementById("input-simulador").value.trim();
            if (val) {
                onScanSuccess(val);
                document.getElementById("input-simulador").value = "";
            }
        });
    }

    // Initial render
    actualizarUiKiosco();
    if(document.getElementById('chart-horas')) inicializarGrafica();

    // Iniciar el escáner con facingMode forzará la solicitud de permisos al navegador.
    setTimeout(() => {
        const html5QrCode = new window.Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 300, height: 150 } };
        
        // Intentar primero con la cámara 'environment' (trasera/autofoco) ideal para códigos
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        ).catch(err => {
            console.warn("Fallo cámara environment, intentando user...", err);
            // Fallback a cámara frontal
            html5QrCode.start(
                { facingMode: "user" },
                config,
                onScanSuccess,
                onScanFailure
            ).catch(err2 => {
                console.error("Error al iniciar cámara: ", err2);
                actualizarStatusBanner(`<h3>Error de Cámara</h3><p>Asegúrate de dar permisos de cámara en tu navegador.</p>`, "red");
            });
        });
    }, 500);
});
