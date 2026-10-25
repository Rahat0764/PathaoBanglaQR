"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { parseEMVQR, type ParsedEMV } from "@/lib/emv";
import { Camera, X } from "lucide-react";

interface Props {
  onScan: (parsed: ParsedEMV, raw: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          const parsed = parseEMVQR(decodedText);
          if (parsed) {
            scanner.stop().then(() => onScan(parsed, decodedText));
          } else {
            setError("এটি বৈধ Bangla QR নয়। অন্য QR স্ক্যান করুন।");
          }
        },
        () => {}
      )
      .catch(() => {
        setError("ক্যামেরা অ্যাক্সেস করা যাচ্ছে না। অনুমতি দিন।");
      });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

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

        <div className="p-5">
          <div
            id="qr-reader"
            className="w-full rounded-2xl overflow-hidden bg-black/40"
          />
          {error && (
            <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
          )}
          <p className="mt-4 text-xs text-slate-500 text-center leading-relaxed">
            আপনার Dynamic Bangla QR কোডটি ক্যামেরার সামনে ধরুন
          </p>
        </div>
      </div>
    </div>
  );
}
