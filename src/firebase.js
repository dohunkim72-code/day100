import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAA_2x_BLfF10Qd_iOrtr1kI5Lwix5rRyk",
  authDomain: "day100-web.firebaseapp.com",
  projectId: "day100-web",
  storageBucket: "day100-web.firebasestorage.app",
  messagingSenderId: "175114088761",
  appId: "1:175114088761:web:db30c4db676fd64c88f8e8",
  measurementId: "G-PTPYNZFN8S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, analytics };
