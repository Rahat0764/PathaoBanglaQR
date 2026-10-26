import { calculateCRC16 } from "./crc";

export interface ParsedEMV {
  payloadFormat: string;
  pointOfInitiation: string;
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
  accountNumber?: string;
  gui?: string;
  billNumber?: string;
}

function parseTLV(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= str.length) {
    const tag = str.slice(i, i + 2);
    const len = parseInt(str.slice(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > str.length) break;
    result[tag] = str.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return result;
}

function buildTLV(map: Record<string, string>): string {
  let out = "";
  for (const [tag, value] of Object.entries(map)) {
    if (value === undefined || value === null) continue;
    out += tag + String(value.length).padStart(2, "0") + value;
  }
  return out;
}

export function parseEMVQR(qrString: string): ParsedEMV | null {
  try {
    const cleaned = qrString.trim();
    const root = parseTLV(cleaned);
    if (!root["00"] || !root["26"]) return null;

    const mai = parseTLV(root["26"]);
    const add = root["62"] ? parseTLV(root["62"]) : {};
    const billNumber = add["01"] || add["05"] || "";

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
      accountNumber: mai["03"] || mai["01"] || "",
      gui: mai["00"] || "",
      billNumber,
    };
  } catch {
    return null;
  }
}

export function randomBillNo(len = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "DBF";
  for (let i = 0; i < len - 3; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s.slice(0, len);
}

/**
 * Build dynamic QR with new amount and optional bill number override.
 */
export function buildDynamicQR(
  template: ParsedEMV,
  amount: number | string,
  billNumber?: string
): string {
  const amountStr =
    typeof amount === "number"
      ? amount.toFixed(2)
      : parseFloat(amount).toFixed(2);

  const amountTag =
    "54" + String(amountStr.length).padStart(2, "0") + amountStr;

  // Rebuild additional data if bill number provided
  let additionalData = template.additionalData;
  if (billNumber && additionalData) {
    const add = parseTLV(additionalData);
    add["01"] = billNumber;
    // keep other subtags
    additionalData = buildTLV(add);
  } else if (billNumber && !additionalData) {
    additionalData = "01" + String(billNumber.length).padStart(2, "0") + billNumber;
  }

  const parts: string[] = [];
  parts.push("000201");
  parts.push("010212");

  const mai = template.merchantAccountInfo;
  parts.push("26" + String(mai.length).padStart(2, "0") + mai);

  if (template.mcc) {
    parts.push("52" + String(template.mcc.length).padStart(2, "0") + template.mcc);
  }
  if (template.currency) {
    parts.push(
      "53" + String(template.currency.length).padStart(2, "0") + template.currency
    );
  }

  parts.push(amountTag);

  if (template.country) {
    parts.push(
      "58" + String(template.country.length).padStart(2, "0") + template.country
    );
  }
  if (template.merchantName) {
    parts.push(
      "59" +
        String(template.merchantName.length).padStart(2, "0") +
        template.merchantName
    );
  }
  if (template.merchantCity) {
    parts.push(
      "60" +
        String(template.merchantCity.length).padStart(2, "0") +
        template.merchantCity
    );
  }
  if (additionalData) {
    parts.push(
      "62" + String(additionalData.length).padStart(2, "0") + additionalData
    );
  }

  const withoutCRC = parts.join("") + "6304";
  const crc = calculateCRC16(withoutCRC);
  return withoutCRC + crc;
}

export function isDynamic(qr: ParsedEMV): boolean {
  return qr.pointOfInitiation === "12";
}
