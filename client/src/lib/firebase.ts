import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type Auth,
} from "firebase/auth";

// Public Firebase Client configuration (defaults or from Vite env variables)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyReplaceWithYourProjectKey",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "farmfreshfarmer-auth.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "farmfreshfarmer-auth",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "farmfreshfarmer-auth.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "983416661519",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:983416661519:web:abcdef123456",
};

// Initialize Firebase singleton
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth: Auth = getAuth(firebaseApp);

// Configure language for SMS OTPs
firebaseAuth.languageCode = "en";

/**
 * Setup invisible reCAPTCHA verifier for Phone Auth
 */
export function setupRecaptcha(containerId: string = "recaptcha-container"): RecaptchaVerifier {
  // Clear any existing recaptcha widget if present
  if ((window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch {}
  }

  const verifier = new RecaptchaVerifier(firebaseAuth, containerId, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved
    },
    "expired-callback": () => {
      console.warn("[Firebase] reCAPTCHA expired, resetting");
    },
  });

  (window as any).recaptchaVerifier = verifier;
  return verifier;
}

/**
 * Send Firebase SMS OTP to standard Indian 10-digit mobile number (+91)
 */
export async function sendFirebasePhoneOtp(
  rawPhone: string,
  appVerifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  const cleanPhone = String(rawPhone).replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) {
    throw new Error("Please enter a valid 10-digit Indian mobile number.");
  }

  const fullInternationalPhone = `+91${cleanPhone}`;
  return await signInWithPhoneNumber(firebaseAuth, fullInternationalPhone, appVerifier);
}
