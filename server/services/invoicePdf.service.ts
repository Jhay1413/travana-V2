import PDFDocument from "pdfkit";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "../config/s3";

export interface WithdrawalInvoiceData {
  withdrawalId: string;
  requestedAt: Date | null;
  processedAt: Date | null;
  // Client
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  // Amounts
  amount: string;
  method: string;
  // Bank transfer
  accountName: string | null;
  accountNumber: string | null;
  sortCode: string | null;
  transferReference: string | null;
  // Booking
  bookingHaysRef: string | null;
  bookingSupplierRef: string | null;
  travelDate: string | null;
  // Referred person
  referredName: string | null;
  referredEmail: string | null;
}

function formatCurrency(value: string | null): string {
  const num = parseFloat(value ?? "0");
  return `£${num.toFixed(2)}`;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function formatMethod(method: string): string {
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "booking_credit") return "Booking Credit";
  return method;
}

/** Generates a PDF invoice Buffer for a processed referral withdrawal. */
export async function generateWithdrawalInvoiceBuffer(data: WithdrawalInvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_WIDTH = doc.page.width - 100; // margins
    const GREY = "#6B7280";
    const BLACK = "#111827";
    const ACCENT = "#4F46E5";
    const LIGHT = "#F3F4F6";

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fillColor(ACCENT)
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Tina's Travel", 50, 50);

    doc
      .fillColor(GREY)
      .fontSize(9)
      .font("Helvetica")
      .text("Referral Withdrawal Invoice", 50, 78);

    // Invoice number + date block (top right)
    const invoiceNo = `INV-${data.withdrawalId.slice(0, 8).toUpperCase()}`;
    doc
      .fillColor(BLACK)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(invoiceNo, 400, 50, { width: 145, align: "right" });
    doc
      .fillColor(GREY)
      .font("Helvetica")
      .fontSize(8)
      .text(`Issued: ${formatDate(data.processedAt)}`, 400, 65, { width: 145, align: "right" });
    doc
      .text(`Requested: ${formatDate(data.requestedAt)}`, 400, 77, { width: 145, align: "right" });

    // Divider
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor("#E5E7EB").lineWidth(1).stroke();

    // ── Client Details ────────────────────────────────────────────────────
    let y = 116;
    doc.fillColor(GREY).fontSize(8).font("Helvetica-Bold").text("PAYEE", 50, y);
    y += 14;
    doc.fillColor(BLACK).fontSize(10).font("Helvetica-Bold").text(data.clientName, 50, y);
    y += 14;
    doc.fillColor(GREY).fontSize(8).font("Helvetica");
    if (data.clientEmail) { doc.text(data.clientEmail, 50, y); y += 12; }
    if (data.clientPhone) { doc.text(data.clientPhone, 50, y); y += 12; }

    // ── Payment Method Block (right side) ─────────────────────────────────
    let ry = 116;
    doc.fillColor(GREY).fontSize(8).font("Helvetica-Bold").text("PAYMENT METHOD", 320, ry, { width: 225, align: "left" });
    ry += 14;
    doc.fillColor(BLACK).fontSize(10).font("Helvetica-Bold").text(formatMethod(data.method), 320, ry, { width: 225 });
    ry += 14;
    doc.font("Helvetica").fontSize(8).fillColor(GREY);
    if (data.method === "bank_transfer") {
      if (data.accountName) { doc.text(`Account: ${data.accountName}`, 320, ry, { width: 225 }); ry += 12; }
      if (data.sortCode) { doc.text(`Sort code: ${data.sortCode}`, 320, ry, { width: 225 }); ry += 12; }
      if (data.accountNumber) { doc.text(`Account no: ${data.accountNumber}`, 320, ry, { width: 225 }); ry += 12; }
      if (data.transferReference) { doc.text(`Reference: ${data.transferReference}`, 320, ry, { width: 225 }); ry += 12; }
    }

    // ── Booking Details ──────────────────────────────────────────────────
    y = Math.max(y, ry) + 20;

    // Section background
    doc.rect(50, y, PAGE_WIDTH, 14).fill(LIGHT);
    doc
      .fillColor(GREY)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("BOOKING DETAILS", 56, y + 3);
    y += 22;

    const row = (label: string, value: string | null) => {
      if (!value) return;
      doc.fillColor(GREY).fontSize(8).font("Helvetica").text(label, 56, y, { width: 180 });
      doc.fillColor(BLACK).fontSize(8).font("Helvetica").text(value, 240, y, { width: 300 });
      y += 14;
    };

    row("Hays Reference", data.bookingHaysRef);
    row("Supplier Reference", data.bookingSupplierRef);
    row("Travel Date", data.travelDate ? formatDate(data.travelDate) : null);
    row("Referred Client", data.referredName);
    row("Referred Email", data.referredEmail);

    // ── Amount Table ─────────────────────────────────────────────────────
    y += 10;
    // Table header
    doc.rect(50, y, PAGE_WIDTH, 20).fill(ACCENT);
    doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold")
      .text("Description", 56, y + 6, { width: 300 })
      .text("Amount", 350, y + 6, { width: 145, align: "right" });
    y += 20;

    // Table row
    doc.rect(50, y, PAGE_WIDTH, 24).fill("#F9FAFB");
    doc.fillColor(BLACK).fontSize(9).font("Helvetica")
      .text("Referral commission withdrawal", 56, y + 7, { width: 300 })
      .text(formatCurrency(data.amount), 350, y + 7, { width: 145, align: "right" });
    y += 24;

    // Total row
    doc.rect(50, y, PAGE_WIDTH, 24).fill(LIGHT);
    doc.fillColor(BLACK).fontSize(9).font("Helvetica-Bold")
      .text("Total Paid", 56, y + 7, { width: 300 })
      .text(formatCurrency(data.amount), 350, y + 7, { width: 145, align: "right" });
    y += 24;

    // ── Footer ────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 60;
    doc.moveTo(50, footerY - 10).lineTo(545, footerY - 10).strokeColor("#E5E7EB").lineWidth(1).stroke();
    doc.fillColor(GREY).fontSize(7).font("Helvetica")
      .text(
        `This is an automatically generated invoice. Invoice ID: ${invoiceNo}`,
        50,
        footerY,
        { width: PAGE_WIDTH, align: "center" }
      );

    doc.end();
  });
}

/** Uploads the invoice PDF to S3 and returns the S3 key. */
export async function uploadWithdrawalInvoice(
  withdrawalId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const s3Key = `withdrawal-invoices/${withdrawalId}.pdf`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      ContentDisposition: `attachment; filename="invoice-${withdrawalId.slice(0, 8)}.pdf"`,
    })
  );
  return s3Key;
}

/** Uploads a wallet-debit invoice PDF to S3 and returns the S3 key. */
export async function uploadWalletDebitInvoice(
  transactionId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const s3Key = `wallet-debit-invoices/${transactionId}.pdf`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      ContentDisposition: `attachment; filename="wallet-invoice-${transactionId.slice(0, 8)}.pdf"`,
    })
  );
  return s3Key;
}

export async function getInvoicePresignedUrl(s3Key: string): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      ResponseContentDisposition: `inline; filename="invoice.pdf"`,
      ResponseContentType: "application/pdf",
    }),
    { expiresIn: 60 * 15 } // 15 minutes
  );
}
