import { calculateCRC16 } from "./crc";

export interface ParsedEMV {
  payloadFormat: string;
  pointOfInitiation: string; // 11 = static, 12 = dynamic
  merchantAccountInfo: string;
  mcc: string;
  currency: string;
  amount?: string;
  country: string;
  merchantName: string;
  merchantCity: string;
  additionalData: string;
  crc: string;
  raw: string;
  // Nested useful fields
  accountNumber?: string;
  gui?: string;
}

function parseTLV(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= str.length) {
    const tag = str.slice(i, i + 2);
    const len = parseInt(str.slice(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > str.length) break;
    const value = str.slice(i + 4, i + 4 + len);
    result[tag] = value;
    i += 4 + len;
  }
  return result;
}

export function parseEMVQR(qrString: string): ParsedEMV | null {
  try {
    const cleaned = qrString.trim();
    const root = parseTLV(cleaned);

    if (!root["00"] || !root["26"]) return null;

    const mai = parseTLV(root["26"]);
    const accountNumber = mai["03"] || mai["01"] || "";
    const gui = mai["00"] || "";

    return {
      payloadFormat: root["00"] || "",
      pointOfInitiation: root["01"] || "",
      merchantAccountInfo: root["26"] || "",
      mcc: root["52"] || "",
      currency: root["53"] || "",
      amount: root["54"],
      country: root["58"] || "",
      merchantName: root["59"] || "",
      merchantCity: root["60"] || "",
      additionalData: root["62"] || "",
      crc: root["63"] || "",
      raw: cleaned,
      accountNumber,
      gui,
    };
  } catch {
    return null;
  }
}

/**
 * Build a new dynamic QR string with a new amount.
 * Keeps all other fields from the original template.
 */
export function buildDynamicQR(
  template: ParsedEMV,
  amount: number | string
): string {
  const amountStr =
    typeof amount === "number" ? amount.toFixed(2) : parseFloat(amount).toFixed(2);

  // Build Tag 54
  const amountTag = `54${String(amountStr.length).padStart(2, "0")}${amountStr}`;

  // Reconstruct the string without CRC
  // Order (common for Bangla QR):
  // 00, 01, 26, 52, 53, 54, 58, 59, 60, 62, 63

  const parts: string[] = [];

  // 00 Payload Format
  parts.push(`000201`);

  // 01 Point of Initiation → force dynamic
  parts.push(`010212`);

  // 26 Merchant Account Info (keep original)
  const mai = template.merchantAccountInfo;
  parts.push(`26${String(mai.length).padStart(2, "0")}${mai}`);

  // 52 MCC
  if (template.mcc) {
    parts.push(`52${String(template.mcc.length).padStart(2, "0")}${template.mcc}`);
  }

  // 53 Currency
  if (template.currency) {
    parts.push(`53${String(template.currency.length).padStart(2, "0")}${template.currency}`);
  }

  // 54 Amount (new)
  parts.push(amountTag);

  // 58 Country
  if (template.country) {
    parts.push(`58${String(template.country.length).padStart(2, "0")}${template.country}`);
  }

  // 59 Merchant Name
  if (template.merchantName) {
    parts.push(
      `59${String(template.merchantName.length).padStart(2, "0")}${template.merchantName}`
    );
  }

  // 60 Merchant City
  if (template.merchantCity) {
    parts.push(
      `60${String(template.merchantCity.length).padStart(2, "0")}${template.merchantCity}`
    );
  }

  // 62 Additional Data (keep original)
  if (template.additionalData) {
    parts.push(
      `62${String(template.additionalData.length).padStart(2, "0")}${template.additionalData}`
    );
  }

  // 63 CRC placeholder
  const withoutCRC = parts.join("") + "6304";
  const crc = calculateCRC16(withoutCRC);

  return withoutCRC + crc;
}

export function isDynamic(qr: ParsedEMV): boolean {
  return qr.pointOfInitiation === "12";
}
