import type { Protokol } from "@/types/protokol";

export type DaneProtokoluPdf = {
  imieNazwisko: string;
  adres: string;
  numerKotla: string;
  nazwaKotla: string;
  protokol: Protokol;
};

export function formatujDateIso(iso: string) {
  const dopasowanie = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!dopasowanie) {
    return iso.trim() || "—";
  }

  return `${dopasowanie[3]}.${dopasowanie[2]}.${dopasowanie[1]}`;
}

export function nazwaPlikuPdf(nazwaRaportu: string) {
  const czysta = nazwaRaportu
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `protokol-${czysta || "serwisowy"}.pdf`;
}
