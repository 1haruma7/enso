// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA2jIsxWk0SVUbzERDfpOT2d2rAtmGLo4E",
  authDomain: "enso-official-app.firebaseapp.com",
  projectId: "enso-official-app",
  storageBucket: "enso-official-app.firebasestorage.app",
  messagingSenderId: "135852280008",
  appId: "1:135852280008:web:2c68a9b3a6c35503847dfd",
  measurementId: "G-02QMRGJ8QD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);