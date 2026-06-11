/**
 * Cloud Functions: Ticket Free / Festi
 *
 * Flujo de pago por transferencia manual (Nequi / BRE-B):
 *   - submitTransferOrder: el comprador (autenticado) sube su comprobante y
 *     crea un pedido (ticket) en estado "sin_validar".
 *   - El dueño del evento verifica la transferencia y lo pasa a "pagado".
 *   - requestQrTransfer / acceptQrTransfer: transferir QRs entre usuarios.
 *   - syncTicketQrs (trigger RTDB): mantiene el índice userQrs para "Mis entradas".
 *   - resendTicketQrEmail: reenvía el QR por correo (Resend, opcional).
 *
 * Variables (functions/.env en local; Cloud Run en producción):
 *   RESEND_API_KEY  — API key de Resend (correo con QR; opcional)
 *   RESEND_FROM     — Remitente verificado, ej. "Festi <entradas@tudominio.com>"
 */
const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch (_) {
  /* dotenv opcional */
}

const { onRequest } = require("firebase-functions/v2/https");
const { onValueWritten } = require("firebase-functions/v2/database");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const QRCode = require("qrcode");

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : "";
}

function generateSecureCode() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}-${random2}`.toUpperCase();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailToKey(email) {
  return normalizeEmail(email).replace(/[.#$/[\]@]/g, "_");
}

/** Clave válida para usar un código QR como clave de nodo en RTDB. */
function codeToKey(code) {
  return String(code || "").replace(/[.#$/[\]]/g, "_");
}

/** Lista de códigos de un ticket (normaliza secureCodes objeto/array). */
function getTicketSecureCodes(ticket) {
  if (!ticket) return [];
  let raw = ticket.secureCodes;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    raw = Object.keys(raw)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => raw[k]);
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((c) => String(c).trim()).filter(Boolean);
  }
  if (ticket.secureCode) return [String(ticket.secureCode).trim()].filter(Boolean);
  return [];
}

function collaboratorKeyFromEmail(email) {
  return String(email || "").replace(/[@.]/g, "_");
}

/** Dueño del evento o colaborador registrado. */
async function canAccessEventTickets(uid, email, ownerUid, discotecaId, eventoId) {
  if (!uid || !ownerUid || !discotecaId || !eventoId) return false;
  if (uid === ownerUid) return true;
  const key = collaboratorKeyFromEmail(email);
  if (!key) return false;
  const snap = await db
    .ref(`users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/colaboradores/${key}`)
    .get();
  return snap.exists();
}

async function verifyAuth(req) {
  const authHeader = String(req.headers.authorization || "");
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    return await admin.auth().verifyIdToken(m[1]);
  } catch (_) {
    return null;
  }
}

// ===================== CORREO (Resend, opcional) =====================

async function qrPngBase64(secureCode) {
  const buf = await QRCode.toBuffer(String(secureCode), { type: "png", width: 320, margin: 2 });
  return buf.toString("base64");
}

function normalizeSecureCodes(opts) {
  if (Array.isArray(opts.secureCodes) && opts.secureCodes.length > 0) {
    return opts.secureCodes.map((c) => String(c).trim()).filter(Boolean);
  }
  const one = String(opts.secureCode || "").trim();
  return one ? [one] : [];
}

async function sendTicketQrEmailResend(opts) {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return { sent: false, reason: "no_api_key" };

  const from = env("RESEND_FROM") || "Festi <onboarding@resend.dev>";
  const to = String(opts.to || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { sent: false, reason: "invalid_email" };
  }

  const codes = normalizeSecureCodes(opts);
  if (!codes.length) return { sent: false, reason: "no_code" };

  const nombreEvento = opts.nombreEvento || "Tu evento";
  const nombreDiscoteca = opts.nombreDiscoteca || "";
  const fecha = opts.fecha || "";
  const nombreCliente = opts.nombreCliente || "";
  const tipoEntrada = opts.tipoEntrada || "General";
  const cantidad = codes.length;

  const imgW = codes.length > 15 ? 180 : codes.length > 8 ? 220 : 260;
  const blocks = [];
  const attachments = [];
  const maxAttachments = 100;

  for (let i = 0; i < codes.length; i++) {
    const qrB64 = await qrPngBase64(codes[i]);
    const n = i + 1;
    const cid = `tf-entrada-${n}`;
    blocks.push(
      `<p style="margin:14px 0 6px;"><strong>Entrada ${n} de ${codes.length}</strong></p><p><img src="cid:${cid}" alt="QR entrada ${n}" width="${imgW}" height="${imgW}" style="display:block;border:1px solid #eee;border-radius:8px;"/></p>`
    );
    if (attachments.length < maxAttachments) {
      attachments.push({
        filename: `entrada-${String(n).padStart(2, "0")}.png`,
        content: qrB64,
        content_id: cid,
        content_type: "image/png",
      });
    }
  }

  const subject =
    codes.length === 1 ? `Tu entrada — ${nombreEvento}` : `Tus ${codes.length} entradas — ${nombreEvento}`;
  const intro =
    codes.length === 1
      ? "Presenta este código QR en la entrada."
      : `Cada QR es una entrada distinta (${codes.length} en total). Presenta cada uno en la puerta.`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#222;max-width:520px;">
  <h1 style="font-size:1.25rem;">¡Listo, ${nombreCliente || "comprador"}!</h1>
  <p>${intro}</p>
  <p><strong>${nombreEvento}</strong>${nombreDiscoteca ? ` · ${nombreDiscoteca}` : ""}${fecha ? `<br/>📅 ${fecha}` : ""}</p>
  <p>Tipo: ${tipoEntrada} · Entradas: ${cantidad}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>
  ${blocks.join("")}
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, attachments }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    let resendMessage = "";
    if (typeof body.message === "string") resendMessage = body.message;
    else if (Array.isArray(body.message)) {
      resendMessage = body.message
        .map((m) => (typeof m === "object" && m?.message ? m.message : String(m)))
        .filter(Boolean)
        .join("; ");
    } else if (body.error) resendMessage = String(body.error);
    return { sent: false, reason: "resend_http", resendStatus: res.status, resendMessage };
  }
  return { sent: true };
}

// ===================== COMPRA POR TRANSFERENCIA =====================

exports.submitTransferOrder = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const decoded = await verifyAuth(req);
  if (!decoded) {
    res.status(401).json({ error: "Debes iniciar sesión para comprar" });
    return;
  }

  const {
    ownerUid,
    discotecaId,
    eventoId,
    cantidad,
    nombre,
    cedula,
    email,
    telefono,
    comprobantePath,
    comprobanteUrl,
    esColaborador,
  } = req.body || {};

  if (!ownerUid || !discotecaId || !eventoId || !nombre || !cedula || !email || !telefono) {
    res.status(400).json({ error: "Faltan datos obligatorios (nombre, cédula, correo, teléfono)" });
    return;
  }
  if (!comprobantePath || !comprobanteUrl) {
    res.status(400).json({ error: "Falta el comprobante de la transferencia" });
    return;
  }

  const snap = await db.ref(`publicEvents/${ownerUid}/${discotecaId}/${eventoId}`).get();
  if (!snap.exists() || !snap.val().enabled) {
    res.status(400).json({ error: "Este evento no está disponible para compra" });
    return;
  }
  const pub = snap.val();
  const unitCOP = parseInt(pub.precioPorEntradaCOP, 10);
  if (!Number.isFinite(unitCOP) || unitCOP < 100) {
    res.status(400).json({ error: "Precio inválido en la página del evento" });
    return;
  }

  let qty = parseInt(cantidad, 10);
  if (!Number.isFinite(qty) || qty < 1) qty = 1;
  if (qty > 20) qty = 20;

  const holderEmail = normalizeEmail(email);
  const totalCOP = unitCOP * qty;

  const seen = new Set();
  const secureCodes = [];
  while (secureCodes.length < qty) {
    const c = generateSecureCode();
    if (!seen.has(c)) {
      seen.add(c);
      secureCodes.push(c);
    }
  }
  const codeHolders = {};
  for (const c of secureCodes) codeHolders[c] = holderEmail;

  const ticketsRef = db.ref(`users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`);
  const ticketRef = ticketsRef.push();
  const ticketId = ticketRef.key;

  const nombreEvento = (pub.nombreEvento || "Evento").substring(0, 200);
  const nombreDiscoteca = (pub.nombreDiscoteca || "").substring(0, 200);
  const fecha = (pub.fecha || "").substring(0, 120);
  const ubicacion = (pub.ubicacion || "").substring(0, 200);

  const ticket = {
    id: ticketId,
    secureCode: secureCodes[0],
    secureCodes,
    nombreCliente: String(nombre).trim().substring(0, 120),
    cedula: String(cedula).trim().substring(0, 30),
    telefono: String(telefono).trim().substring(0, 30),
    emailCliente: holderEmail.substring(0, 120),
    tipoEntrada: (pub.tipoEntrada || "General").substring(0, 80),
    precio: `${totalCOP} COP (transferencia)`,
    cantidadBoletas: qty,
    estado: "sin_validar",
    fuentePago: "transferencia",
    comprobanteUrl: String(comprobanteUrl).substring(0, 1000),
    comprobantePath: String(comprobantePath).substring(0, 500),
    compradorUid: decoded.uid,
    compradorEmail: normalizeEmail(decoded.email),
    vendidoPorColaborador: !!esColaborador,
    codeHolders,
    nombreEvento,
    eventoNombre: nombreEvento,
    fecha,
    ubicacion,
    nombreDiscoteca,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await ticketRef.set(ticket);

  // Registro del comprobante para las galerías (admin y dueño).
  await db.ref(`comprobantes/${ownerUid}/${ticketId}`).set({
    url: ticket.comprobanteUrl,
    path: ticket.comprobantePath,
    ticketId,
    ownerUid,
    discotecaId,
    eventoId,
    nombreEvento,
    cliente: ticket.nombreCliente,
    cedula: ticket.cedula,
    monto: totalCOP,
    createdAt: Date.now(),
  });

  // Bitácora
  const logRef = db.ref(`users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/bitacora`).push();
  await logRef.set({
    id: logRef.key,
    accion: "ticket_creado",
    usuario: {
      uid: decoded.uid,
      email: normalizeEmail(decoded.email),
      nombre: ticket.nombreCliente,
    },
    timestamp: Date.now(),
    fecha: new Date().toLocaleString("es-CO"),
    detalles: {
      ticketId,
      ticketCode: secureCodes[0].substring(0, 12),
      cliente: ticket.nombreCliente,
      cantidadBoletas: qty,
      precio: ticket.precio,
      fuente: "transferencia_pendiente",
    },
  });

  res.json({
    ok: true,
    ticketId,
    secureCodes,
    estado: "sin_validar",
    nombreEvento,
    fecha,
    ubicacion,
    cantidad: qty,
    total: totalCOP,
  });
});

// ===================== TRANSFERENCIA DE QRs =====================

exports.requestQrTransfer = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const decoded = await verifyAuth(req);
  if (!decoded) {
    res.status(401).json({ error: "Debes iniciar sesión" });
    return;
  }

  const callerEmail = normalizeEmail(decoded.email);
  const { items, toEmail } = req.body || {};
  const dest = normalizeEmail(toEmail);

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "No hay QRs para transferir" });
    return;
  }
  if (!dest || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) {
    res.status(400).json({ error: "Correo destino inválido" });
    return;
  }
  if (dest === callerEmail) {
    res.status(400).json({ error: "No puedes transferirte a ti mismo" });
    return;
  }
  if (items.length > 50) {
    res.status(400).json({ error: "Demasiados QRs en una sola transferencia" });
    return;
  }

  const ticketCache = {};
  const updates = {};
  const validItems = [];
  let nombreEvento = "";

  for (const item of items) {
    const { ownerUid, discotecaId, eventoId, ticketId, code } = item || {};
    if (!ownerUid || !discotecaId || !eventoId || !ticketId || !code) continue;
    const ticketPath = `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`;
    if (!ticketCache[ticketPath]) {
      const tSnap = await db.ref(ticketPath).get();
      ticketCache[ticketPath] = tSnap.exists() ? tSnap.val() : null;
    }
    const ticket = ticketCache[ticketPath];
    if (!ticket) continue;

    const codes = getTicketSecureCodes(ticket);
    if (!codes.includes(code)) continue;

    const currentHolder = normalizeEmail((ticket.codeHolders && ticket.codeHolders[code]) || ticket.emailCliente);
    if (currentHolder !== callerEmail) continue; // solo el poseedor puede transferir
    if (ticket.estado === "cancelado" || ticket.estado === "entregado") continue;
    if (ticket.codePending && ticket.codePending[code]) continue; // ya en transferencia

    updates[`${ticketPath}/codePending/${codeToKey(code)}`] = dest;
    validItems.push({ ownerUid, discotecaId, eventoId, ticketId, code });
    if (!nombreEvento) nombreEvento = ticket.nombreEvento || ticket.eventoNombre || "Evento";
  }

  if (validItems.length === 0) {
    res.status(400).json({ error: "No tienes esos QRs disponibles para transferir" });
    return;
  }

  const destKey = emailToKey(dest);
  const transferRef = db.ref(`pendingTransfers/${destKey}`).push();
  updates[`pendingTransfers/${destKey}/${transferRef.key}`] = {
    id: transferRef.key,
    fromEmail: callerEmail,
    fromUid: decoded.uid,
    toEmail: dest,
    nombreEvento,
    cantidad: validItems.length,
    items: validItems,
    createdAt: Date.now(),
  };

  await db.ref().update(updates);
  res.json({ ok: true, transferidos: validItems.length });
});

exports.acceptQrTransfer = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const decoded = await verifyAuth(req);
  if (!decoded) {
    res.status(401).json({ error: "Debes iniciar sesión" });
    return;
  }

  const callerEmail = normalizeEmail(decoded.email);
  const callerKey = emailToKey(callerEmail);
  const { transferId } = req.body || {};
  if (!transferId) {
    res.status(400).json({ error: "Falta el identificador de la transferencia" });
    return;
  }

  const transferRef = db.ref(`pendingTransfers/${callerKey}/${transferId}`);
  const tSnap = await transferRef.get();
  if (!tSnap.exists()) {
    res.status(404).json({ error: "Transferencia no encontrada o ya aceptada" });
    return;
  }

  const transfer = tSnap.val();
  const items = Array.isArray(transfer.items) ? transfer.items : [];
  const updates = {};
  let aceptados = 0;

  for (const item of items) {
    const { ownerUid, discotecaId, eventoId, ticketId, code } = item || {};
    if (!ownerUid || !discotecaId || !eventoId || !ticketId || !code) continue;
    const ticketPath = `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`;
    const ckey = codeToKey(code);
    const pendingSnap = await db.ref(`${ticketPath}/codePending/${ckey}`).get();
    const pendingTo = normalizeEmail(pendingSnap.exists() ? pendingSnap.val() : "");
    if (pendingTo !== callerEmail) continue; // la transferencia no es para este usuario

    updates[`${ticketPath}/codeHolders/${ckey}`] = callerEmail;
    updates[`${ticketPath}/codePending/${ckey}`] = null;
    updates[`${ticketPath}/updatedAt`] = Date.now();
    aceptados++;
  }

  updates[`pendingTransfers/${callerKey}/${transferId}`] = null;
  await db.ref().update(updates);

  res.json({ ok: true, aceptados });
});

exports.cancelQrTransfer = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const decoded = await verifyAuth(req);
  if (!decoded) {
    res.status(401).json({ error: "Debes iniciar sesión" });
    return;
  }

  const callerEmail = normalizeEmail(decoded.email);
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "No hay QRs para cancelar" });
    return;
  }
  if (items.length > 50) {
    res.status(400).json({ error: "Demasiados QRs en una sola operación" });
    return;
  }

  const ticketCache = {};
  const pendingByDest = {}; // destKey -> { transfers, originalItems: {transferId: items} }
  const removeByTransfer = {}; // `${destKey}::${transferId}` -> { destKey, transferId, items, removeSet:Set }
  const updates = {};
  let cancelados = 0;

  for (const item of items) {
    const { ownerUid, discotecaId, eventoId, ticketId, code } = item || {};
    if (!ownerUid || !discotecaId || !eventoId || !ticketId || !code) continue;
    const ticketPath = `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`;
    if (!ticketCache[ticketPath]) {
      const tSnap = await db.ref(ticketPath).get();
      ticketCache[ticketPath] = tSnap.exists() ? tSnap.val() : null;
    }
    const ticket = ticketCache[ticketPath];
    if (!ticket) continue;

    const codes = getTicketSecureCodes(ticket);
    if (!codes.includes(code)) continue;

    // Solo el poseedor actual del código puede cancelar su transferencia.
    const holder = normalizeEmail((ticket.codeHolders && ticket.codeHolders[code]) || ticket.emailCliente);
    if (holder !== callerEmail) continue;

    const ckey = codeToKey(code);
    const pendingDest =
      (ticket.codePending && (ticket.codePending[ckey] || ticket.codePending[code])) || null;
    if (!pendingDest) continue; // no está en transferencia (o ya fue aceptada)

    const destEmail = normalizeEmail(pendingDest);
    const destKey = emailToKey(destEmail);

    updates[`${ticketPath}/codePending/${ckey}`] = null;
    updates[`${ticketPath}/updatedAt`] = Date.now();
    cancelados++;

    if (!pendingByDest[destKey]) {
      const pSnap = await db.ref(`pendingTransfers/${destKey}`).get();
      pendingByDest[destKey] = pSnap.exists() ? pSnap.val() : {};
    }
    const transfers = pendingByDest[destKey];
    for (const transferId in transfers) {
      const tr = transfers[transferId];
      if (!tr || normalizeEmail(tr.fromEmail) !== callerEmail) continue;
      const trItems = Array.isArray(tr.items) ? tr.items : [];
      const contains = trItems.some((it) => it && it.code === code && it.ticketId === ticketId);
      if (!contains) continue;
      const mapKey = `${destKey}::${transferId}`;
      if (!removeByTransfer[mapKey]) {
        removeByTransfer[mapKey] = { destKey, transferId, items: trItems, removeSet: new Set() };
      }
      removeByTransfer[mapKey].removeSet.add(`${ticketId}|${code}`);
    }
  }

  // Reconcilia los registros pendingTransfers (quita ítems o borra el registro vacío).
  for (const mapKey in removeByTransfer) {
    const { destKey, transferId, items: trItems, removeSet } = removeByTransfer[mapKey];
    const remaining = trItems.filter((it) => it && !removeSet.has(`${it.ticketId}|${it.code}`));
    if (remaining.length === 0) {
      updates[`pendingTransfers/${destKey}/${transferId}`] = null;
    } else {
      updates[`pendingTransfers/${destKey}/${transferId}/items`] = remaining;
      updates[`pendingTransfers/${destKey}/${transferId}/cantidad`] = remaining.length;
    }
  }

  if (cancelados === 0) {
    res.status(400).json({ error: "No tienes transferencias pendientes para cancelar" });
    return;
  }

  await db.ref().update(updates);
  res.json({ ok: true, cancelados });
});

// ===================== TRIGGER: ÍNDICE userQrs =====================

/**
 * Mantiene userQrs/{holderKey}/{codeKey} sincronizado con cada ticket.
 * Se ejecuta en cada creación/edición/borrado de un ticket.
 */
exports.syncTicketQrs = onValueWritten(
  "/users/{ownerUid}/discotecas/{discotecaId}/eventos/{eventoId}/tickets/{ticketId}",
  async (event) => {
    const { ownerUid, discotecaId, eventoId, ticketId } = event.params;
    const before = event.data.before.exists() ? event.data.before.val() : null;
    const after = event.data.after.exists() ? event.data.after.val() : null;

    const updates = {};

    // 1) Eliminar entradas previas (holder anterior) para evitar duplicados.
    if (before) {
      const beforeCodes = getTicketSecureCodes(before);
      for (const code of beforeCodes) {
        const holder = normalizeEmail((before.codeHolders && before.codeHolders[code]) || before.emailCliente);
        if (!holder) continue;
        updates[`userQrs/${emailToKey(holder)}/${codeToKey(code)}`] = null;
      }
    }

    // 2) Escribir entradas actuales.
    if (after) {
      const afterCodes = getTicketSecureCodes(after);
      const canjeadas = after.entradasCanjeadas && typeof after.entradasCanjeadas === "object" ? after.entradasCanjeadas : {};
      const nombreEvento = after.nombreEvento || after.eventoNombre || "Evento";
      for (const code of afterCodes) {
        const holder = normalizeEmail((after.codeHolders && after.codeHolders[code]) || after.emailCliente);
        if (!holder) continue;
        let estado = after.estado || "pagado";
        if (canjeadas[code]) estado = "entregado";
        const pendingTo = after.codePending && after.codePending[codeToKey(code)]
          ? normalizeEmail(after.codePending[codeToKey(code)])
          : (after.codePending && after.codePending[code] ? normalizeEmail(after.codePending[code]) : null);
        updates[`userQrs/${emailToKey(holder)}/${codeToKey(code)}`] = {
          ownerUid,
          discotecaId,
          eventoId,
          ticketId,
          code,
          nombreEvento,
          fecha: after.fecha || "",
          ubicacion: after.ubicacion || "",
          estado,
          holderEmail: holder,
          pendingToEmail: pendingTo || null,
          createdAt: after.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  }
);

// ===================== REENVÍO DE QR POR CORREO =====================

exports.resendTicketQrEmail = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const decoded = await verifyAuth(req);
  if (!decoded) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const { ownerUid, discotecaId, eventoId, ticketId } = req.body || {};
  if (!ownerUid || !discotecaId || !eventoId || !ticketId) {
    res.status(400).json({ error: "Faltan datos" });
    return;
  }

  const ok = await canAccessEventTickets(decoded.uid, decoded.email, ownerUid, discotecaId, eventoId);
  if (!ok) {
    res.status(403).json({ error: "Sin permiso" });
    return;
  }

  const ticketSnap = await db
    .ref(`users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`)
    .get();
  if (!ticketSnap.exists()) {
    res.status(404).json({ error: "Ticket no encontrado" });
    return;
  }

  const t = ticketSnap.val();
  const emailTo = String(t.emailCliente || "").trim();
  if (!emailTo) {
    res.status(400).json({ error: "Este ticket no tiene correo guardado" });
    return;
  }

  const pubSnap = await db.ref(`publicEvents/${ownerUid}/${discotecaId}/${eventoId}`).get();
  const pub = pubSnap.exists() ? pubSnap.val() : {};
  const codes = getTicketSecureCodes(t);

  const result = await sendTicketQrEmailResend({
    to: emailTo,
    secureCodes: codes,
    nombreCliente: t.nombreCliente,
    nombreEvento: (pub.nombreEvento || t.nombreEvento || "Evento").substring(0, 200),
    nombreDiscoteca: (pub.nombreDiscoteca || "").substring(0, 200),
    fecha: (pub.fecha || t.fecha || "").substring(0, 120),
    tipoEntrada: t.tipoEntrada,
    cantidadBoletas: t.cantidadBoletas,
  });

  if (!result.sent) {
    let error =
      result.reason === "no_api_key"
        ? "Correo no configurado (RESEND_API_KEY en Cloud Functions)"
        : "No se pudo enviar el correo";
    if (result.resendMessage) {
      error = result.resendMessage.length > 280 ? `${result.resendMessage.slice(0, 280)}…` : result.resendMessage;
    }
    const hint = /testing|verified domain|only send|own email|sandbox/i.test(String(result.resendMessage || ""))
      ? "En Resend verifica un dominio propio y usa RESEND_FROM con ese dominio para enviar a cualquier correo."
      : undefined;
    res.status(503).json({ error, ...(hint ? { hint } : {}) });
    return;
  }

  res.json({ ok: true });
});
