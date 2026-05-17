import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { auth, googleProvider } from "../firebase/config";

let authInitialized = false;
let authReadyPromise = null;

const waitForInitialAuthState = () => {
  if (authInitialized) {
    return Promise.resolve(auth.currentUser);
  }

  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          authInitialized = true;
          unsubscribe();
          resolve(user);
        },
        () => {
          authInitialized = true;
          resolve(null);
        }
      );
    });
  }

  return authReadyPromise;
};

export const authService = {
  // Login con Google
  async loginWithGoogle() {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, googleProvider);
      authInitialized = true;
      return {
        success: true,
        user: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Logout
  async logout() {
    try {
      await signOut(auth);
      authInitialized = true;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Observar cambios en el estado de autenticación
  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, (user) => {
      authInitialized = true;
      callback(user);
    });
  },

  // Obtener usuario actual
  getCurrentUser() {
    return auth.currentUser;
  },

  // Esperar restauración inicial de sesión (importante en refresh)
  async waitForAuthReady() {
    return waitForInitialAuthState();
  },

  /** Token ID para llamadas a API protegidas (p. ej. reenvío de QR). */
  async getIdToken() {
    const u = auth.currentUser;
    if (!u) return null;
    return u.getIdToken();
  }
};

