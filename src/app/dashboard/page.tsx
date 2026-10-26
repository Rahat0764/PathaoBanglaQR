"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { parseEMVQR, randomBillNo, type ParsedEMV } from "@/lib/emv";
import QRScanner from "@/components/QRScanner";
import QRGenerator from "@/components/QRGenerator";
import {
  LogOut,
  QrCode,
  User,
  ScanLine,
  RefreshCw,
  Wallet,
  EyeOff,
  Shuffle,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface Profile {
  id: string;
  merchant_name: string;
  merchant_city: string;
  account_number: string;
  raw_template: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [template, setTemplate] = useState<ParsedEMV | null>(null);
  const [amount, setAmount] = useState("100");
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [useRandomBill, setUseRandomBill] = useState(false);
  const [billNumber, setBillNumber] = useState("");

  const router = useRouter();
  const supabase = createClient();

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (data) {
        setProfile(data);
        const parsed = parseEMVQR(data.raw_template);
        if (parsed) {
          setTemplate(parsed);
          setBillNumber(parsed.billNumber || randomBillNo(10));
        }
      }
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/");
        return;
      }
      setUser(user);
      loadProfile(user.id);
    });
  }, [router, supabase.auth, loadProfile]);

  const handleScan = useCallback(
    async (parsed: ParsedEMV, raw: string) => {
      setShowScanner(false);
      if (!user) return;

      setSaving(true);
      const payload = {
        user_id: user.id,
        merchant_name: parsed.merchantName,
        merchant_city: parsed.merchantCity,
        account_number: parsed.accountNumber || "",
        mcc: parsed.mcc,
        currency: parsed.currency,
        country: parsed.country,
        raw_template: raw,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();

      if (!error && data) {
        setProfile(data);
        setTemplate(parsed);
        setBillNumber(parsed.billNumber || randomBillNo(10));
        setGenerated(false);
      } else {
        alert("প্রোফাইল সেভ সমস্যা: " + (error?.message || "Unknown"));
      }
      setSaving(false);
    },
    [user, supabase]
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const handleGenerate = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      alert("সঠিক Amount দিন");
      return;
    }
    if (useRandomBill) {
      setBillNumber(randomBillNo(10));
    } else if (template?.billNumber) {
      setBillNumber(template.billNumber);
    }
    setGenerated(true);
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  const activeBill =
    useRandomBill || !template?.billNumber
      ? billNumber || randomBillNo(10)
      : template.billNumber;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-20 glass-strong border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center">
              <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-white text-sm sm:text-base leading-tight">
                Bangla QR
              </span>
              <a
                href="https://www.linkedin.com/in/RahatAhmedX"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-500 hover:text-emerald-400 transition"
              >
                made by Rahat
              </a>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 hover:text-red-400 transition px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 sm:py-10 space-y-6">
        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-emerald-400 mb-3">
                <User className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">
                  Profile
                </span>
              </div>
              {profile ? (
                <div className="space-y-1.5">
                  <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
                    {profile.merchant_name}
                  </h2>
                  <p className="text-sm text-slate-400">{profile.merchant_city}</p>
                  <p className="text-xs text-slate-500 font-mono truncate">
                    {profile.account_number}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  প্রথমে Dynamic Bangla QR স্ক্যান/আপলোড করুন
                </p>
              )}
            </div>
            <button
              onClick={() => setShowScanner(true)}
              disabled={saving}
              className="shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition text-sm font-medium disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ScanLine className="w-4 h-4" />
              )}
              <span>{profile ? "Update" : "Scan QR"}</span>
            </button>
          </div>
        </section>

        {template ? (
          <section className="glass rounded-3xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 text-emerald-400">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">
                Generate QR
              </span>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Amount (৳)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-medium">
                  ৳
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setGenerated(false);
                  }}
                  className="input-glass w-full pl-10 pr-4 py-3.5 rounded-2xl text-xl font-semibold"
                  placeholder="500.00"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[50, 100, 200, 500, 1000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setAmount(String(v));
                    setGenerated(false);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
                    amount === String(v)
                      ? "bg-emerald-500 text-white"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  ৳{v}
                </button>
              ))}
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-white font-medium">Hide balance</p>
                    <p className="text-[11px] text-slate-500">
                      QR কার্ডে amount দেখাবে না
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={hideBalance}
                  onChange={(e) => {
                    setHideBalance(e.target.checked);
                    setGenerated(false);
                  }}
                  className="w-5 h-5 accent-emerald-500"
                />
              </label>

              <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Shuffle className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-white font-medium">
                      Random Bill No
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {useRandomBill
                        ? `এখন: ${billNumber || "—"}`
                        : "অফ = আসল bill no"}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={useRandomBill}
                  onChange={(e) => {
                    setUseRandomBill(e.target.checked);
                    if (e.target.checked) setBillNumber(randomBillNo(10));
                    else if (template.billNumber)
                      setBillNumber(template.billNumber);
                    setGenerated(false);
                  }}
                  className="w-5 h-5 accent-emerald-500"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              className="btn-glow w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-base"
            >
              Generate QR
            </button>

            {generated && (
              <div className="pt-2 flex justify-center">
                <QRGenerator
                  template={template}
                  amount={parseFloat(amount)}
                  merchantName={template.merchantName}
                  merchantCity={template.merchantCity}
                  billNumber={
                    useRandomBill ? billNumber || randomBillNo(10) : activeBill
                  }
                  hideBalance={hideBalance}
                />
              </div>
            )}
          </section>
        ) : (
          <div className="glass rounded-3xl py-16 px-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <QrCode className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              Scan বা Upload দিয়ে Dynamic QR যোগ করুন
            </p>
          </div>
        )}
      </main>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
