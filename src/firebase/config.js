// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDBXcOre-2_vaUl7pHpnm7Dp4ypUCqFdLU",
  authDomain: "chatonline-4aa0d.firebaseapp.com",
  databaseURL: "https://chatonline-4aa0d.firebaseio.com",
  projectId: "chatonline-4aa0d",
  storageBucket: "chatonline-4aa0d.firebasestorage.app",
  messagingSenderId: "820175606783",
  appId: "1:820175606783:web:091c42400536ac5a444dca"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const database = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export default app;

