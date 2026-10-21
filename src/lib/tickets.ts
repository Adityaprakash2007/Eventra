import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { TicketShape } from "./api";

/** Brand palette (matches the app's primary indigo). */
const BRAND: [number, number, number] = [79, 70, 229];
const INK: [number, number, number] = [15, 23, 42];

/** In-app URL for a ticket (email/QR deep links). */
export function ticketUrl(t: TicketShape) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/tickets/${t.registrationId}`;
}

/** Render the QR code as a data URL for a ticket code. */
export async function qrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, { errorCorrectionLevel: "M", margin: 1, width: 480 });
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Download a branded PDF e-ticket: header band, event/attendee details,
 * QR code, and ticket footer. Pure client-side (jsPDF).
 */
export async function downloadTicketPdf(t: TicketShape) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const W = doc.internal.pageSize.getWidth();

  // ── Header band ──
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 92, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Eventra", 40, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("E-Ticket · Confirmation", 40, 60);
  doc.setFontSize(9);
  doc.text(`Ticket ${t.ticketType}`, W - 40, 42, { align: "right" });

  // ── Event title ──
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  const title = doc.splitTextToSize(t.event?.title || "Event ticket", W - 80);
  doc.text(title, 40, 130);

  // ── Details grid ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const rows: [string, string][] = [
    ["Attendee", t.user?.name || "—"],
    ["Email", t.user?.email || "—"],
    ["Ticket type", t.ticketType],
    ["Status", t.status],
    ["Venue", [t.event?.venue, t.event?.city, t.event?.state].filter(Boolean).join(", ") || "—"],
    ["Starts", fmtDate(t.event?.startDate)],
    ["Booked on", fmtDate(t.registeredAt)],
    ["Amount", t.amount != null ? `₹${Number(t.amount).toLocaleString("en-IN")}` : "—"],
  ];
  let y = 160;
  for (const [k, v] of rows) {
    doc.setTextColor(110, 118, 138);
    doc.text(k.toUpperCase(), 40, y);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "semibold");
    const lines = doc.splitTextToSize(v, W - 200);
    doc.text(lines, 170, y);
    doc.setFont("helvetica", "normal");
    y += Math.max(1, lines.length) * 14 + 6;
  }

  // ── QR code block ──
  const qr = t.ticketCode ? await qrDataUrl(t.ticketCode) : null;
  const boxX = W - 200;
  const boxY = 140;
  doc.setDrawColor(226, 230, 240);
  doc.roundedRect(boxX - 16, boxY - 16, 160, 176, 10, 10);
  if (qr) {
    doc.addImage(qr, "PNG", boxX, boxY, 128, 128);
  }
  doc.setFontSize(8);
  doc.setTextColor(110, 118, 138);
  doc.text("Scan at the venue for entry", boxX + 64, boxY + 146, { align: "center" });

  // ── Ticket code strip ──
  y = Math.max(y + 20, 360);
  doc.setFillColor(245, 246, 250);
  doc.roundedRect(40, y, W - 80, 64, 8, 8, "F");
  doc.setFontSize(9);
  doc.setTextColor(110, 118, 138);
  doc.text("TICKET CODE", 56, y + 24);
  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(t.ticketCode || "—", 56, y + 46);

  // ── Footer ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 146, 160);
  doc.text(
    `Registration #${t.registrationId} · Show this QR code at the entrance. Screenshots accepted.`,
    40,
    doc.internal.pageSize.getHeight() - 30
  );

  doc.save(`eventra-ticket-${t.registrationId}.pdf`);
}
