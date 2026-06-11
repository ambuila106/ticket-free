import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../firebase/config";

/**
 * Comprime una imagen en el navegador (redimensiona y convierte a JPEG)
 * para no llenar el almacenamiento. Devuelve un Blob.
 */
function compressImage(file, maxSize = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("No se pudo procesar la imagen"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

export const storageService = {
  /**
   * Sube el comprobante de transferencia comprimido.
   * Ruta: comprobantes/{ownerUid}/{eventoId}/{uploaderUid}/{archivo}
   * Se incluye el uploaderUid para que el comprador pueda obtener la URL
   * (getDownloadURL requiere permiso de lectura) sin exponer los comprobantes
   * de otros usuarios.
   * @returns {Promise<{ url: string, path: string }>}
   */
  async uploadComprobante(file, ownerUid, eventoId, uploaderUid) {
    if (!file) throw new Error("No hay imagen seleccionada");
    if (!uploaderUid) throw new Error("Falta el usuario que sube el comprobante");
    const blob = await compressImage(file);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    const path = `comprobantes/${ownerUid}/${eventoId}/${uploaderUid}/${fileName}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
    const url = await getDownloadURL(fileRef);
    return { url, path };
  },

  /** Borra un objeto del Storage por su ruta. */
  async deleteByPath(path) {
    if (!path) return { removed: false };
    try {
      await deleteObject(storageRef(storage, path));
      return { removed: true };
    } catch (error) {
      // Si ya no existe, lo damos por borrado.
      if (error?.code === "storage/object-not-found") {
        return { removed: true, alreadyGone: true };
      }
      throw error;
    }
  },
};
