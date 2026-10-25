"use client";

import { useEffect, useRef, useState } from "react";
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
  const started = useRef(false);

  useEffect(() => {
    if (mode !== "camera") {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      started.current = false;
      return;
    }

    if (started.current) return;
    started.current = true;
    setError(null);

    let active = true;
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!active) return;
          const parsed = parseEMVQR(decodedText);
          if (parsed) {
            active = false;
            scanner
              .stop()
              .catch(() => {})
              .finally(() => onScan(parsed, decodedText));
          } else {
            setError("এটি বৈধ Bangla QR নয়। অন্য QR স্ক্যান করুন।");
          }
        },
        () => {}
      )
      .catch(() => {
        if (active) {
          setError("ক্যামেরা চালু হয়নি। Upload ট্যাব থেকে ছবি দিন।");
        }
      });

    return () => {
      active = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      started.current = false;
    };
  }, [mode, onScan]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    e.target.value = "";

    try {
      const tempId = "qr-file-temp";
      let el = document.getElementById(tempId);
      if (!el) {
        el = document.createElement("div");
        el.id = tempId;
        el.style.display = "none";
        document.body.appendChild(el);
      }

      const scanner = new Html5Qrcode(tempId);
      const decodedText = await scanner.scanFile(file, false);

      try {
        await scanner.clear();
      } catch {}
      try {
        el.remove();
      } catch {}

      const parsed = parseEMVQR(decodedText);
      if (parsed) {
        onScan(parsed, decodedText);
      } else {
        setError("এই ছবিতে বৈধ Bangla QR পাওয়া যায়নি।");
      }
    } catch (err) {
      console.error("File scan error:", err);
      setError(
        "ছবি থেকে QR পড়া যায়নি। পরিষ্কার, সোজা ছবি দিন (স্ক্রিনশট ভালো কাজ করে)।"
      );
    } finally {
      setUploading(false);
    }
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
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 px-5 pt-4">
          <button
            type="button"
            onClick={() => {
              setMode("camera");
              setError(null);
            }}
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
            onClick={() => {
              setMode("upload");
              setError(null);
            }}
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
          {mode === "camera" ? (
            <>
              <div
                id="qr-reader"
                className="w-full rounded-2xl overflow-hidden bg-black/40 min-h-[240px]"
              />
              <p className="mt-4 text-xs text-slate-500 text-center leading-relaxed">
                Dynamic Bangla QR ক্যামেরার সামনে ধরুন
              </p>
            </>
          ) : (
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
                        স্ক্রিনশট বা গ্যালারির ছবি (PNG/JPG)
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
