import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// TODO: Replace with your own Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBcQ6KwsuPRPgaCNsUcxaTcwNS6T3gkx4A",
  authDomain: "clyra-9eb4c.firebaseapp.com",
  projectId: "clyra-9eb4c",
  storageBucket: "clyra-9eb4c.firebasestorage.app",
  messagingSenderId: "789978674170",
  appId: "1:789978674170:web:444146b3de9a987a642a43",
  measurementId: "G-30KEMTXEBC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      console.warn("Google Sign-In pop-up was closed or cancelled by the user.");
    } else if (error.code === 'auth/popup-blocked') {
      console.error("Google Sign-In pop-up was blocked by the browser. Please allow pop-ups for this site.");
    } else {
      console.error("Error during Google Sign-In:", error);
    }
    throw error; // Re-throw to propagate the error to the calling component
  }
};

export const signOut = () => {
  return auth.signOut();
};

export const onAuthStateChanged = (callback) => {
  return auth.onAuthStateChanged(callback);
};
