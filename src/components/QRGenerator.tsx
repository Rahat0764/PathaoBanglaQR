"use client";

import { useEffect, useRef, useState } from "react";
import type { StaticImageData } from "next/image";
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

import backgroundAsset from "../../assets/background.png";
import banglaQrAsset from "../../assets/banglaqr.png";
import pathaoAsset from "../../assets/pathao.png";
import npsbAsset from "../../assets/npsb.png";

interface Props {
  template: ParsedEMV;
  amount: number;
  merchantName: string;
  merchantCity?: string;
  billNumber: string;
  hideBalance: boolean;
}

type LogLine = { text: string; type: "info" | "ok" | "dim" };

function resolveAssetSrc(asset: StaticImageData | string): string {
  return typeof asset === "string" ? asset : asset.src;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function buildQrFileName(
  merchantName: string,
  amount: number,
  billNumber: string
): string {
  const sanitize = (val: string, fallback: string) =>
    (val || fallback)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ");

  const namePart = sanitize(merchantName, "Merchant");
  const amountPart = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2);
  const billPart = sanitize(billNumber, "BILL");

  return `${namePart}-${amountPart}-${billPart}.jpg`;
}

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
        await wait(160);
        setProgress(10);

        addLog("→ Loading brand & background assets…");
        const [bgImg, banglaQrImg, pathaoImg, npsbImg] = await Promise.all([
          loadImage(resolveAssetSrc(backgroundAsset)),
          loadImage(resolveAssetSrc(banglaQrAsset)),
          loadImage(resolveAssetSrc(pathaoAsset)),
          loadImage(resolveAssetSrc(npsbAsset)),
        ]);
        setProgress(28);

        addLog("→ Reading merchant profile…");
        await wait(160);
        addLog(`  name: ${merchantName}`, "dim");
        addLog(`  merchant_id: ${template.accountNumber || "—"}`, "dim");
        addLog(`  bill_no: ${billNumber}`, "ok");
        setProgress(45);

        addLog("→ Injecting amount + rebuilding EMV TLV…");
        const emvString = buildDynamicQR(template, amount, billNumber);
        await wait(180);
        addLog(`  amount: ৳${amount.toFixed(2)}`, "ok");

        const crc = emvString.slice(-4);
        addLog(`  crc16: ${crc}`, "ok");
        setProgress(65);

        addLog("→ Encoding high-res QR matrix (ECC=H)…");
        const qrCanvas = document.createElement("canvas");
        await QRCode.toCanvas(qrCanvas, emvString, {
          width: 800,
          margin: 2,
          color: { dark: "#0b172a", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        await wait(160);
        setProgress(82);

        addLog("→ Rendering glassmorphism card…");
        await wait(180);

        const final = canvasRef.current;
        if (!final) throw new Error("Canvas missing");
        const ctx = final.getContext("2d");
        if (!ctx) throw new Error("No 2d context");

        const cityText = (merchantCity || template.merchantCity || "").trim();
        const infoRows: Array<{ label: string; value: string; mono?: boolean }> =
          [
            { label: "Name", value: merchantName || "—" },
            {
              label: "Merchant ID",
              value: template.accountNumber || "—",
              mono: true,
            },
            { label: "Bill No", value: billNumber || "—", mono: true },
          ];
        if (cityText) {
          infoRows.push({ label: "City", value: cityText });
        }

        const scale = 3;
        const W = 440;
        const rowHeight = 36;
        const infoCardPaddingY = 16;
        const amountSectionH = hideBalance ? 0 : 68;
        const infoCardH =
          infoCardPaddingY * 2 + infoRows.length * rowHeight + amountSectionH;
        const infoY = 444;
        const H = infoY + infoCardH + 46;

        final.width = W * scale;
        final.height = H * scale;
        final.style.width = `${W}px`;
        final.style.height = `${H}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(scale, scale);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // 1. Main Full-Bleed Background (background.png)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);
        drawCoverImage(ctx, bgImg, 0, 0, W, H);

        // Helper for frosted glassmorphism panels on Canvas
        const drawGlassPanel = (
          gx: number,
          gy: number,
          gw: number,
          gh: number,
          radius: number,
          topAlpha = 0.72,
          bottomAlpha = 0.48
        ) => {
          // Outer soft drop shadow
          ctx.save();
          ctx.shadowColor = "rgba(15, 23, 42, 0.10)";
          ctx.shadowBlur = 24;
          ctx.shadowOffsetY = 8;
          ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
          roundRectPath(ctx, gx, gy, gw, gh, radius);
          ctx.fill();
          ctx.restore();

          // Clipped backdrop blur + frosted tint
          ctx.save();
          roundRectPath(ctx, gx, gy, gw, gh, radius);
          ctx.clip();

          if ("filter" in ctx) {
            ctx.filter = "blur(16px) saturate(135%)";
            drawCoverImage(ctx, bgImg, 0, 0, W, H);
            ctx.filter = "none";
          }

          const glassGrad = ctx.createLinearGradient(gx, gy, gx, gy + gh);
          glassGrad.addColorStop(0, `rgba(255, 255, 255, ${topAlpha})`);
          glassGrad.addColorStop(1, `rgba(255, 255, 255, ${bottomAlpha})`);
          ctx.fillStyle = glassGrad;
          ctx.fillRect(gx, gy, gw, gh);

          // Subtle diagonal glass reflection
          const sheen = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
          sheen.addColorStop(0, "rgba(255, 255, 255, 0.38)");
          sheen.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
          sheen.addColorStop(1, "rgba(255, 255, 255, 0.18)");
          ctx.fillStyle = sheen;
          ctx.fillRect(gx, gy, gw, gh);
          ctx.restore();

          // Luminous glass border
          ctx.save();
          roundRectPath(ctx, gx, gy, gw, gh, radius);
          const borderGrad = ctx.createLinearGradient(gx, gy, gx, gy + gh);
          borderGrad.addColorStop(0, "rgba(255, 255, 255, 0.92)");
          borderGrad.addColorStop(1, "rgba(255, 255, 255, 0.45)");
          ctx.strokeStyle = borderGrad;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        };

        // 2. Top Header Glass Bar: [pathao.png / Provider]  X  [npsb.png / Network]
        const headerX = 24;
        const headerY = 22;
        const headerW = W - 48;
        const headerH = 82;
        drawGlassPanel(headerX, headerY, headerW, headerH, 22, 0.82, 0.66);

        const centerX = W / 2;
        const leftColCenterX = headerX + (headerW / 2 - 22) / 2 + 4;
        const rightColCenterX = W - leftColCenterX;
        const logoCenterY = headerY + 33;
        const subLabelY = headerY + 67;

        // Pathao Pay logo + "Provider"
        drawContainImage(ctx, pathaoImg, leftColCenterX, logoCenterY, 122, 36);
        ctx.fillStyle = "#475569";
        ctx.font = "600 10.5px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Provider", leftColCenterX, subLabelY);

        // Center "X" mark with balanced spacing
        const xCenterY = headerY + headerH / 2 - 2;
        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.05)";
        ctx.beginPath();
        ctx.arc(centerX, xCenterY, 14, 0, Math.PI * 2);
        ctx.fill();

        const arm = 5.5;
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(centerX - arm, xCenterY - arm);
        ctx.lineTo(centerX + arm, xCenterY + arm);
        ctx.moveTo(centerX + arm, xCenterY - arm);
        ctx.lineTo(centerX - arm, xCenterY + arm);
        ctx.stroke();
        ctx.restore();

        // NPSB logo + "Network"
        drawContainImage(ctx, npsbImg, rightColCenterX, logoCenterY, 116, 36);
        ctx.fillStyle = "#475569";
        ctx.font = "600 10.5px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Network", rightColCenterX, subLabelY);

        // 3. QR Glass Frame + High-Contrast Scan Pad
        const qrFrameSize = 304;
        const qrFrameX = (W - qrFrameSize) / 2;
        const qrFrameY = 122;
        drawGlassPanel(
          qrFrameX,
          qrFrameY,
          qrFrameSize,
          qrFrameSize,
          28,
          0.68,
          0.46
        );

        // Solid crisp white inner pad so payment apps scan instantaneously
        const innerPadMargin = 14;
        const innerPadSize = qrFrameSize - innerPadMargin * 2;
        const innerPadX = qrFrameX + innerPadMargin;
        const innerPadY = qrFrameY + innerPadMargin;

        ctx.save();
        ctx.shadowColor = "rgba(15, 23, 42, 0.06)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = "#ffffff";
        roundRectPath(ctx, innerPadX, innerPadY, innerPadSize, innerPadSize, 20);
        ctx.fill();
        ctx.restore();

        // Subtle teal-blue corner scan accents
        ctx.save();
        ctx.strokeStyle = "#0d9488";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        const cLen = 16;
        const cx0 = innerPadX + 8;
        const cy0 = innerPadY + 8;
        const cw = innerPadSize - 16;

        ctx.beginPath();
        ctx.moveTo(cx0, cy0 + cLen);
        ctx.lineTo(cx0, cy0);
        ctx.lineTo(cx0 + cLen, cy0);

        ctx.moveTo(cx0 + cw - cLen, cy0);
        ctx.lineTo(cx0 + cw, cy0);
        ctx.lineTo(cx0 + cw, cy0 + cLen);

        ctx.moveTo(cx0, cy0 + cw - cLen);
        ctx.lineTo(cx0, cy0 + cw);
        ctx.lineTo(cx0 + cLen, cy0 + cw);

        ctx.moveTo(cx0 + cw - cLen, cy0 + cw);
        ctx.lineTo(cx0 + cw, cy0 + cw);
        ctx.lineTo(cx0 + cw, cy0 + cw - cLen);
        ctx.stroke();
        ctx.restore();

        // Draw QR Matrix
        const qrSize = 252;
        const qrX = (W - qrSize) / 2;
        const qrY = qrFrameY + (qrFrameSize - qrSize) / 2;
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

        // Payment-safe Center Bangla QR Logo (~3.8% area, well within 30% ECC=H budget)
        const badgeW = 48;
        const badgeH = 52;
        const badgeX = W / 2 - badgeW / 2;
        const badgeY = qrY + qrSize / 2 - badgeH / 2;

        ctx.save();
        ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
        ctx.shadowBlur = 6;
        ctx.fillStyle = "#ffffff";
        roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 10);
        ctx.fill();
        ctx.strokeStyle = "rgba(226, 232, 240, 0.95)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        drawContainImage(
          ctx,
          banglaQrImg,
          W / 2,
          qrY + qrSize / 2,
          badgeW - 8,
          badgeH - 8
        );

        // 4. Bottom Merchant Details Glassmorphism Card
        const cardX = 24;
        const cardW = W - 48;
        drawGlassPanel(cardX, infoY, cardW, infoCardH, 24, 0.66, 0.44);

        const labelX = cardX + 20;
        const valueX = cardX + cardW - 20;

        infoRows.forEach((item, index) => {
          const rowTop = infoY + infoCardPaddingY + index * rowHeight;
          const textY = rowTop + 23;

          if (index > 0) {
            ctx.save();
            ctx.strokeStyle = "rgba(15, 23, 42, 0.07)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(labelX, rowTop);
            ctx.lineTo(valueX, rowTop);
            ctx.stroke();
            ctx.restore();
          }

          ctx.fillStyle = "#475569";
          ctx.font = "500 12.5px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(item.label, labelX, textY);

          ctx.fillStyle = "#0f172a";
          ctx.font = item.mono
            ? "700 13px ui-monospace, SFMono-Regular, Menlo, monospace"
            : "700 13.5px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "right";

          const maxTextW = cardW - 135;
          let displayVal = item.value;
          if (ctx.measureText(displayVal).width > maxTextW) {
            while (
              ctx.measureText(displayVal + "…").width > maxTextW &&
              displayVal.length > 3
            ) {
              displayVal = displayVal.slice(0, -1);
            }
            displayVal += "…";
          }
          ctx.fillText(displayVal, valueX, textY);
        });

        // Amount Highlight Glass Pill (if not hidden)
        if (!hideBalance) {
          const pillX = cardX + 16;
          const pillW = cardW - 32;
          const pillY =
            infoY + infoCardPaddingY + infoRows.length * rowHeight + 10;
          const pillH = 48;

          ctx.save();
          const pillGrad = ctx.createLinearGradient(
            pillX,
            pillY,
            pillX + pillW,
            pillY + pillH
          );
          pillGrad.addColorStop(0, "rgba(13, 148, 136, 0.16)");
          pillGrad.addColorStop(1, "rgba(16, 185, 129, 0.22)");
          ctx.fillStyle = pillGrad;
          roundRectPath(ctx, pillX, pillY, pillW, pillH, 14);
          ctx.fill();

          ctx.strokeStyle = "rgba(13, 148, 136, 0.28)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = "#0f766e";
          ctx.font = "600 12px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText("Amount", pillX + 16, pillY + 29);

          ctx.fillStyle = "#065f46";
          ctx.font = "800 19px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(
            `৳ ${amount.toLocaleString("en-BD", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            pillX + pillW - 16,
            pillY + 31
          );
        }

        // 5. Subtle Footer
        ctx.fillStyle = "#64748b";
        ctx.font = "500 10.5px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "Scan to pay with any Bangla QR · NPSB supported app",
          W / 2,
          H - 18
        );

        // Export high-quality JPEG
        const dataUrl = final.toDataURL("image/jpeg", 0.95);
        setProgress(100);
        addLog("✓ Glassmorphism QR JPG ready", "ok");
        await wait(160);

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
  }, [template, amount, merchantName, merchantCity, billNumber, hideBalance]);

  const outputFileName = buildQrFileName(merchantName, amount, billNumber);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.download = outputFileName;
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
      const file = new File([blob], outputFileName, {
        type: "image/jpeg",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: outputFileName,
          text: `${merchantName} — ৳${amount.toFixed(2)} (Bill: ${billNumber})`,
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
        <div className="w-full max-w-[440px] glass rounded-3xl overflow-hidden border border-white/10">
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
          <div className="relative w-full max-w-[440px]">
            <div className="absolute -inset-1 bg-gradient-to-b from-emerald-500/20 to-transparent rounded-3xl blur-xl opacity-60" />
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={outputFileName}
                className="relative w-full h-auto rounded-3xl shadow-2xl shadow-black/40 border border-white/20"
              />
            )}
          </div>

          <div className="flex gap-3 w-full max-w-[440px]">
            <button
              onClick={handleDownload}
              disabled={!qrDataUrl}
              className="btn-glow flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold disabled:opacity-50"
            >
              {downloaded ? (
                <>
                  <Check className="w-5 h-5" />
                  Saved JPG
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download JPG
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
            <div className="w-full max-w-[440px] glass rounded-2xl overflow-hidden border border-white/10">
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

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = w / h;
  let drawW = w;
  let drawH = h;
  let offsetX = x;
  let offsetY = y;

  if (imgRatio > boxRatio) {
    drawH = h;
    drawW = h * imgRatio;
    offsetX = x - (drawW - w) / 2;
  } else {
    drawW = w;
    drawH = w / imgRatio;
    offsetY = y - (drawH - h) / 2;
  }

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

function drawContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  maxW: number,
  maxH: number
) {
  const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, centerX - w / 2, centerY - h / 2, w, h);
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
