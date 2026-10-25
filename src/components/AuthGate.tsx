"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User, signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const app = getFirebaseApp();
      if (!app) {
        setLoading(false);
        return;
      }
      const auth = getAuth(app);
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const app = getFirebaseApp();
      if (!app) throw new Error("Firebase nie jest zainicjalizowany.");
      const auth = getAuth(app);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Błąd logowania";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-sm font-medium text-slate-500">
            Ładowanie aplikacji...
          </div>
        </div>
        <div hidden>{children}</div>
      </>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">CRM Serwisanta</h1>
          <p className="mb-6 text-sm text-slate-600">Zaloguj się, aby uzyskać dostęp do bazy</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="twoj@email.pl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600">
                Hasło
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Logowanie..." : "Zaloguj się"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}