"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { buildDynamicQR, type ParsedEMV } from "@/lib/emv";
import {
  Download,
  Check,
  Terminal,
  Share2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Props {
  template: ParsedEMV;
  amount: number;
  merchantName: string;
  merchantCity?: string;
  billNumber: string;
  hideBalance: boolean;
}

type LogLine = { text: string; type: "info" | "ok" | "dim" };

export default function QRGenerator({
  template,
  amount,
  merchantName,
  merchantCity,
  billNumber,
  hideBalance,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"processing" | "done">("processing");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [showLogs, setShowLogs] = useState(false);
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
      setShowLogs(false);

      const addLog = (text: string, type: LogLine["type"] = "info") => {
        if (cancelled || runId.current !== id) return;
        setLogs((prev) => [...prev, { text, type }]);
      };
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

      try {
        addLog("$ bangla-qr generate --amount " + amount.toFixed(2), "dim");
        await wait(200);
        setProgress(10);

        addLog("→ Loading merchant template…");
        await wait(250);
        addLog(`  name: ${merchantName}`, "dim");
        addLog(`  merchant_id: ${template.accountNumber || "—"}`, "dim");
        setProgress(25);

        addLog("→ Setting bill reference…");
        await wait(200);
        addLog(`  bill_no: ${billNumber}`, "ok");
        setProgress(40);

        addLog("→ Injecting amount + rebuilding TLV…");
        const emvString = buildDynamicQR(template, amount, billNumber);
        await wait(250);
        setProgress(55);
        addLog(`  amount: ৳${amount.toFixed(2)}`, "ok");

        addLog("→ CRC-16/CCITT-FALSE…");
        await wait(300);
        const crc = emvString.slice(-4);
        addLog(`  crc: ${crc}`, "ok");
        setProgress(70);

        addLog("→ Encoding QR matrix (ECC=H)…");
        const qrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(qrCanvas, emvString, {
          width: 400,
          margin: 2,
          color: { dark: "#0b1220", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        await wait(200);
        setProgress(82);

        addLog("→ Compositing Pathao-style card…");
        await wait(250);

        const final = canvasRef.current;
        if (!final) throw new Error("Canvas missing");
        const ctx = final.getContext("2d");
        if (!ctx) throw new Error("No 2d context");

        const scale = 2;
        const W = 420;
        // dynamic height based on hideBalance
        const H = hideBalance ? 620 : 680;
        final.width = W * scale;
        final.height = H * scale;
        final.style.width = `${W}px`;
        final.style.height = `${H}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(scale, scale);

        // Background gradient (Pathao-like teal)
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#e6f7f4");
        bg.addColorStop(0.45, "#f0faf8");
        bg.addColorStop(1, "#ffffff");
        ctx.fillStyle = bg;
        roundRectPath(ctx, 0, 0, W, H, 28);
        ctx.fill();

        // Pathao Pay wordmark area
        ctx.fillStyle = "#0066FF";
        ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("pathao pay", W / 2, 42);

        // small accent under logo
        ctx.fillStyle = "#00A86B";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillText("BANGLA QR", W / 2, 60);

        ctx.fillStyle = "#334155";
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillText("Scan to pay", W / 2, 82);

        // QR frame
        const qrSize = 280;
        const qrX = (W - qrSize) / 2;
        const qrY = 100;

        // white card behind QR
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0,0,0,0.08)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
        roundRectPath(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 20);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // blue corner accents
        ctx.strokeStyle = "#3B82F6";
        ctx.lineWidth = 3;
        const f = 18;
        const fx = qrX - 8;
        const fy = qrY - 8;
        const fw = qrSize + 16;
        // top-left
        ctx.beginPath();
        ctx.moveTo(fx, fy + f);
        ctx.lineTo(fx, fy);
        ctx.lineTo(fx + f, fy);
        ctx.stroke();
        // top-right
        ctx.beginPath();
        ctx.moveTo(fx + fw - f, fy);
        ctx.lineTo(fx + fw, fy);
        ctx.lineTo(fx + fw, fy + f);
        ctx.stroke();
        // bottom-left
        ctx.beginPath();
        ctx.moveTo(fx, fy + fw - f);
        ctx.lineTo(fx, fy + fw);
        ctx.lineTo(fx + f, fy + fw);
        ctx.stroke();
        // bottom-right
        ctx.beginPath();
        ctx.moveTo(fx + fw - f, fy + fw);
        ctx.lineTo(fx + fw, fy + fw);
        ctx.lineTo(fx + fw, fy + fw - f);
        ctx.stroke();

        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

        // Center Bangla QR logo (white pad + logo text mark)
        const logoBox = 56;
        const lx = qrX + (qrSize - logoBox) / 2;
        const ly = qrY + (qrSize - logoBox) / 2;
        ctx.fillStyle = "#ffffff";
        roundRectPath(ctx, lx, ly, logoBox, logoBox, 10);
        ctx.fill();
        // mini logo drawing
        ctx.fillStyle = "#DC2626";
        ctx.font = "bold 8px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("BANGLA", lx + logoBox / 2, ly + 16);
        ctx.strokeStyle = "#16A34A";
        ctx.lineWidth = 2.5;
        // simple QR-ish mark
        ctx.strokeRect(lx + 14, ly + 20, 10, 10);
        ctx.strokeRect(lx + 32, ly + 20, 10, 10);
        ctx.strokeRect(lx + 14, ly + 36, 10, 10);
        ctx.fillStyle = "#DC2626";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillText("QR", lx + logoBox / 2, ly + 42);

        // Info card
        const infoY = qrY + qrSize + 36;
        const cardX = 28;
        const cardW = W - 56;

        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0,0,0,0.06)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 2;
        const cardH = hideBalance ? 110 : 150;
        roundRectPath(ctx, cardX, infoY, cardW, cardH, 16);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        ctx.textAlign = "left";
        const labelX = cardX + 18;
        const valueX = cardX + cardW - 18;

        const row = (label: string, value: string, y: number) => {
          ctx.fillStyle = "#64748b";
          ctx.font = "12px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(label, labelX, y);
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 13px system-ui, sans-serif";
          ctx.textAlign = "right";
          const maxW = cardW - 120;
          let v = value;
          if (ctx.measureText(v).width > maxW) {
            while (ctx.measureText(v + "…").width > maxW && v.length > 3) {
              v = v.slice(0, -1);
            }
            v += "…";
          }
          ctx.fillText(v, valueX, y);
        };

        row("Name", merchantName || "—", infoY + 28);
        row("Merchant ID", template.accountNumber || "—", infoY + 54);
        row("Bill No", billNumber || "—", infoY + 80);

        if (!hideBalance) {
          // Amount highlight
          const ay = infoY + 112;
          ctx.fillStyle = "#ecfdf5";
          roundRectPath(ctx, cardX + 12, ay - 18, cardW - 24, 36, 10);
          ctx.fill();
          ctx.fillStyle = "#006A4E";
          ctx.font = "bold 18px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            `৳ ${amount.toLocaleString("en-BD", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            W / 2,
            ay + 6
          );
        }

        // Footer
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "Generated by Bangla QR · Rahat",
          W / 2,
          H - 24
        );

        const dataUrl = final.toDataURL("image/png", 1.0);
        setProgress(100);
        addLog("✓ QR card ready", "ok");
        await wait(180);

        if (cancelled || runId.current !== id) return;
        setQrDataUrl(dataUrl);
        setPhase("done");
      } catch (err) {
        console.error(err);
        addLog("✗ Failed: " + String(err), "info");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    template,
    amount,
    merchantName,
    merchantCity,
    billNumber,
    hideBalance,
  ]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.download = `BanglaQR-${merchantName}-${amount.toFixed(2)}.png`;
    a.href = qrDataUrl;
    a.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleShare = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `BanglaQR-${amount.toFixed(2)}.png`, {
        type: "image/png",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Bangla QR",
          text: `${merchantName} — ৳${amount.toFixed(2)}`,
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <canvas ref={canvasRef} className="hidden" />

      {phase === "processing" ? (
        <div className="w-full max-w-[420px] glass rounded-3xl overflow-hidden border border-white/10">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-black/30 border-b border-white/10">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <div className="flex items-center gap-1.5 ml-2 text-xs text-slate-400">
              <Terminal className="w-3.5 h-3.5" />
              qr-engine
            </div>
          </div>
          <div className="px-4 py-3 font-mono text-[11px] sm:text-xs leading-relaxed min-h-[130px] max-h-[170px] overflow-y-auto space-y-0.5">
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
          <div className="px-4 pb-4">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
              <span>Building payload</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="relative w-full max-w-[420px]">
            <div className="absolute -inset-1 bg-gradient-to-b from-emerald-500/15 to-transparent rounded-3xl blur-xl opacity-50" />
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="Bangla QR"
                className="relative w-full h-auto rounded-3xl shadow-2xl shadow-black/40"
              />
            )}
          </div>

          <div className="flex gap-3 w-full max-w-[420px]">
            <button
              onClick={handleDownload}
              disabled={!qrDataUrl}
              className="btn-glow flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold disabled:opacity-50"
            >
              {downloaded ? (
                <>
                  <Check className="w-5 h-5" />
                  Saved
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download
                </>
              )}
            </button>
            <button
              onClick={handleShare}
              disabled={!qrDataUrl}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white font-medium hover:bg-white/15 disabled:opacity-50"
            >
              <Share2 className="w-5 h-5" />
              Share
            </button>
          </div>

          {/* Logs toggle */}
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
          >
            <Terminal className="w-3.5 h-3.5" />
            Logs
            {showLogs ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showLogs && (
            <div className="w-full max-w-[420px] glass rounded-2xl overflow-hidden border border-white/10">
              <div className="flex items-center gap-2 px-3 py-2 bg-black/30 border-b border-white/10 text-xs text-slate-400">
                <Terminal className="w-3.5 h-3.5" />
                process log
              </div>
              <div className="px-3 py-2 font-mono text-[11px] leading-relaxed max-h-[160px] overflow-y-auto space-y-0.5">
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
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
