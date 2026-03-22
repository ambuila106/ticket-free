/**
 * Cloud Functions: Wompi (Colombia)
 *
 * Variables (producción: Google Cloud Console → Cloud Run → servicio de la función → Variables y secretos,
 * o archivo functions/.env en local / emulador):
 *   WOMPI_INTEGRITY_SECRET  — Secreto de integridad del widget
 *   WOMPI_PUBLIC_KEY        — pub_prod_... / pub_test_...
 *   WOMPI_EVENTS_SECRET     — prod_events_... (validación webhook; recomendado)
 *   PUBLIC_APP_URL          — https://tu-dominio.web.app (opcional si hay header Origin)
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
      redirectUrl: `${baseUrl}/comprar/${ownerUid}/${discotecaId}/${eventoId}?gracias=1`,
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
  const secureCode = generateSecureCode();
  const precioCOP = Math.round(amountInCents / 100);

  const ticket = {
    id: ticketId,
    secureCode,
    nombreCliente,
    telefono,
    tipoEntrada: tipoEntrada || "General",
    precio: `${precioCOP} COP (Wompi)`,
    cantidadBoletas: cantidad,
    estado: "pagado",
    emailCliente: p.email || "",
    fuentePago: "wompi",
    wompiTransactionId: transaction.id || "",
    wompiReference: reference,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await ticketRef.set(ticket);

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
      cantidadBoletas: cantidad,
      precio: ticket.precio,
      fuente: "wompi_webhook",
    },
  });

  await pendingRef.update({ status: "completed", completedAt: Date.now(), ticketId });

  res.status(200).send("OK");
});
