"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { buildDynamicQR, type ParsedEMV } from "@/lib/emv";
import { Download, Loader2, Check } from "lucide-react";

interface Props {
  template: ParsedEMV;
  amount: number;
  merchantName: string;
  merchantCity?: string;
}

export default function QRGenerator({
  template,
  amount,
  merchantName,
  merchantCity,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    async function generate() {
      setLoading(true);
      setDownloaded(false);
      try {
        const emvString = buildDynamicQR(template, amount);

        const qrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(qrCanvas, emvString, {
          width: 320,
          margin: 1,
          color: { dark: "#0b1220", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });

        const final = canvasRef.current;
        if (!final) return;
        const ctx = final.getContext("2d");
        if (!ctx) return;

        // High-res for crisp download
        const scale = 2;
        const W = 400;
        const H = 560;
        final.width = W * scale;
        final.height = H * scale;
        final.style.width = `${W}px`;
        final.style.height = `${H}px`;
        ctx.scale(scale, scale);

        // White card background with rounded feel (we'll clip later visually)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);

        // Top gradient bar
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, "#006A4E");
        grad.addColorStop(1, "#00A86B");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, 72);

        // Brand text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Bangla QR", W / 2, 44);

        // Subtle subtitle
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText("NPSB • Scan to Pay", W / 2, 62);

        // QR area with soft shadow simulation
        const qrSize = 300;
        const qrX = (W - qrSize) / 2;
        const qrY = 96;

        // Soft border around QR
        ctx.fillStyle = "#f1f5f9";
        ctx.beginPath();
        roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 16);
        ctx.fill();

        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

        // Merchant name
        const nameY = qrY + qrSize + 44;
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        const displayName =
          merchantName.length > 28
            ? merchantName.slice(0, 26) + "…"
            : merchantName;
        ctx.fillText(displayName || "Merchant", W / 2, nameY);

        // City
        if (merchantCity) {
          ctx.fillStyle = "#64748b";
          ctx.font = "13px system-ui, sans-serif";
          ctx.fillText(merchantCity, W / 2, nameY + 22);
        }

        // Amount pill
        const amountY = nameY + (merchantCity ? 56 : 40);
        const amountText = `৳ ${amount.toLocaleString("en-BD", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
        ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
        const textW = ctx.measureText(amountText).width;
        const pillW = textW + 40;
        const pillH = 44;
        const pillX = (W - pillW) / 2;

        // Pill background
        ctx.fillStyle = "#ecfdf5";
        ctx.beginPath();
        roundRect(ctx, pillX, amountY - 30, pillW, pillH, 22);
        ctx.fill();

        // Pill border
        ctx.strokeStyle = "#a7f3d0";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#006A4E";
        ctx.fillText(amountText, W / 2, amountY);

        // Bottom thin line
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, H - 40);
        ctx.lineTo(W - 40, H - 40);
        ctx.stroke();

        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillText("Powered by Bangla QR Generator", W / 2, H - 20);

        setQrDataUrl(final.toDataURL("image/png", 1.0));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    generate();
  }, [template, amount, merchantName, merchantCity]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `BanglaQR-${amount.toFixed(2)}.png`;
    link.href = qrDataUrl;
    link.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {loading ? (
        <div className="w-full max-w-[400px] aspect-[400/560] glass rounded-3xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="relative w-full max-w-[400px]">
          <div className="absolute -inset-1 bg-gradient-to-b from-emerald-500/20 to-transparent rounded-3xl blur-xl opacity-60" />
          <canvas
            ref={canvasRef}
            className="relative w-full h-auto rounded-3xl shadow-2xl shadow-black/40"
          />
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={loading || !qrDataUrl}
        className="btn-glow flex items-center justify-center gap-2 w-full max-w-[400px] py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold disabled:opacity-50 transition"
      >
        {downloaded ? (
          <>
            <Check className="w-5 h-5" />
            Downloaded
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Download QR
          </>
        )}
      </button>
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
