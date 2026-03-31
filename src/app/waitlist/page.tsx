"use client";

import { useState, useRef } from "react";

const FEATURES = [
  {
    icon: "🔍",
    title: "Dish-First Discovery",
    description:
      "Search by dish, not restaurant. Find 'high-protein chicken bowl' — not 'restaurants near me'.",
  },
  {
    icon: "🛡️",
    title: "Dietary Safety Filters",
    description:
      "Gluten-free, halal, kosher, keto, vegan, nut-free — filter by one or combine many. Zero compromise.",
  },
  {
    icon: "🤖",
    title: "AI Macro Estimation",
    description:
      "Know the calories, protein, carbs, and fat before you order. Powered by AI vision analysis.",
  },
];

const STATS = [
  { value: "120M+", label: "Americans with dietary restrictions" },
  { value: "0", label: "Apps that search by dish + diet + macros" },
  { value: "1", label: "App that will. This one." },
];

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;

    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          referredBy:
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("ref")
              : null,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setPosition(data.position ?? null);
        setReferralCode(data.referralCode ?? null);
        setMessage(data.message || "You're on the list!");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  function copyReferralLink() {
    if (!referralCode) return;
    const link = `${window.location.origin}/waitlist?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
  }

  return (
    <div className="min-h-screen bg-[#0F1923] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#E8634A]/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#1B4B5A]/30 blur-[100px] pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-6 pt-16 pb-20 text-center">
          {/* Logo */}
          <div className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E8634A] to-[#F5B731] flex items-center justify-center text-xl font-black">
              F
            </div>
            <span className="text-2xl font-bold tracking-tight">FoodClaw</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-5">
            Stop searching restaurants.
            <br />
            <span className="bg-gradient-to-r from-[#E8634A] to-[#F5B731] bg-clip-text text-transparent">
              Start finding dishes.
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-lg mx-auto mb-10 leading-relaxed">
            The first app that finds dishes — not restaurants — filtered by your
            exact dietary needs, macros, and real-time availability.
          </p>

          {/* Email form */}
          {status === "success" ? (
            <div className="max-w-md mx-auto space-y-4">
              <div className="bg-[#4CAF82]/10 border border-[#4CAF82]/30 rounded-2xl p-6">
                <p className="text-[#4CAF82] font-semibold text-lg mb-1">
                  You&apos;re in!
                </p>
                {position && (
                  <p className="text-white/60 text-sm">
                    You&apos;re #{position} on the waitlist
                  </p>
                )}
              </div>

              {referralCode && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                  <p className="text-sm text-white/80 font-medium">
                    Move up the list — share with friends:
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/waitlist?ref=${referralCode}`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 truncate"
                    />
                    <button
                      onClick={copyReferralLink}
                      className="px-4 py-2 bg-[#E8634A] hover:bg-[#d4553e] text-white text-sm font-medium rounded-lg transition-colors shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="text-xs text-white/40 space-y-1">
                    <p>3 referrals → Early access</p>
                    <p>5 referrals → Lifetime free premium</p>
                    <p>10 referrals → Founding Member status</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="max-w-md mx-auto flex gap-2"
            >
              <input
                ref={inputRef}
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 h-12 px-4 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8634A]/50 focus:border-[#E8634A]/50 transition-all"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="h-12 px-6 bg-gradient-to-r from-[#E8634A] to-[#d4553e] hover:from-[#d4553e] hover:to-[#c04a35] text-white font-semibold rounded-xl transition-all disabled:opacity-50 shrink-0"
              >
                {status === "loading" ? "..." : "Join Waitlist"}
              </button>
            </form>
          )}

          {status === "error" && (
            <p className="text-[#E85D3A] text-sm mt-3">{message}</p>
          )}

          <p className="text-white/30 text-xs mt-4">
            Free to join. No spam. Launching in Denver first.
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto px-6 py-8 grid grid-cols-3 gap-6 text-center">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#E8634A] to-[#F5B731] bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-white/40 mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
          Why FoodClaw?
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
            >
              <span className="text-3xl mb-4 block">{f.icon}</span>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Who is this for */}
      <section className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Built for people who eat with intention
          </h2>
          <p className="text-white/50 max-w-lg mx-auto mb-10">
            Whether you track macros, manage allergies, follow halal or kosher,
            or just want to know what you&apos;re eating.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Macro Trackers",
              "Celiac / Gluten-Free",
              "Halal Observers",
              "Kosher Observers",
              "Keto / Low-Carb",
              "Vegan / Vegetarian",
              "Nut-Free / Allergy",
              "High-Protein Goals",
            ].map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/70"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#E8634A] to-[#F5B731] flex items-center justify-center text-xs font-black">
              F
            </div>
            <span className="font-semibold">FoodClaw</span>
          </div>
          <p className="text-white/30 text-xs">
            Launching 2026 in Denver, CO. Dish-first food discovery.
          </p>
          <div className="flex justify-center gap-6 mt-4 text-sm text-white/40">
            <a href="https://instagram.com/foodclaw" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Instagram</a>
            <a href="https://tiktok.com/@foodclawapp" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">TikTok</a>
            <a href="https://x.com/foodclaw" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">X</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
