"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { buildDynamicQR, type ParsedEMV } from "@/lib/emv";
import { Download, Check, Terminal } from "lucide-react";

interface Props {
  template: ParsedEMV;
  amount: number;
  merchantName: string;
  merchantCity?: string;
}

type LogLine = { text: string; type: "info" | "ok" | "dim" };

export default function QRGenerator({
  template,
  amount,
  merchantName,
  merchantCity,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"processing" | "done">("processing");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    const id = ++runId.current;
    let cancelled = false;

    async function run() {
      setPhase("processing");
      setProgress(0);
      setLogs([]);
      setQrDataUrl("");
      setDownloaded(false);

      const addLog = (text: string, type: LogLine["type"] = "info") => {
        if (cancelled || runId.current !== id) return;
        setLogs((prev) => [...prev, { text, type }]);
      };

      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

      try {
        addLog("$ bangla-qr generate --amount " + amount.toFixed(2), "dim");
        await wait(280);
        setProgress(8);

        addLog("→ Loading merchant template…");
        await wait(320);
        setProgress(18);
        addLog(`  merchant: ${merchantName}`, "dim");
        addLog(`  account:  ${template.accountNumber || "—"}`, "dim");
        setProgress(28);

        addLog("→ Injecting amount tag (54)…");
        await wait(300);
        const emvString = buildDynamicQR(template, amount);
        setProgress(45);
        addLog(`  amount: ৳${amount.toFixed(2)}`, "ok");

        addLog("→ Computing CRC-16/CCITT-FALSE…");
        await wait(400);
        const crc = emvString.slice(-4);
        setProgress(62);
        addLog(`  crc: ${crc}`, "ok");

        addLog("→ Encoding EMV payload → QR matrix…");
        await wait(350);
        setProgress(78);

        // Build QR offscreen first
        const qrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(qrCanvas, emvString, {
          width: 320,
          margin: 1,
          color: { dark: "#0b1220", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        setProgress(88);
        addLog("→ Rendering branded card…");
        await wait(280);

        // Ensure canvas is in DOM (always mounted now)
        const final = canvasRef.current;
        if (!final) throw new Error("Canvas not ready");

        const ctx = final.getContext("2d");
        if (!ctx) throw new Error("2D context missing");

        const scale = 2;
        const W = 400;
        const H = 560;
        final.width = W * scale;
        final.height = H * scale;
        final.style.width = `${W}px`;
        final.style.height = `${H}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(scale, scale);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);

        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, "#006A4E");
        grad.addColorStop(1, "#00A86B");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, 72);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Bangla QR", W / 2, 44);
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText("NPSB • Scan to Pay", W / 2, 62);

        const qrSize = 300;
        const qrX = (W - qrSize) / 2;
        const qrY = 96;

        ctx.fillStyle = "#f1f5f9";
        ctx.beginPath();
        roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 16);
        ctx.fill();
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

        const nameY = qrY + qrSize + 44;
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        const displayName =
          merchantName.length > 28
            ? merchantName.slice(0, 26) + "…"
            : merchantName;
        ctx.fillText(displayName || "Merchant", W / 2, nameY);

        if (merchantCity) {
          ctx.fillStyle = "#64748b";
          ctx.font = "13px system-ui, sans-serif";
          ctx.fillText(merchantCity, W / 2, nameY + 22);
        }

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

        ctx.fillStyle = "#ecfdf5";
        ctx.beginPath();
        roundRect(ctx, pillX, amountY - 30, pillW, pillH, 22);
        ctx.fill();
        ctx.strokeStyle = "#a7f3d0";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#006A4E";
        ctx.fillText(amountText, W / 2, amountY);

        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, H - 40);
        ctx.lineTo(W - 40, H - 40);
        ctx.stroke();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillText("Powered by Bangla QR Generator", W / 2, H - 20);

        const dataUrl = final.toDataURL("image/png", 1.0);
        setProgress(100);
        addLog("✓ QR ready", "ok");
        await wait(200);

        if (cancelled || runId.current !== id) return;
        setQrDataUrl(dataUrl);
        setPhase("done");
      } catch (err) {
        console.error(err);
        addLog("✗ Generation failed: " + String(err), "info");
        setProgress(0);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
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
      {/* Hidden canvas always mounted so ref works */}
      <canvas ref={canvasRef} className="hidden" />

      {phase === "processing" ? (
        <div className="w-full max-w-[400px] glass rounded-3xl overflow-hidden border border-white/10">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-black/30 border-b border-white/10">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <div className="flex items-center gap-1.5 ml-2 text-xs text-slate-400">
              <Terminal className="w-3.5 h-3.5" />
              <span>qr-engine</span>
            </div>
          </div>

          {/* Logs */}
          <div className="px-4 py-3 font-mono text-[11px] sm:text-xs leading-relaxed min-h-[140px] max-h-[180px] overflow-y-auto space-y-0.5">
            {logs.map((line, i) => (
              <div
                key={i}
                className={
                  line.type === "ok"
                    ? "text-emerald-400"
                    : line.type === "dim"
                      ? "text-slate-500"
                      : "text-slate-300"
                }
              >
                {line.text}
              </div>
            ))}
            <div className="text-emerald-400/60 animate-pulse">▌</div>
          </div>

          {/* Progress bar */}
          <div className="px-4 pb-4">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
              <span>Building payload</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-[400px]">
          <div className="absolute -inset-1 bg-gradient-to-b from-emerald-500/20 to-transparent rounded-3xl blur-xl opacity-60" />
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Bangla QR"
              className="relative w-full h-auto rounded-3xl shadow-2xl shadow-black/40"
            />
          )}
        </div>
      )}

      {phase === "done" && (
        <button
          onClick={handleDownload}
          disabled={!qrDataUrl}
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
      )}
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
