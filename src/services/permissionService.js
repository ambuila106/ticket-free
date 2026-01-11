import { ref, get } from "firebase/database";
import { database } from "../firebase/config";
import { authService } from "./authService";

export const permissionService = {
  /**
   * Verifica si un colaborador tiene un permiso específico
   */
  async checkCollaboratorPermission(ownerUid, discotecaId, eventoId, permission) {
    const user = authService.getCurrentUser();
    if (!user) return false;
    
    // Si es el dueño, tiene todos los permisos
    if (user.uid === ownerUid) return true;
    
    // Verificar si es colaborador
    const collaboratorKey = user.email.replace(/[@.]/g, '_');
    const collaboratorRef = ref(
      database, 
      `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/colaboradores/${collaboratorKey}`
    );
    
    try {
      const snapshot = await get(collaboratorRef);
      if (!snapshot.exists()) return false;
      
      const collaborator = snapshot.val();
      return collaborator.permisos?.[permission] === true;
    } catch (error) {
      console.error('Error verificando permisos:', error);
      return false;
    }
  },

  /**
   * Verifica si el usuario es colaborador de un evento
   */
  async isCollaborator(ownerUid, discotecaId, eventoId) {
    const user = authService.getCurrentUser();
    if (!user) return false;
    
    if (user.uid === ownerUid) return false; // El dueño no es colaborador
    
    const collaboratorKey = user.email.replace(/[@.]/g, '_');
    const collaboratorRef = ref(
      database, 
      `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/colaboradores/${collaboratorKey}`
    );
    
    try {
      const snapshot = await get(collaboratorRef);
      return snapshot.exists();
    } catch (error) {
      console.error('Error verificando colaborador:', error);
      return false;
    }
  },

  /**
   * Obtiene todos los permisos de un colaborador
   */
  async getCollaboratorPermissions(ownerUid, discotecaId, eventoId) {
    const user = authService.getCurrentUser();
    if (!user) return null;
    
    if (user.uid === ownerUid) {
      // El dueño tiene todos los permisos
      return {
        crearTickets: true,
        leerQR: true,
        verReportes: true
      };
    }
    
    const collaboratorKey = user.email.replace(/[@.]/g, '_');
    const collaboratorRef = ref(
      database, 
      `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/colaboradores/${collaboratorKey}`
    );
    
    try {
      const snapshot = await get(collaboratorRef);
      if (!snapshot.exists()) return null;
      
      const collaborator = snapshot.val();
      return collaborator.permisos || null;
    } catch (error) {
      console.error('Error obteniendo permisos:', error);
      return null;
    }
  }
};

