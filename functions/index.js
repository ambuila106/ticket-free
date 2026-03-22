/**
 * Cloud Functions: Wompi (Colombia)
 * Variables de entorno (Functions config o .env local):
 *   WOMPI_INTEGRITY_SECRET - Secreto de integridad (panel Wompi > Desarrolladores)
 *   WOMPI_PUBLIC_KEY       - Llave pública pub_prod_... o pub_test_...
 *   WOMPI_EVENTS_SECRET    - (Opcional) para validar firma del webhook
 */
const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();

function generateSecureCode() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}-${random2}`.toUpperCase();
}

function wompiIntegrity(reference, amountInCents, currency, secret) {
  const payload = `${reference}${amountInCents}${currency}${secret}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
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

    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const publicKey = process.env.WOMPI_PUBLIC_KEY;
    if (!integritySecret || !publicKey) {
      res.status(503).json({
        error: "Pagos no configurados: faltan WOMPI_INTEGRITY_SECRET o WOMPI_PUBLIC_KEY en Functions",
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

    // Wompi Colombia: monto en centavos (1 COP = 100 centavos)
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
    const integrity = wompiIntegrity(reference, amountInCents, currency, integritySecret);

    const baseUrl = (process.env.PUBLIC_APP_URL || req.headers.origin || "")
      .replace(/\/$/, "");
    if (!baseUrl) {
      res.status(503).json({
        error:
          "Configura PUBLIC_APP_URL en Functions o asegúrate de llamar desde el navegador (header Origin).",
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

/**
 * Webhook Wompi: crea ticket cuando la transacción queda APPROVED
 */
exports.wompiWebhook = onRequest({ cors: false, invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const body = req.body;
  // Opcional: validar firma del webhook según la doc actual de Wompi (propiedad / checksum)
  // y asignar WOMPI_EVENTS_SECRET; si no está configurado, se confía en la red de Wompi + referencia TF*.

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

  const { ownerUid, discotecaId, eventoId, nombreCliente, telefono, cantidad, tipoEntrada, amountInCents } = p;
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
