import { isFirebaseConfigured } from "@/lib/firebaseConfig";

export function FirebaseStatus() {
  if (isFirebaseConfigured()) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Firebase jest skonfigurowany. Możesz podłączyć odczyt kolekcji Firestore.
      </p>
    );
  }

  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
      {"Wklej klucze z konsoli Firebase w pliku "}
      <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[0.85em]">{"src/lib/firebaseConfig.ts"}</code>
      {". Dopóki są tam placeholdery, aplikacja nie łączy się z bazą."}
    </p>
  );
}
