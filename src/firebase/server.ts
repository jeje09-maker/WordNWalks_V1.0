import 'dotenv/config';
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// This is the recommended way to initialize the Admin SDK in environments
// where service account credentials need to be provided explicitly.
if (!getApps().length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  // Only initialize if all the necessary environment variables are present.
  if (serviceAccount.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // This fallback is for managed environments like Cloud Run/Functions where
    // ADC (Application Default Credentials) are automatically available.
    // It might fail in a local dev environment if `gcloud auth application-default login` hasn't been run.
    console.warn("Firebase Admin SDK: Service account credentials not found in environment variables. Falling back to Application Default Credentials.");
    initializeApp();
  }
}

export const serverFirestore = getFirestore();
export const serverAuth = getAuth();
