/**
 * Helpers de URL hacia las Cloud Functions (2ª gen, con CORS).
 * Se llama directamente a la función; ver functionsBaseUrl() en appConfig.
 */
import { functionsBaseUrl } from "../config/appConfig";

export function getResendTicketQrEmailUrl() {
  return `${functionsBaseUrl().replace(/\/$/, "")}/resendTicketQrEmail`;
}
