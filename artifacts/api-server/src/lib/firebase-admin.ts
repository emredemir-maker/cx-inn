import {
  initializeApp,
  getApps,
  cert,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let firebaseApp: App | undefined;

function getFirebaseApp(): App {
  if (firebaseApp) return firebaseApp;

  const existing = getApps();
  if (existing.length > 0) {
    firebaseApp = existing[0]!;
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID environment variable is required");
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } else {
    firebaseApp = initializeApp({ projectId });
  }

  return firebaseApp;
}

export async function verifyFirebaseToken(
  idToken: string,
): Promise<import("firebase-admin/auth").DecodedIdToken> {
  const app = getFirebaseApp();
  return getAuth(app).verifyIdToken(idToken);
}
