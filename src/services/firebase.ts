import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';

export const firebaseConfig = {
  apiKey: "AIzaSyBCfBlswVUaiTqzrMmgSHgHg9ObftC2afQ",
  authDomain: "agent-md-506215.firebaseapp.com",
  projectId: "agent-md-506215",
  storageBucket: "agent-md-506215.firebasestorage.app",
  messagingSenderId: "1044179901556",
  appId: "1:1044179901556:web:8f3291173cd68f2ee24521"
};

// Initialize Firebase App instance
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Backend Services: Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

// Firebase AI Logic with Google AI Backend
export const ai = getAI(app, { backend: new GoogleAIBackend() });
export const aiModel = getGenerativeModel(ai, { model: "gemini-2.5-flash" });

/**
 * Generate text directly from the client using Firebase AI Logic.
 */
export async function generateTextWithAILogic(prompt: string): Promise<string> {
  const result = await aiModel.generateContent(prompt);
  const response = result.response;
  return response.text();
}

/**
 * Stream text generation directly from the client using Firebase AI Logic.
 */
export async function streamTextWithAILogic(
  prompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const result = await aiModel.generateContentStream(prompt);
  let aggregated = '';
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    aggregated += chunkText;
    onChunk(chunkText);
  }
  return aggregated;
}
