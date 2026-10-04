import { initializeApp } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "gen-lang-client-0154547043",
  appId: "1:994515158251:web:6735583083a8dc0c502aae",
  apiKey: "AIzaSyD9XkNbZLU1EXse08DocZz-HoruDN5e3po",
  authDomain: "gen-lang-client-0154547043.firebaseapp.com",
  storageBucket: "gen-lang-client-0154547043.firebasestorage.app",
  messagingSenderId: "994515158251"
};

const databaseId = "ai-studio-99cdf9a5-5a72-4b85-b079-f1d016300582";

const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true, // helpful in sandboxed iframes
}, databaseId);
