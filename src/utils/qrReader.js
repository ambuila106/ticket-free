import { Html5Qrcode } from "html5-qrcode";

export class QRReader {
  constructor(cameraId = null) {
    this.html5QrCode = new Html5Qrcode("qr-reader");
    this.cameraId = cameraId;
  }

  async start() {
    try {
      // Obtener lista de cámaras
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        const cameraId = this.cameraId || devices[0].id;
        
        await this.html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText, decodedResult) => {
            // Callback cuando se detecta un QR
            if (this.onScanSuccess) {
              this.onScanSuccess(decodedText, decodedResult);
            }
          },
          (errorMessage) => {
            // Callback para errores (opcional)
            if (this.onScanError) {
              this.onScanError(errorMessage);
            }
          }
        );
        
        return { success: true };
      } else {
        return { success: false, error: "No se encontraron cámaras" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
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

