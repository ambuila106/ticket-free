/**
 * Cloud Functions: Wompi (Colombia)
 *
 * Variables (producción: Google Cloud Console → Cloud Run → servicio de la función → Variables y secretos,
 * o archivo functions/.env en local / emulador):
 *   WOMPI_INTEGRITY_SECRET  — Secreto de integridad del widget
 *   WOMPI_PUBLIC_KEY        — pub_prod_... / pub_test_...
 *   WOMPI_EVENTS_SECRET     — prod_events_... (validación webhook; recomendado)
 *   PUBLIC_APP_URL          — https://tu-dominio.web.app (opcional si hay header Origin)
 *   RESEND_API_KEY          — API key de Resend (correo con QR; opcional)
 *   RESEND_FROM             — Remitente verificado, ej. "Ticket Free <onboarding@resend.dev>"
 */
const path = require("path");
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch (_) {
  /* dotenv opcional */
}

const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
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

function wompiWidgetIntegrity(reference, amountInCents, currency, secret) {
  const payload = `${reference}${amountInCents}${currency}${secret}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/** Lee ruta tipo "transaction.id" dentro de body.data */
function getDataProperty(data, propertyPath) {
  if (!data || !propertyPath) return null;
  const parts = String(propertyPath).split(".");
  let cur = data;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = cur[p];
  }
  return cur;
}

/**
 * Validación oficial Wompi (docs Colombia → Eventos → Seguridad)
 * https://docs.wompi.co/docs/colombia/eventos/
 */
function verifyWompiEventFromRequest(body, headerChecksum, eventsSecret) {
  if (!eventsSecret) return { ok: true, skipped: true };
  if (!body?.signature?.properties || body.timestamp == null) {
    return { ok: false, reason: "missing_signature_fields" };
  }
  let concat = "";
  for (const prop of body.signature.properties) {
    const val = getDataProperty(body.data, prop);
    concat += val == null ? "" : String(val);
  }
  concat += String(body.timestamp);
  concat += eventsSecret;
  const computed = crypto.createHash("sha256").update(concat, "utf8").digest("hex").toLowerCase();
  const expected = (body.signature.checksum || headerChecksum || "").toLowerCase();
  if (!expected) return { ok: false, reason: "no_checksum" };
  return { ok: computed === expected, skipped: false };
}

function collaboratorKeyFromEmail(email) {
  return String(email || "").replace(/[@.]/g, "_");
}

/** Dueño del evento o colaborador registrado (misma clave que el front). */
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

/**
 * Envía correo con uno o varios QR (Resend). Si no hay API key, no hace nada.
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendTicketQrEmailResend(opts) {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("RESEND_API_KEY no definido; se omite el envío de correo");
    return { sent: false, reason: "no_api_key" };
  }

  const from = env("RESEND_FROM") || "Ticket Free <onboarding@resend.dev>";
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
  /** Gmail y otros bloquean data:image en HTML; Resend usa CID (adjunto inline). */
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
    codes.length === 1
      ? `Tu entrada — ${nombreEvento}`
      : `Tus ${codes.length} entradas — ${nombreEvento}`;

  const intro =
    codes.length === 1
      ? "Tu pago fue registrado. Presenta este código QR en la entrada."
      : `Tu pago fue registrado. Cada QR es una entrada distinta (${codes.length} en total). Presenta cada uno en la puerta.`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#222;max-width:520px;">
  <h1 style="font-size:1.25rem;">¡Listo, ${nombreCliente || "comprador"}!</h1>
  <p>${intro}</p>
  <p><strong>${nombreEvento}</strong>${nombreDiscoteca ? ` · ${nombreDiscoteca}` : ""}${fecha ? `<br/>📅 ${fecha}` : ""}</p>
  <p>Tipo: ${tipoEntrada} · Entradas: ${cantidad}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;"/>
  ${blocks.join("")}
  <p style="font-size:12px;color:#666;margin-top:20px;">Si no ves los QR arriba, abre los archivos <strong>entrada-01.png</strong>, etc. del correo (mismas imágenes adjuntas).</p>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      attachments,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend error", res.status, body);
    return { sent: false, reason: "resend_http" };
  }
  return { sent: true };
}

exports.prepareWompiPayment = onRequest(
  { cors: true, invoker: "public" },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const integritySecret = env("WOMPI_INTEGRITY_SECRET");
    const publicKey = env("WOMPI_PUBLIC_KEY");
    if (!integritySecret || !publicKey) {
      res.status(503).json({
        error:
          "Pagos no configurados. Define WOMPI_INTEGRITY_SECRET y WOMPI_PUBLIC_KEY en la función (Cloud Run / .env).",
      });
      return;
    }

    const {
      ownerUid,
      discotecaId,
      eventoId,
      nombreCliente,
      email,
      telefono,
      cantidad,
    } = req.body || {};

    if (!ownerUid || !discotecaId || !eventoId || !nombreCliente || !email || !telefono) {
      res.status(400).json({ error: "Faltan datos obligatorios" });
      return;
    }

    const snap = await db.ref(`publicEvents/${ownerUid}/${discotecaId}/${eventoId}`).get();
    if (!snap.exists() || !snap.val().enabled) {
      res.status(400).json({ error: "Evento no disponible para compra" });
      return;
    }

    const pub = snap.val();
    const unitCOP = parseInt(pub.precioPorEntradaCOP, 10);
    if (!Number.isFinite(unitCOP) || unitCOP < 100) {
      res.status(400).json({ error: "Precio inválido en la página pública" });
      return;
    }

    let qty = parseInt(cantidad, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > 20) qty = 20;

    const amountInCents = unitCOP * qty * 100;
    const reference = `TF${Date.now()}${crypto.randomBytes(5).toString("hex")}`.substring(0, 36);

    const pending = {
      ownerUid,
      discotecaId,
      eventoId,
      nombreCliente: String(nombreCliente).trim().substring(0, 100),
      email: String(email).trim().substring(0, 120),
      telefono: String(telefono).trim().substring(0, 30),
      cantidad: qty,
      amountInCents,
      tipoEntrada: (pub.tipoEntrada || "General").substring(0, 80),
      status: "pending",
      createdAt: Date.now(),
    };

    await db.ref(`pendingWompiPurchases/${reference}`).set(pending);

    const currency = "COP";
    const integrity = wompiWidgetIntegrity(reference, amountInCents, currency, integritySecret);

    const origin =
      env("PUBLIC_APP_URL") ||
      (req.headers.origin && String(req.headers.origin)) ||
      (req.headers.referer && String(req.headers.referer).split("/").slice(0, 3).join("/")) ||
      "";
    const baseUrl = origin.replace(/\/$/, "");
    if (!baseUrl) {
      res.status(503).json({
        error:
          "Configura PUBLIC_APP_URL en la función o abre la compra desde el navegador (header Origin).",
      });
      return;
    }

    res.json({
      publicKey,
      reference,
      amountInCents,
      currency,
      signature: { integrity },
      redirectUrl: `${baseUrl}/entrada/${encodeURIComponent(reference)}`,
    });
  }
);

exports.wompiWebhook = onRequest({ cors: false, invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const body = req.body;
  const eventsSecret = env("WOMPI_EVENTS_SECRET");
  const headerChecksum = String(
    req.headers["x-event-checksum"] || req.headers["X-Event-Checksum"] || ""
  );

  if (eventsSecret) {
    const v = verifyWompiEventFromRequest(body, headerChecksum, eventsSecret);
    if (!v.ok) {
      console.warn("Wompi webhook: checksum inválido", v.reason);
      res.status(401).send("Invalid signature");
      return;
    }
  } else {
    console.warn("Wompi webhook: WOMPI_EVENTS_SECRET no definido; se acepta el evento sin verificar firma");
  }

  if (body?.event && body.event !== "transaction.updated") {
    res.status(200).send("OK");
    return;
  }

  let transaction = null;
  if (body?.data?.transaction) {
    transaction = body.data.transaction;
  } else if (body?.transaction) {
    transaction = body.transaction;
  }

  if (!transaction?.reference) {
    res.status(200).send("OK");
    return;
  }

  const status = (transaction.status || "").toUpperCase();
  if (status !== "APPROVED") {
    res.status(200).send("OK");
    return;
  }

  const reference = transaction.reference;
  if (!reference.startsWith("TF")) {
    res.status(200).send("OK");
    return;
  }

  const pendingRef = db.ref(`pendingWompiPurchases/${reference}`);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists()) {
    res.status(200).send("OK");
    return;
  }

  const p = pendingSnap.val();
  if (p.status === "completed") {
    res.status(200).send("OK");
    return;
  }

  const txAmount = Number(transaction.amount_in_cents);
  if (Number.isFinite(txAmount) && Number.isFinite(p.amountInCents) && txAmount !== p.amountInCents) {
    console.warn("Wompi webhook: monto no coincide con pending", { txAmount, pending: p.amountInCents });
    res.status(400).send("Amount mismatch");
    return;
  }

  const {
    ownerUid,
    discotecaId,
    eventoId,
    nombreCliente,
    telefono,
    cantidad,
    tipoEntrada,
    amountInCents,
  } = p;
  const ticketsRef = db.ref(`users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`);
  const ticketRef = ticketsRef.push();
  const ticketId = ticketRef.key;
  let qty = parseInt(cantidad, 10);
  if (!Number.isFinite(qty) || qty < 1) qty = 1;
  if (qty > 100) qty = 100;
  const seen = new Set();
  const secureCodes = [];
  while (secureCodes.length < qty) {
    const c = generateSecureCode();
    if (!seen.has(c)) {
      seen.add(c);
      secureCodes.push(c);
    }
  }
  const secureCode = secureCodes[0];
  const precioCOP = Math.round(amountInCents / 100);

  const ticket = {
    id: ticketId,
    secureCode,
    secureCodes,
    nombreCliente,
    telefono,
    tipoEntrada: tipoEntrada || "General",
    precio: `${precioCOP} COP (Wompi)`,
    cantidadBoletas: qty,
    estado: "pagado",
    emailCliente: p.email || "",
    fuentePago: "wompi",
    wompiTransactionId: transaction.id || "",
    wompiReference: reference,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await ticketRef.set(ticket);

  const pubSnap = await db.ref(`publicEvents/${ownerUid}/${discotecaId}/${eventoId}`).get();
  const pub = pubSnap.exists() ? pubSnap.val() : {};
  const nombreEvento = (pub.nombreEvento || "Evento").substring(0, 200);
  const nombreDiscoteca = (pub.nombreDiscoteca || "").substring(0, 200);
  const fecha = (pub.fecha || "").substring(0, 120);
  const ubicacion = (pub.ubicacion || "").substring(0, 200);

  const publicSuccess = {
    secureCode,
    secureCodes,
    ticketId,
    ownerUid,
    discotecaId,
    eventoId,
    nombreCliente: String(nombreCliente).substring(0, 100),
    nombreEvento,
    nombreDiscoteca,
    fecha,
    ubicacion,
    tipoEntrada: ticket.tipoEntrada,
    cantidadBoletas: qty,
    wompiReference: reference,
    createdAt: Date.now(),
  };

  await db.ref(`publicPurchaseSuccess/${reference}`).set(publicSuccess);

  const logRef = db.ref(`users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/bitacora`).push();
  await logRef.set({
    id: logRef.key,
    accion: "ticket_creado",
    usuario: { uid: "wompi", email: "webhook@wompi.co", nombre: "Wompi" },
    timestamp: Date.now(),
    fecha: new Date().toLocaleString("es-CO"),
    detalles: {
      ticketId,
      ticketCode: secureCode.substring(0, 12),
      cliente: nombreCliente,
      cantidadBoletas: qty,
      precio: ticket.precio,
      fuente: "wompi_webhook",
    },
  });

  await pendingRef.update({ status: "completed", completedAt: Date.now(), ticketId });

  const emailTo = String(p.email || "").trim();
  if (emailTo) {
    sendTicketQrEmailResend({
      to: emailTo,
      secureCodes,
      nombreCliente,
      nombreEvento,
      nombreDiscoteca,
      fecha,
      tipoEntrada: ticket.tipoEntrada,
      cantidadBoletas: qty,
    }).catch((err) => console.error("Wompi webhook: correo QR", err));
  }

  res.status(200).send("OK");
});

exports.resendTicketQrEmail = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = String(req.headers.authorization || "");
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(m[1]);
  } catch (e) {
    res.status(401).json({ error: "Token inválido" });
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
  const nombreEvento = (pub.nombreEvento || "Evento").substring(0, 200);
  const nombreDiscoteca = (pub.nombreDiscoteca || "").substring(0, 200);
  const fecha = (pub.fecha || "").substring(0, 120);

  let raw = t.secureCodes;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    raw = Object.keys(raw)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => raw[k]);
  }
  const codes =
    Array.isArray(raw) && raw.length > 0
      ? raw.map((c) => String(c).trim()).filter(Boolean)
      : t.secureCode
        ? [String(t.secureCode).trim()]
        : [];

  const result = await sendTicketQrEmailResend({
    to: emailTo,
    secureCodes: codes,
    nombreCliente: t.nombreCliente,
    nombreEvento,
    nombreDiscoteca,
    fecha,
    tipoEntrada: t.tipoEntrada,
    cantidadBoletas: t.cantidadBoletas,
  });

  if (!result.sent) {
    res.status(503).json({
      error:
        result.reason === "no_api_key"
          ? "Correo no configurado (RESEND_API_KEY en Cloud Functions)"
          : "No se pudo enviar el correo",
    });
    return;
  }

  res.json({ ok: true });
});
