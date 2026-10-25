"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { parseEMVQR, type ParsedEMV } from "@/lib/emv";
import { Camera, X, ImagePlus, Loader2 } from "lucide-react";

interface Props {
  onScan: (parsed: ParsedEMV, raw: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [uploading, setUploading] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  const mountedRef = useRef(true);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        if (s.isScanning) await s.stop();
      } catch {
        /* ignore */
      }
      try {
        await s.clear();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (mode !== "camera") return;

    let cancelled = false;
    const elId = "qr-reader";

    const start = async () => {
      await stopCamera();
      if (cancelled || !mountedRef.current) return;

      const el = document.getElementById(elId);
      if (!el) return;

      try {
        const scanner = new Html5Qrcode(elId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (cancelled) return;
            const parsed = parseEMVQR(decodedText);
            if (parsed) {
              cancelled = true;
              stopCamera().finally(() => {
                onScanRef.current(parsed, decodedText);
              });
            } else if (mountedRef.current) {
              setError("এটি বৈধ Bangla QR নয়।");
            }
          },
          () => {}
        );
      } catch {
        if (mountedRef.current && !cancelled) {
          setError("ক্যামেরা চালু হয়নি। Upload থেকে ছবি দিন।");
        }
      }
    };

    const t = setTimeout(start, 150);

    return () => {
      cancelled = true;
      clearTimeout(t);
      stopCamera();
    };
  }, [mode, stopCamera]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      await stopCamera();

      const tempId = "qr-upload-" + Date.now();
      const el = document.createElement("div");
      el.id = tempId;
      el.style.cssText =
        "position:fixed;left:-9999px;width:1px;height:1px;opacity:0;";
      document.body.appendChild(el);

      let decodedText = "";
      try {
        const scanner = new Html5Qrcode(tempId);
        decodedText = await scanner.scanFile(file, false);
        try {
          await scanner.clear();
        } catch {
          /* ignore */
        }
      } finally {
        try {
          el.remove();
        } catch {
          /* ignore */
        }
      }

      if (!mountedRef.current) return;

      const parsed = parseEMVQR(decodedText);
      if (parsed) {
        onScanRef.current(parsed, decodedText);
      } else {
        setError("এই ছবিতে বৈধ Bangla QR পাওয়া যায়নি।");
      }
    } catch (err) {
      console.error(err);
      if (mountedRef.current) {
        setError("ছবি পড়া যায়নি। QR স্পষ্ট দেখা যায় এমন স্ক্রিনশট দিন।");
      }
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  };

  const switchMode = (m: "camera" | "upload") => {
    setError(null);
    setMode(m);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md glass-strong rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            Scan QR Code
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 px-5 pt-4">
          <button
            type="button"
            onClick={() => switchMode("camera")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
              mode === "camera"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-white/5 text-slate-400 border border-transparent"
            }`}
          >
            <Camera className="w-4 h-4" />
            Camera
          </button>
          <button
            type="button"
            onClick={() => switchMode("upload")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
              mode === "upload"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-white/5 text-slate-400 border border-transparent"
            }`}
          >
            <ImagePlus className="w-4 h-4" />
            Upload
          </button>
        </div>

        <div className="p-5">
          <div className={mode === "camera" ? "block" : "hidden"}>
            <div
              id="qr-reader"
              className="w-full rounded-2xl overflow-hidden bg-black/40 min-h-[240px]"
            />
            <p className="mt-4 text-xs text-slate-500 text-center">
              Dynamic Bangla QR ক্যামেরার সামনে ধরুন
            </p>
          </div>

          {mode === "upload" && (
            <>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[240px] rounded-2xl border-2 border-dashed border-white/15 hover:border-emerald-500/40 bg-white/5 flex flex-col items-center justify-center gap-3 transition disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                    <p className="text-sm text-slate-300">পড়া হচ্ছে…</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                      <ImagePlus className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div className="text-center px-4">
                      <p className="text-sm font-medium text-white">
                        QR ছবি সিলেক্ট করুন
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        স্ক্রিনশট ভালো কাজ করে (PNG/JPG)
                      </p>
                    </div>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-400 text-center leading-relaxed">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
