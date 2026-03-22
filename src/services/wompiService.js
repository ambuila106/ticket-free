/**
 * Base URL para las Cloud Functions expuestas vía Hosting (/api/...)
 * En local con emulador: VITE_API_BASE=http://127.0.0.1:5001/TU_PROJECT_ID/us-central1
 */
const API_BASE = import.meta.env.VITE_API_BASE || "";

export function getPreparePaymentUrl() {
  if (API_BASE) {
    return `${API_BASE.replace(/\/$/, "")}/api/prepareWompiPayment`;
  }
  return "/api/prepareWompiPayment";
}

export function loadWompiWidgetScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.WidgetCheckout) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-wompi-widget="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.wompi.co/widget.js";
    s.async = true;
    s.dataset.wompiWidget = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar el widget de Wompi"));
    document.body.appendChild(s);
  });
}

/**
 * @param {object} params - Respuesta de prepareWompiPayment
 * @param {(result: object) => void} onResult - Callback del widget
 */
export async function openWompiCheckout(params, onResult) {
  await loadWompiWidgetScript();
  if (typeof window.WidgetCheckout !== "function") {
    throw new Error("WidgetCheckout no está disponible");
  }
  const checkout = new window.WidgetCheckout({
    currency: params.currency || "COP",
    amountInCents: params.amountInCents,
    reference: params.reference,
    publicKey: params.publicKey,
    signature: params.signature,
    redirectUrl: params.redirectUrl || window.location.href.split("?")[0],
  });
  checkout.open((result) => {
    if (typeof onResult === "function") onResult(result);
  });
}
