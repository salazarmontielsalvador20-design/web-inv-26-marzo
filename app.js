// ==========================================
// 1. DATA BASE SIMULADA
// ==========================================
const usuarios_db = {
    "23070526": { nombre: "Salvador Salazar Montiel", carrera: "Ing. Sistemas", mesa_activa: null, deuda: 0, prestamos: [] },
    "23070504": { nombre: "Nieto Cabriales Ernesto", carrera: "Ing. Industrial", mesa_activa: null, deuda: 0, prestamos: [] },
    "INV-01": { nombre: "Visitante", carrera: "Externa", mesa_activa: null, deuda: 50, prestamos: [] },
    "23070510": { nombre: "Juan Perez", carrera: "Ing. Sistemas", mesa_activa: null, deuda: 0, prestamos: [] },
    "23070511": { nombre: "Ana Lopez", carrera: "Ing. Industrial", mesa_activa: null, deuda: 0, prestamos: [] },
    "23070512": { nombre: "Carlos Sanchez", carrera: "Ing. Quimica", mesa_activa: null, deuda: 0, prestamos: [] },
    "23070513": { nombre: "Laura Martinez", carrera: "Ing. Electronica", mesa_activa: null, deuda: 0, prestamos: [] },
    "23070514": { nombre: "Pedro Ramirez", carrera: "Lic. Administracion", mesa_activa: null, deuda: 0, prestamos: [] },
    "23070515": { nombre: "Sofia Torres", carrera: "Ing. Civil", mesa_activa: null, deuda: 0, prestamos: [] },
    "23070516": { nombre: "Diego Garcia", carrera: "Ing. Mecanica", mesa_activa: null, deuda: 0, prestamos: [] }
};

const categorias_libros = ["Ingeniería", "Química", "Matemáticas", "Electrónica", "Medicina", "Programación", "Física"];
const prefijos = ["Fundamentos de", "Introducción a", "Avanzado:", "Manual de", "Principios de", "Guía Práctica de", "Aplicaciones de"];
const libros_db = {};

// Generar 50 libros dinámicamente
for (let i = 1; i <= 50; i++) {
    const cat = categorias_libros[i % categorias_libros.length];
    const pref = prefijos[i % prefijos.length];
    const id = `LIB-${i.toString().padStart(3, '0')}`;
    const standRow = ['A', 'B', 'C', 'D', 'E'][i % 5];
    const standCol = Math.ceil(i / 10);

    libros_db[id] = {
        id: id,
        titulo: `${pref} ${cat} Vol. ${Math.ceil(i / 7)}`,
        categoria: cat,
        stand: `Stand ${standRow}${standCol}`,
        ejemplares_totales: Math.floor(Math.random() * 4) + 1, // 1 to 4 copies
        ejemplares_disponibles: 0
    };
    libros_db[id].ejemplares_disponibles = libros_db[id].ejemplares_totales;
}

const mesas_db = {
    "CUB-L1": { desc: "Cubículo L1 (Izq)", estado: "Disponible", pos: "left" },
    "CUB-L2": { desc: "Cubículo L2 (Izq)", estado: "Disponible", pos: "left" },
    "CUB-L3": { desc: "Cubículo L3 (Izq)", estado: "Disponible", pos: "left" },
    "CUB-L4": { desc: "Cubículo L4 (Izq)", estado: "Disponible", pos: "left" },
    "CUB-R1": { desc: "Cubículo R1 (Der)", estado: "Disponible", pos: "right" },
    "CUB-R2": { desc: "Cubículo R2 (Der)", estado: "Disponible", pos: "right" },
    "CUB-R3": { desc: "Cubículo R3 (Der)", estado: "Disponible", pos: "right" },
    "CUB-R4": { desc: "Cubículo R4 (Der)", estado: "Disponible", pos: "right" }
};

// ==========================================
// 2. ESTADOS GLOBALES
// ==========================================
let activity_log = [
    { hora: "08:15:22", tipo: "ENTRADA", detalle: "Laura Martinez entró." },
    { hora: "08:42:10", tipo: "PRÉSTAMO", detalle: "Carlos Sanchez pidió Fundamentos de Química Vol. 1" },
    { hora: "09:05:44", tipo: "RESERVA", detalle: "Ana Lopez reservó Cubículo L1 (Izq)" },
    { hora: "09:30:12", tipo: "SALIDA", detalle: "Juan Perez salió." }
];
let usuarios_en_biblioteca = new Set();
let usuario_activo = null;
let currentView = "view-stats";

// Scanner state
let html5QrCode = null;
let currentFacingMode = "environment";
let ignoreScans = false;
let scanLock = false;
let esperandoPago = false;
let logoutTimer = null;
let selectedPreset = "20s";

// Inventory State
let currentInvCategory = "ALL";
let currentInvSearch = "";

// Chart
let chartHoras = null;

// ==========================================
// 3. UI RENDERING LOGIC
// ==========================================

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString('es-ES', { hour12: false });
}

function registrarLog(tipo, detalle) {
    activity_log.unshift({ hora: formatTime(), tipo, detalle });
    if (activity_log.length > 20) activity_log.pop();
    actualizarLogs();
}

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
    } catch (e) { }
}

function playSuccessBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) { }
}

function actualizarStatusBanner(mensaje, tipoClase) {
    const banner = document.getElementById("status-banner");
    banner.className = `status-banner banner-${tipoClase}`;
    banner.innerHTML = mensaje;
}

// ------------------------------------------
// UPDATERS PARA CADA VISTA
// ------------------------------------------

function actualizarKioscoUI() {
    // Tabla Deudores
    const tbodyDeudores = document.querySelector("#tabla-deudores tbody");
    tbodyDeudores.innerHTML = "";
    Object.entries(usuarios_db).forEach(([id, datos]) => {
        if (datos.deuda > 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${datos.nombre}</td><td class="text-danger font-weight-bold">$${datos.deuda}</td>`;
            tbodyDeudores.appendChild(tr);
        }
    });
}

function actualizarLogs() {
    const tbodyLog = document.querySelector("#tabla-log tbody");
    tbodyLog.innerHTML = "";
    activity_log.forEach(log => {
        const tr = document.createElement("tr");
        let badgeClass = "badge-blue";
        if (log.tipo === "ENTRADA") badgeClass = "badge-green";
        else if (log.tipo === "SALIDA") badgeClass = "badge-orange";
        else if (log.tipo === "SEGURIDAD") badgeClass = "badge-red";
        else if (log.tipo === "RESERVA") badgeClass = "badge-purple";
        else if (log.tipo === "PRÉSTAMO") badgeClass = "badge-blue";
        else if (log.tipo === "DEVOLUCIÓN") badgeClass = "badge-green";

        tr.innerHTML = `<td>${log.hora}</td><td><span class="badge ${badgeClass}">${log.tipo}</span></td><td>${log.detalle}</td>`;
        tbodyLog.appendChild(tr);
    });
}

function actualizarStatsUI() {
    // KPI
    const fictitiousCount = 42 + usuarios_en_biblioteca.size;
    document.getElementById("stat-alumnos").textContent = fictitiousCount;

    let librosDisponibles = Object.values(libros_db).reduce((acc, l) => acc + l.ejemplares_disponibles, 0);
    document.getElementById("stat-libros").textContent = librosDisponibles;

    const deudores = Object.values(usuarios_db).filter(u => u.deuda > 0);
    const listaMultas = document.getElementById("stat-multas-lista");
    if (deudores.length === 0) {
        listaMultas.innerHTML = "Ninguno";
    } else {
        listaMultas.innerHTML = deudores.map(u => `• ${u.nombre}`).join("<br>");
    }

    // Cubicles Visualizer
    const leftCol = document.getElementById("cubicles-left");
    const rightCol = document.getElementById("cubicles-right");
    leftCol.innerHTML = ""; rightCol.innerHTML = "";

    Object.entries(mesas_db).forEach(([id, datos]) => {
        const div = document.createElement("div");
        const isFree = datos.estado === "Disponible";
        div.className = `cubicle ${isFree ? 'free' : 'occupied'}`;
        div.innerHTML = `<div>${id}</div><small>${isFree ? 'Libre' : datos.estado}</small>`;
        if (datos.pos === "left") leftCol.appendChild(div);
        else rightCol.appendChild(div);
    });
}

function actualizarAdminUI() {
    const tbodyUsuarios = document.querySelector("#tabla-usuarios-admin tbody");
    if (!tbodyUsuarios) return;
    tbodyUsuarios.innerHTML = "";
    Object.entries(usuarios_db).forEach(([id, datos]) => {
        let prestamosTexto = "Ninguno";
        if (datos.prestamos.length > 0) {
            const now = Date.now();
            prestamosTexto = datos.prestamos.map(p => {
                const libroInfo = libros_db[p.libro] ? libros_db[p.libro].titulo : p.libro;
                const diasRestantes = Math.max(0, Math.ceil((p.fecha_vencimiento - now) / (1000 * 60 * 60 * 24)));
                const vigencia = diasRestantes > 0 ? `(${diasRestantes} días de vigencia)` : "(Vencido)";
                return `• ${libroInfo} <small class="text-muted">${vigencia}</small>`;
            }).join("<br>");
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${id}</strong></td>
            <td>${datos.nombre}</td>
            <td class="${datos.deuda > 0 ? 'text-danger font-weight-bold' : 'text-success'}">$${datos.deuda}</td>
            <td>${prestamosTexto}</td>
        `;
        tbodyUsuarios.appendChild(tr);
    });

    // Llenar dropdown de deudores
    const ddDeudores = document.getElementById("admin-dd-deudores");
    if (ddDeudores) {
        ddDeudores.innerHTML = '<option value="" disabled selected>Selecciona alumno con deuda</option>';
        Object.entries(usuarios_db).forEach(([id, datos]) => {
            if (datos.deuda > 0) {
                const opt = document.createElement("option");
                opt.value = id; opt.textContent = `${id} - ${datos.nombre} ($${datos.deuda})`;
                ddDeudores.appendChild(opt);
            }
        });
    }

    // Llenar dropdown de cubículos
    const ddCubiculos = document.getElementById("admin-dd-cubiculos");
    if (ddCubiculos) {
        ddCubiculos.innerHTML = '<option value="" disabled selected>Selecciona cubículo libre</option>';
        Object.entries(mesas_db).forEach(([id, datos]) => {
            if (datos.estado === "Disponible") {
                const opt = document.createElement("option");
                opt.value = id; opt.textContent = datos.desc;
                ddCubiculos.appendChild(opt);
            }
        });
    }
}

function renderInventory() {
    const grid = document.getElementById("inventory-grid");
    grid.innerHTML = "";

    const isAdminMode = !document.getElementById("admin-dashboard").classList.contains("hidden");

    // Sort alphabetically
    let sortedLibros = Object.values(libros_db).sort((a, b) => a.titulo.localeCompare(b.titulo));

    sortedLibros.forEach(libro => {
        // Filter Logic
        if (currentInvCategory !== "ALL" && libro.categoria !== currentInvCategory) return;
        if (currentInvSearch && !libro.titulo.toLowerCase().includes(currentInvSearch) && !libro.id.toLowerCase().includes(currentInvSearch)) return;

        const card = document.createElement("div");
        card.className = "book-card";
        if (isAdminMode) card.style.cursor = "pointer";

        let stockClass = "stock-high";
        if (libro.ejemplares_disponibles === 0) stockClass = "stock-out";
        else if (libro.ejemplares_disponibles === 1) stockClass = "stock-low";

        let stockText = libro.ejemplares_disponibles === 0 ? "Agotado" : `${libro.ejemplares_disponibles} de ${libro.ejemplares_totales} disp.`;

        card.innerHTML = `
            <div class="book-id">${libro.id}</div>
            <div class="book-cat">${libro.categoria}</div>
            <div class="book-title">${libro.titulo}</div>
            <div class="book-meta mb-2">
                <span class="book-stand"><i class="ri-map-pin-line"></i> ${libro.stand}</span>
                <span class="book-stock ${stockClass}">${stockText}</span>
            </div>
            ${isAdminMode ? '<button class="btn btn-primary mt-auto w-100" style="padding: 0.4rem; font-size: 0.8rem;"><i class="ri-check-line"></i> Seleccionar Libro</button>' : ''}
        `;
        grid.appendChild(card);
    });
}

function sincronizarTodo() {
    actualizarKioscoUI();
    actualizarLogs();
    actualizarStatsUI();
    actualizarAdminUI();
    actualizarListaInvitadosActivos();
}

// ==========================================
// 4. LÓGICA DEL KIOSCO
// ==========================================

function cerrarSesionKiosco() {
    usuario_activo = null;
    document.getElementById("panel-acciones").classList.add("hidden");
    const fotoContainer = document.getElementById("foto-container");
    if (fotoContainer) fotoContainer.classList.add("hidden");

    ignoreScans = false;
    esperandoPago = false;
    document.getElementById("status-pago").classList.add("hidden");
    document.getElementById('instrucciones-admin').classList.add('hidden');

    actualizarStatusBanner(`<h3><i class="ri-scan-2-line"></i> Pase por QR / Código de Barras</h3><p>Esperando escaneo de credencial...</p>`, "default");
    sincronizarTodo();
}

function procesarAccesoKiosco(qr_data) {
    if (usuario_activo) {
        // Validación Admin para pagar
        const reverso = usuario_activo.split('').reverse().join('');
        if (qr_data === reverso) {
            if (!esperandoPago) return;
            if (usuarios_db[usuario_activo].deuda > 0) {
                usuarios_db[usuario_activo].deuda = 0;
                esperandoPago = false;
                document.getElementById('instrucciones-admin').classList.add('hidden');
                document.getElementById('status-pago').classList.add('hidden');
                actualizarStatusBanner(`<h3><i class="ri-check-line"></i> ¡Adeudo Pagado!</h3><p>Tu cuenta ha sido liberada.</p>`, "green");
                registrarLog("PAGO", `${usuarios_db[usuario_activo].nombre} liquidó su adeudo.`);

                sincronizarTodo();
                if (logoutTimer) clearTimeout(logoutTimer);
                logoutTimer = setTimeout(cerrarSesionKiosco, 3000);
            }
        }
        return;
    }

    if (usuarios_db.hasOwnProperty(qr_data)) {
        if (usuarios_db[qr_data].deuda > 0) {
            usuario_activo = qr_data;
            playAnnoyingBeep();
            actualizarStatusBanner(`
                <h3><i class="ri-error-warning-line"></i> ACCESO BLOQUEADO</h3>
                <p>Deuda activa de $${usuarios_db[qr_data].deuda}. Pase a pagar a administración.</p>
            `, "red");
            document.getElementById('instrucciones-admin').classList.remove('hidden');
            ignoreScans = true;
            esperandoPago = false;

            document.getElementById("panel-acciones").classList.remove("hidden");
            sincronizarTodo();
            return;
        }

        const nombre = usuarios_db[qr_data].nombre;
        let estadoAcceso = "";

        // AUTO ENTRADA / SALIDA
        if (usuarios_en_biblioteca.has(qr_data)) {
            usuarios_en_biblioteca.delete(qr_data);
            registrarLog("SALIDA", `${nombre} salió.`);
            estadoAcceso = "Salida registrada. ¡Hasta pronto!";
            actualizarStatusBanner(`<h3>¡Hasta pronto ${nombre}!</h3><p>${estadoAcceso}</p>`, "orange");
        } else {
            usuarios_en_biblioteca.add(qr_data);
            registrarLog("ENTRADA", `${nombre} entró.`);
            estadoAcceso = "Entrada registrada. ¡Bienvenido!";
            actualizarStatusBanner(`<h3>¡Hola ${nombre}!</h3><p>${estadoAcceso}</p>`, "green");
        }

        playSuccessBeep();

        // Mostrar foto si es Salvador o Neto
        const fotoContainer = document.getElementById("foto-container");
        const fotoImg = document.getElementById("foto-alumno");

        // Evitar loops infinitos de error
        fotoImg.onerror = null;

        if (qr_data === "23070526") {
            fotoImg.src = "salvador.jpg";
            fotoImg.onerror = function () { this.onerror = null; this.src = "salvador.png"; };
            fotoContainer.classList.remove("hidden");
        } else if (qr_data === "23070504") {
            fotoImg.src = "neto.jpg";
            fotoImg.onerror = function () { this.onerror = null; this.src = "neto.png"; };
            fotoContainer.classList.remove("hidden");
        } else {
            fotoContainer.classList.add("hidden");
        }

        document.getElementById("panel-acciones").classList.remove("hidden");
        ignoreScans = true;
        sincronizarTodo();
        if (logoutTimer) clearTimeout(logoutTimer);
        logoutTimer = setTimeout(cerrarSesionKiosco, 5000);
    } else {
        actualizarStatusBanner(`<h3><i class="ri-error-warning-fill"></i> CÓDIGO INVÁLIDO</h3>`, "red");
        registrarLog("SEGURIDAD", "Intento de escaneo no reconocido.");
        playAnnoyingBeep();
        ignoreScans = true;
        if (logoutTimer) clearTimeout(logoutTimer);
        logoutTimer = setTimeout(cerrarSesionKiosco, 2000);
    }
}



document.getElementById("btn-activar-pago")?.addEventListener("click", () => {
    esperandoPago = true;
    ignoreScans = false;
    document.getElementById("status-pago").classList.remove("hidden");
});

// Presets
document.querySelectorAll(".btn-preset").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.querySelectorAll(".btn-preset").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        selectedPreset = e.target.getAttribute("data-time");
    });
});

// Scanner Initialization
function onScanSuccess(decodedText) {
    if (scanLock || ignoreScans) return;
    scanLock = true; setTimeout(() => { scanLock = false; }, 3000);
    procesarAccesoKiosco(decodedText);
}

function initCamera() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => startCam()).catch(() => startCam());
    } else {
        html5QrCode = new window.Html5Qrcode("reader");
        startCam();
    }
}

function startCam() {
    html5QrCode.start(
        { facingMode: currentFacingMode },
        { fps: 10, qrbox: { width: 300, height: 150 } },
        onScanSuccess,
        () => { } // ignore errors
    ).catch(err => {
        console.warn("Fallo cámara", currentFacingMode);
        if (currentFacingMode === "environment") {
            currentFacingMode = "user"; // fallback once
            startCam();
        }
    });
}

document.getElementById("btn-toggle-cam").addEventListener("click", () => {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    initCamera();
});


// ==========================================
// 5. LÓGICA DEL ADMIN DASHBOARD
// ==========================================
document.getElementById("btn-admin-login").addEventListener("click", () => {
    const usr = document.getElementById("admin-user").value;
    const pass = document.getElementById("admin-pass").value;
    if (usr === "admin" && pass === "admin") {
        document.getElementById("admin-login-screen").classList.add("hidden");
        document.getElementById("admin-dashboard").classList.remove("hidden");
        sincronizarTodo();
    } else {
        document.getElementById("admin-error").classList.remove("hidden");
    }
});

document.getElementById("btn-admin-logout").addEventListener("click", () => {
    document.getElementById("admin-dashboard").classList.add("hidden");
    document.getElementById("admin-login-screen").classList.remove("hidden");
    document.getElementById("admin-user").value = "";
    document.getElementById("admin-pass").value = "";
});

document.getElementById("btn-admin-inventory").addEventListener("click", () => {
    document.getElementById("modal-inventory").classList.remove("hidden");
    renderInventory(); // Re-render to ensure admin 'select' buttons show up
});

document.getElementById("btn-admin-prestar").addEventListener("click", () => {
    const alumnoId = document.getElementById("admin-input-alumno").value.trim();
    const libroId = document.getElementById("admin-input-libro").value.trim();
    const dias = parseInt(document.getElementById("admin-input-dias").value);

    if (!usuarios_db[alumnoId]) { alert("Alumno no encontrado"); return; }
    if (!libros_db[libroId] || libros_db[libroId].ejemplares_disponibles < 1) { alert("Libro no válido o sin stock"); return; }

    libros_db[libroId].ejemplares_disponibles -= 1;
    usuarios_db[alumnoId].prestamos.push({
        libro: libroId,
        fecha_vencimiento: Date.now() + (dias * 24 * 60 * 60 * 1000)
    });

    registrarLog("PRÉSTAMO", `(ADMIN) asignó ${libros_db[libroId].titulo} a ${usuarios_db[alumnoId].nombre}`);
    alert("Préstamo manual procesado con éxito.");
    document.getElementById("admin-input-alumno").value = "";
    document.getElementById("admin-input-libro").value = "";
    sincronizarTodo();
});

document.getElementById("btn-admin-liberar")?.addEventListener("click", () => {
    const alumnoId = document.getElementById("admin-dd-deudores").value;
    if (!alumnoId) { alert("Selecciona a un alumno."); return; }

    usuarios_db[alumnoId].deuda = 0;
    registrarLog("PAGO", `(ADMIN) liberó la deuda de ${usuarios_db[alumnoId].nombre}`);
    alert(`La deuda de ${usuarios_db[alumnoId].nombre} ha sido borrada.`);
    sincronizarTodo();
});

document.getElementById("btn-admin-asignar-cub")?.addEventListener("click", () => {
    const alumnoId = document.getElementById("admin-input-cub-alumno").value.trim();
    const mesaId = document.getElementById("admin-dd-cubiculos").value;

    if (!usuarios_db[alumnoId]) { alert("Alumno no encontrado"); return; }
    if (!mesaId) { alert("Selecciona un cubículo"); return; }

    if (usuarios_db[alumnoId].mesa_activa !== null) {
        alert("El alumno ya tiene un cubículo asignado."); return;
    }

    mesas_db[mesaId].estado = `Ocupado por: ${usuarios_db[alumnoId].nombre}`;
    usuarios_db[alumnoId].mesa_activa = mesaId;

    registrarLog("RESERVA", `(ADMIN) asignó ${mesas_db[mesaId].desc} a ${usuarios_db[alumnoId].nombre}`);
    alert("Cubículo asignado con éxito.");
    document.getElementById("admin-input-cub-alumno").value = "";
    sincronizarTodo();
});


// ==========================================
// 6. INVENTORY MODAL LOGIC
// ==========================================
document.querySelectorAll(".btn-open-inventory").forEach(btn => {
    btn.addEventListener("click", () => {
        document.getElementById("modal-inventory").classList.remove("hidden");
    });
});
document.getElementById("btn-close-inventory").addEventListener("click", () => {
    document.getElementById("modal-inventory").classList.add("hidden");
});

// Llenar filtro de categorías
const selectCat = document.getElementById("inv-category");
categorias_libros.forEach(c => {
    const opt = document.createElement("option"); opt.value = c; opt.textContent = c;
    selectCat.appendChild(opt);
});

selectCat.addEventListener("change", (e) => { currentInvCategory = e.target.value; renderInventory(); });
document.getElementById("inv-search").addEventListener("input", (e) => { currentInvSearch = e.target.value.toLowerCase(); renderInventory(); });

// Global delegate to select a book from inventory to the admin panel
document.getElementById("inventory-grid").addEventListener("click", (e) => {
    const card = e.target.closest(".book-card");
    if (!card) return;
    const bookId = card.querySelector(".book-id").textContent;
    // Si el panel de admin está visible, lo auto-completamos
    if (!document.getElementById("admin-dashboard").classList.contains("hidden")) {
        document.getElementById("admin-input-libro").value = bookId;
        document.getElementById("modal-inventory").classList.add("hidden");
    }
});


// ==========================================
// 7. ROUTING & LOOP
// ==========================================
document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
        const targetId = btn.getAttribute("data-target");
        document.getElementById(targetId).classList.add("active-view");

        if (targetId === "view-stats" && !chartHoras) inicializarGrafica();
    });
});

function inicializarGrafica() {
    const ctx = document.getElementById('chart-horas').getContext('2d');
    chartHoras = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
            datasets: [{
                label: 'Interacciones',
                data: [15, 45, 80, 110, 60, 30],
                borderColor: '#4318ff', backgroundColor: 'rgba(67, 24, 255, 0.1)', borderWidth: 3, fill: true, tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

// Loop Check para Deudas (cada 1s)
setInterval(() => {
    let changed = false;
    const now = Date.now();
    Object.entries(usuarios_db).forEach(([id, user]) => {
        if (user.prestamos && user.prestamos.length > 0) {
            user.prestamos.forEach(p => {
                if (p.fecha_vencimiento < now && user.deuda === 0) {
                    user.deuda = 50;
                    playAnnoyingBeep();
                    registrarLog("MULTA", `Adeudo automático para ${user.nombre}.`);
                    changed = true;
                    if (usuario_activo === id) {
                        actualizarStatusBanner(`<h3>PRÉSTAMO VENCIDO</h3><p>Adeudo de $50 pesos aplicado.</p>`, "red");
                        document.getElementById('instrucciones-admin').classList.remove('hidden');
                        ignoreScans = true;
                    }
                }
            });
        }
    });
    if (changed) sincronizarTodo();
}, 1000);

// ==========================================
// 8. LÓGICA DE INVITADOS (GUESTS)
// ==========================================
let streamInvitado = null;
let fotoDataInvitado = null;

const btnIniciarCamara = document.getElementById("btn-admin-iniciar-camara");
const btnTomarFoto = document.getElementById("btn-admin-tomar-foto");
const btnRegistrarInvitado = document.getElementById("btn-admin-registrar-invitado");
const videoContainer = document.getElementById("invitado-camera-container");
const videoElement = document.getElementById("invitado-video");
const timerElement = document.getElementById("invitado-timer");
const canvasElement = document.getElementById("invitado-canvas");
const fotoResultContainer = document.getElementById("invitado-foto-result");
const fotoResultImg = document.getElementById("invitado-foto-img");
const inputNombreInvitado = document.getElementById("admin-input-invitado");

function validarRegistroInvitado() {
    if (!btnRegistrarInvitado) return;
    if (inputNombreInvitado && inputNombreInvitado.value.trim() !== "" && fotoDataInvitado) {
        btnRegistrarInvitado.disabled = false;
    } else {
        btnRegistrarInvitado.disabled = true;
    }
}

inputNombreInvitado?.addEventListener("input", validarRegistroInvitado);

btnIniciarCamara?.addEventListener("click", async () => {
    try {
        streamInvitado = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = streamInvitado;
        videoContainer.style.display = "block";
        fotoResultContainer.classList.add("hidden");
        fotoDataInvitado = null;
        validarRegistroInvitado();

        btnIniciarCamara.classList.add("hidden");
        btnTomarFoto.classList.remove("hidden");
    } catch (err) {
        alert("Error al acceder a la cámara: " + err.message);
    }
});

btnTomarFoto?.addEventListener("click", () => {
    let count = 3;
    timerElement.style.display = "block";
    timerElement.textContent = count;
    btnTomarFoto.disabled = true;

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            timerElement.textContent = count;
        } else {
            clearInterval(interval);
            timerElement.style.display = "none";
            btnTomarFoto.disabled = false;

            // Tomar foto
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
            const ctx = canvasElement.getContext("2d");
            ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            fotoDataInvitado = canvasElement.toDataURL("image/png");

            // Detener camara
            if (streamInvitado) {
                streamInvitado.getTracks().forEach(track => track.stop());
            }

            // UI
            videoContainer.style.display = "none";
            fotoResultImg.src = fotoDataInvitado;
            fotoResultContainer.classList.remove("hidden");

            btnIniciarCamara.classList.remove("hidden");
            btnIniciarCamara.innerHTML = '<i class="ri-camera-line"></i> Retomar Foto';
            btnTomarFoto.classList.add("hidden");

            validarRegistroInvitado();
        }
    }, 1000);
});

btnRegistrarInvitado?.addEventListener("click", () => {
    const nombre = inputNombreInvitado.value.trim();
    if (!nombre || !fotoDataInvitado) return;

    const invitadoId = `INV-${Date.now()}`;

    usuarios_db[invitadoId] = {
        nombre: `${nombre} (Invitado)`,
        carrera: "Externa",
        mesa_activa: null,
        deuda: 0,
        prestamos: [],
        foto: fotoDataInvitado
    };

    usuarios_en_biblioteca.add(invitadoId);
    registrarLog("ENTRADA", `Invitado físico: ${nombre}`);

    alert(`Entrada registrada para el invitado: ${nombre}`);

    // Limpiar formulario
    inputNombreInvitado.value = "";
    fotoDataInvitado = null;
    fotoResultContainer.classList.add("hidden");
    btnRegistrarInvitado.disabled = true;
    btnIniciarCamara.innerHTML = '<i class="ri-camera-line"></i> Encender Cámara';

    sincronizarTodo();
    actualizarListaInvitadosActivos();
});

function actualizarListaInvitadosActivos() {
    const contenedor = document.getElementById("lista-invitados-activos");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    // Buscar invitados en la base de datos que estén en usuarios_en_biblioteca
    const invitadosActivos = Array.from(usuarios_en_biblioteca)
        .filter(id => id.startsWith("INV-"))
        .map(id => ({ id, ...usuarios_db[id] }));

    if (invitadosActivos.length === 0) {
        contenedor.innerHTML = '<p class="text-muted w-100 text-center mt-3"><i class="ri-information-line"></i> No hay invitados activos.</p>';
        return;
    }

    invitadosActivos.forEach(inv => {
        const card = document.createElement("div");
        card.style.cssText = "background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; width: 140px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;";

        card.innerHTML = `
            <img src="${inv.foto}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">
            <p style="font-weight: 600; font-size: 0.9rem; margin: 0; line-height: 1.2;">${inv.nombre.replace(" (Invitado)", "")}</p>
            <button class="btn btn-danger btn-sm w-100" style="padding: 4px; font-size: 0.8rem;" onclick="registrarSalidaInvitado('${inv.id}')">Dar Salida</button>
        `;
        contenedor.appendChild(card);
    });
}

window.registrarSalidaInvitado = function (id) {
    if (usuarios_en_biblioteca.has(id)) {
        usuarios_en_biblioteca.delete(id);
        registrarLog("SALIDA", `${usuarios_db[id].nombre} salió.`);
        sincronizarTodo();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    sincronizarTodo();
    renderInventory();
    inicializarGrafica(); // Auto-initialize chart since we start in Stats
    actualizarListaInvitadosActivos();
    setTimeout(initCamera, 500);
});
