import { PDFDocument } from "pdf-lib";

export async function dolaczZalacznikPdf(protokol: Buffer, zalacznik: string) {
  const dopasowanie = /^data:application\/pdf;base64,([A-Za-z0-9+/=\s]+)$/i.exec(zalacznik.trim());
  if (!dopasowanie) {
    return protokol;
  }

  const dokument = await PDFDocument.load(protokol);
  const dodatkowy = await PDFDocument.load(Buffer.from(dopasowanie[1].replace(/\s/g, ""), "base64"));
  const strony = await dokument.copyPages(dodatkowy, dodatkowy.getPageIndices());
  strony.forEach((strona) => dokument.addPage(strona));
  return Buffer.from(await dokument.save());
}
