import { authService } from "./authService";
import { functionsBaseUrl } from "../config/appConfig";

function apiUrl(name) {
  return `${functionsBaseUrl().replace(/\/$/, "")}/${name}`;
}

async function postWithAuth(name, body) {
  const token = await authService.getIdToken();
  if (!token) throw new Error("Debes iniciar sesión");
  const res = await fetch(apiUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || "Error en la solicitud");
  }
  return data;
}

export const transferService = {
  /**
   * Crea un pedido por transferencia (después de subir el comprobante).
   * @param {object} body { ownerUid, discotecaId, eventoId, cantidad, nombre, cedula, email, telefono, comprobantePath, comprobanteUrl, vendidoPorColaborador }
   */
  async submitTransferOrder(body) {
    return postWithAuth("submitTransferOrder", body);
  },

  /**
   * Solicita transferir uno o más QRs a otro correo.
   * @param {Array} items [{ ownerUid, discotecaId, eventoId, ticketId, code }]
   * @param {string} toEmail
   */
  async requestQrTransfer(items, toEmail) {
    return postWithAuth("requestQrTransfer", { items, toEmail });
  },

  /** Acepta una transferencia pendiente dirigida al usuario actual. */
  async acceptQrTransfer(transferId) {
    return postWithAuth("acceptQrTransfer", { transferId });
  },

  /**
   * Cancela la transferencia de uno o más QRs que aún no han sido aceptados.
   * @param {Array} items [{ ownerUid, discotecaId, eventoId, ticketId, code }]
   */
  async cancelQrTransfer(items) {
    return postWithAuth("cancelQrTransfer", { items });
  },
};
