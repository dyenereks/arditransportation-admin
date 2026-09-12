"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const raw = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const envName = (key: string) =>
  `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`;

const missing = [
  ...Object.entries(raw)
    .filter(([, v]) => !v)
    .map(([k]) => envName(k)),
  ...(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    ? []
    : ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"]),
];

/**
 * Set when the environment is incomplete, so the UI can say exactly what's
 * missing. We deliberately don't throw here: this module is imported by the
 * root layout, and throwing at import time would fail the production build
 * instead of showing a human a fixable message.
 */
export const FIREBASE_CONFIG_ERROR = missing.length
  ? `Not configured — missing ${missing.join(", ")}. ` +
    `Copy .env.local.example to .env.local and fill it in (see SETUP.md), ` +
    `then restart the server.`
  : null;

// Placeholders keep getAuth() from throwing on an unconfigured build; any real
// call still fails, and the banner above explains why.
const config = {
  ...raw,
  apiKey: raw.apiKey || "unconfigured",
  authDomain: raw.authDomain || "unconfigured.firebaseapp.com",
  projectId: raw.projectId || "unconfigured",
};

const app = getApps().length ? getApp() : initializeApp(config);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
