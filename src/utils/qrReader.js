import { Html5Qrcode } from "html5-qrcode";

// Detectar si la cámara es trasera (por etiqueta del dispositivo)
function isRearCamera(label) {
  if (!label) return false;
  const lower = label.toLowerCase();
  return /back|rear|environment|trasera|posterior|posteriora/i.test(lower);
}

/** Obtener lista de cámaras con id, label e isRear (para móviles: cámara trasera) */
export async function getCameraList() {
  const devices = await Html5Qrcode.getCameras();
  if (!devices || devices.length === 0) return [];
  return devices.map((d) => ({
    id: d.id,
    label: d.label || `Cámara ${d.id.slice(0, 8)}`,
    isRear: isRearCamera(d.label),
  }));
}

/** Id de cámara trasera por defecto (para usar en móviles) */
export function getDefaultCameraId(cameraList) {
  if (!cameraList?.length) return null;
  const rear = cameraList.find((c) => c.isRear);
  return rear ? rear.id : cameraList[0].id;
}

export class QRReader {
  constructor(cameraId = null) {
    this.html5QrCode = new Html5Qrcode("qr-reader");
    this.cameraId = cameraId;
  }

  async start(preferredCameraId = null) {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        return { success: false, error: "No se encontraron cámaras" };
      }

      const cameraId =
        preferredCameraId ||
        this.cameraId ||
        getDefaultCameraId(await getCameraList()) ||
        devices[0].id;
      this.cameraId = cameraId;

      await this.html5QrCode.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText, decodedResult) => {
          if (this.onScanSuccess) {
            this.onScanSuccess(decodedText, decodedResult);
          }
        },
        (errorMessage) => {
          if (this.onScanError) {
            this.onScanError(errorMessage);
          }
        }
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /** Cambiar a otra cámara (p. ej. frontal ↔ trasera) */
  async switchCamera(cameraId) {
    await this.stop();
    this.cameraId = cameraId;
    return this.start(cameraId);
  }

  async stop() {
    try {
      await this.html5QrCode.stop();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  setOnScanSuccess(callback) {
    this.onScanSuccess = callback;
  }

  setOnScanError(callback) {
    this.onScanError = callback;
  }
}

/**
 * Decodificar QR desde un archivo de imagen (foto).
 * @param {File} file - Archivo de imagen (ej. desde input type="file")
 * @param {string} elementId - Id de un elemento en el DOM (puede estar oculto)
 * @returns {{ success: boolean, decodedText?: string, error?: string }}
 */
export async function scanFileFromImage(file, elementId = "qr-file-reader") {
  const scanner = new Html5Qrcode(elementId);
  try {
    const decodedText = await scanner.scanFile(file, false);
    return { success: true, decodedText };
  } catch (error) {
    return {
      success: false,
      error: error?.message || "No se encontró un QR en la imagen",
    };
  }
}

