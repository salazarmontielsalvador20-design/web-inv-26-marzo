// ==========================================
// 1. DATA BASE SIMULADA
// ==========================================
const usuarios_db = {
    "23070526": { nombre: "Salvador (Admin)", carrera: "Ing. Sistemas", mesa_activa: null, deuda: 0, prestamos: [] },
    "23070504": { nombre: "Maria Gonzalez", carrera: "Ing. Industrial", mesa_activa: null, deuda: 0, prestamos: [] },
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
for(let i=1; i<=50; i++) {
    const cat = categorias_libros[i % categorias_libros.length];
    const pref = prefijos[i % prefijos.length];
    const id = `LIB-${i.toString().padStart(3, '0')}`;
    const standRow = ['A', 'B', 'C', 'D', 'E'][i % 5];
    const standCol = Math.ceil(i/10);
    
    libros_db[id] = {
        id: id,
        titulo: `${pref} ${cat} Vol. ${Math.ceil(i/7)}`,
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
    } catch(e) {}
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
    // Dropdown Libros
    if(usuario_activo) {
        const ddLibros = document.getElementById("dd-libros");
        ddLibros.innerHTML = '<option value="" disabled selected>1. Selecciona un libro disponible</option>';
        Object.entries(libros_db).forEach(([id, datos]) => {
            if (datos.ejemplares_disponibles > 0) {
                const opt = document.createElement("option");
                opt.value = id; opt.textContent = `${datos.titulo} (Disp: ${datos.ejemplares_disponibles})`;
                ddLibros.appendChild(opt);
            }
        });

        const ddMisLibros = document.getElementById("dd-mis-libros");
        ddMisLibros.innerHTML = '<option value="" disabled selected>1. Selecciona un libro tuyo</option>';
        if (usuarios_db[usuario_activo].prestamos && usuarios_db[usuario_activo].prestamos.length > 0) {
            usuarios_db[usuario_activo].prestamos.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.libro; opt.textContent = libros_db[p.libro] ? libros_db[p.libro].titulo : p.libro;
                ddMisLibros.appendChild(opt);
            });
        }

        const ddMesas = document.getElementById("dd-mesas");
        ddMesas.innerHTML = '<option value="" disabled selected>1. Selecciona un cubículo libre</option>';
        Object.entries(mesas_db).forEach(([id, datos]) => {
            if (datos.estado === "Disponible") {
                const opt = document.createElement("option");
                opt.value = id; opt.textContent = datos.desc;
                ddMesas.appendChild(opt);
            }
        });
    }

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
    if(!tbodyUsuarios) return;
    tbodyUsuarios.innerHTML = "";
    Object.entries(usuarios_db).forEach(([id, datos]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${id}</strong></td>
            <td>${datos.nombre}</td>
            <td class="${datos.deuda > 0 ? 'text-danger font-weight-bold' : 'text-success'}">$${datos.deuda}</td>
            <td>${datos.prestamos.length} libros</td>
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
    let sortedLibros = Object.values(libros_db).sort((a,b) => a.titulo.localeCompare(b.titulo));
    
    sortedLibros.forEach(libro => {
        // Filter Logic
        if(currentInvCategory !== "ALL" && libro.categoria !== currentInvCategory) return;
        if(currentInvSearch && !libro.titulo.toLowerCase().includes(currentInvSearch) && !libro.id.toLowerCase().includes(currentInvSearch)) return;

        const card = document.createElement("div");
        card.className = "book-card";
        if (isAdminMode) card.style.cursor = "pointer";
        
        let stockClass = "stock-high";
        if(libro.ejemplares_disponibles === 0) stockClass = "stock-out";
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
}

// ==========================================
// 4. LÓGICA DEL KIOSCO
// ==========================================

function cerrarSesionKiosco() {
    usuario_activo = null;
    document.getElementById("panel-acciones").classList.add("hidden");
    ignoreScans = false;
    esperandoPago = false;
    document.getElementById("status-pago").classList.add("hidden");
    document.getElementById('instrucciones-admin').classList.add('hidden');
    
    const btns = ["btn-entrar-salir", "btn-prestar", "btn-devolver", "btn-reservar"];
    btns.forEach(id => document.getElementById(id).disabled = false);

    actualizarStatusBanner(`<h3><i class="ri-scan-2-line"></i> Pase por QR</h3><p>Esperando escaneo de credencial...</p>`, "default");
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
                
                ["btn-entrar-salir", "btn-prestar", "btn-devolver", "btn-reservar"].forEach(id => document.getElementById(id).disabled = false);
                sincronizarTodo();
            }
        }
        return; 
    }

    if (usuarios_db.hasOwnProperty(qr_data)) {
        usuario_activo = qr_data;
        if (usuarios_db[qr_data].deuda > 0) {
            playAnnoyingBeep();
            actualizarStatusBanner(`
                <h3><i class="ri-error-warning-line"></i> ACCESO BLOQUEADO</h3>
                <p>Deuda activa de $${usuarios_db[qr_data].deuda}. Pase a pagar a administración.</p>
            `, "red");
            document.getElementById('instrucciones-admin').classList.remove('hidden');
            ignoreScans = true; 
            esperandoPago = false;
            
            document.getElementById("panel-acciones").classList.remove("hidden");
            document.getElementById("btn-entrar-salir").disabled = true;
            document.getElementById("btn-prestar").disabled = true;
            document.getElementById("btn-devolver").disabled = false;
            document.getElementById("btn-reservar").disabled = true;
            sincronizarTodo();
            return;
        }

        const nombre = usuarios_db[qr_data].nombre;
        const estadoAcceso = usuarios_en_biblioteca.has(qr_data) ? "Adentro" : "Afuera";
        actualizarStatusBanner(`<h3>¡Hola ${nombre}!</h3><p>Estado: ${estadoAcceso}. ¿Qué deseas hacer hoy?</p>`, "blue");
        
        document.getElementById("panel-acciones").classList.remove("hidden");
        ignoreScans = true;
        sincronizarTodo();
        if (logoutTimer) clearTimeout(logoutTimer);
    } else {
        actualizarStatusBanner(`<h3><i class="ri-error-warning-fill"></i> CÓDIGO INVÁLIDO</h3>`, "red");
        registrarLog("SEGURIDAD", "Intento de escaneo no reconocido.");
        playAnnoyingBeep();
        ignoreScans = true;
        if (logoutTimer) clearTimeout(logoutTimer);
        logoutTimer = setTimeout(cerrarSesionKiosco, 2000);
    }
}

// Botones Kiosco
document.getElementById("btn-entrar-salir").addEventListener("click", () => {
    if (!usuario_activo) return;
    const nombre = usuarios_db[usuario_activo].nombre;
    if (usuarios_en_biblioteca.has(usuario_activo)) {
        usuarios_en_biblioteca.delete(usuario_activo);
        registrarLog("SALIDA", `${nombre} salió.`);
        actualizarStatusBanner(`<h3>¡Hasta pronto!</h3><p>Salida registrada para ${nombre}.</p>`, "orange");
    } else {
        usuarios_en_biblioteca.add(usuario_activo);
        registrarLog("ENTRADA", `${nombre} entró.`);
        actualizarStatusBanner(`<h3>¡Bienvenido!</h3><p>Entrada registrada para ${nombre}.</p>`, "green");
    }
    sincronizarTodo();
    if (logoutTimer) clearTimeout(logoutTimer);
    logoutTimer = setTimeout(cerrarSesionKiosco, 2000);
});

document.getElementById("btn-prestar").addEventListener("click", () => {
    const libroId = document.getElementById("dd-libros").value;
    if (!libroId) return;

    libros_db[libroId].ejemplares_disponibles -= 1;
    let duracionMs = 0;
    if (selectedPreset === "20s") duracionMs = 20 * 1000;
    else if (selectedPreset === "2h") duracionMs = 2 * 60 * 60 * 1000;
    else if (selectedPreset === "2d") duracionMs = 2 * 24 * 60 * 60 * 1000;
    
    usuarios_db[usuario_activo].prestamos.push({
        libro: libroId,
        fecha_vencimiento: Date.now() + duracionMs
    });

    registrarLog("PRÉSTAMO", `${usuarios_db[usuario_activo].nombre} pidió ${libros_db[libroId].titulo}`);
    actualizarStatusBanner(`<h3>¡Préstamo Asignado!</h3><p>No olvides regresarlo a tiempo.</p>`, "blue");
    sincronizarTodo();
});

document.getElementById("btn-devolver").addEventListener("click", () => {
    const libroId = document.getElementById("dd-mis-libros").value;
    if (!libroId) return;

    usuarios_db[usuario_activo].prestamos = usuarios_db[usuario_activo].prestamos.filter(p => p.libro !== libroId);
    libros_db[libroId].ejemplares_disponibles += 1;

    registrarLog("DEVOLUCIÓN", `${usuarios_db[usuario_activo].nombre} devolvió ${libros_db[libroId].titulo}`);
    actualizarStatusBanner(`<h3>¡Devuelto!</h3><p>Gracias por tu puntualidad.</p>`, "green");
    sincronizarTodo();
});

document.getElementById("btn-reservar").addEventListener("click", () => {
    const mesaId = document.getElementById("dd-mesas").value;
    if (!mesaId) return;
    if (usuarios_db[usuario_activo].mesa_activa !== null) {
        actualizarStatusBanner(`<h3>Límite</h3><p>Ya tienes un cubículo asignado.</p>`, "red");
        return;
    }
    mesas_db[mesaId].estado = `Ocupado por: ${usuarios_db[usuario_activo].nombre}`;
    usuarios_db[usuario_activo].mesa_activa = mesaId;
    registrarLog("RESERVA", `${usuarios_db[usuario_activo].nombre} reservó ${mesas_db[mesaId].desc}`);
    actualizarStatusBanner(`<h3>¡Reserva Exitosa!</h3>`, "purple");
    sincronizarTodo();
});

document.getElementById("btn-cerrar").addEventListener("click", cerrarSesionKiosco);

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
    if(html5QrCode) {
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
        () => {} // ignore errors
    ).catch(err => {
        console.warn("Fallo cámara", currentFacingMode);
        if(currentFacingMode === "environment") {
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
    if(usr === "admin" && pass === "admin") {
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
    
    if(!usuarios_db[alumnoId]) { alert("Alumno no encontrado"); return; }
    if(!libros_db[libroId] || libros_db[libroId].ejemplares_disponibles < 1) { alert("Libro no válido o sin stock"); return; }
    
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
    
    if(!usuarios_db[alumnoId]) { alert("Alumno no encontrado"); return; }
    if(!mesaId) { alert("Selecciona un cubículo"); return; }
    
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
    if(!card) return;
    const bookId = card.querySelector(".book-id").textContent;
    // Si el panel de admin está visible, lo auto-completamos
    if(!document.getElementById("admin-dashboard").classList.contains("hidden")) {
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
        
        if(targetId === "view-stats" && !chartHoras) inicializarGrafica();
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
                        ["btn-entrar-salir", "btn-prestar", "btn-reservar"].forEach(btnId => document.getElementById(btnId).disabled = true);
                        ignoreScans = true;
                    }
                }
            });
        }
    });
    if (changed) sincronizarTodo();
}, 1000);

document.addEventListener("DOMContentLoaded", () => {
    sincronizarTodo();
    renderInventory();
    inicializarGrafica(); // Auto-initialize chart since we start in Stats
    setTimeout(initCamera, 500);
});
