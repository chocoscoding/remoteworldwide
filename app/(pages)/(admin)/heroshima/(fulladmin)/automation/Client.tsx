"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

// Set your backend base URL here
const BASE_URL = process.env.NEXT_PUBLIC_AUTOMATION_URL;

export async function getAdminToken(password: string) {
  try {
    const res = await fetch(`${BASE_URL}/generate-admin-token?password=${encodeURIComponent(password)}`);
    if (!res.ok) throw new Error("Failed to get token");
    const data = await res.json();
    return data.token;
  } catch (error: any) {
    throw new Error(error.message || "Unknown error while getting token");
  }
}

export async function triggerJobPosting(token: string) {
  try {
    const res = await fetch(`${BASE_URL}/trigger`, {
      headers: { "x-admin-token": token },
    });
    const response = await res.json();
    return response;
  } catch (error: any) {
    return { success: false, message: error.message || "Unknown error while triggering job posting" };
  }
}

const COOLDOWN_KEY = "automation_cooldown_until";

const AutomationClient = () => {
  const [cooldownUntil, setCooldownUntil] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = localStorage.getItem(COOLDOWN_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [tokenMessage, setTokenMessage] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownUntil > now) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [cooldownUntil, now]);
  useEffect(() => {
    if (cooldownUntil > now) {
      const timeout = setTimeout(() => setCooldownUntil(0), cooldownUntil - now);
      return () => clearTimeout(timeout);
    }
  }, [cooldownUntil, now]);

  const handleTrigger = async () => {
    setLoading(true);
    const toast1 = toast.info("Triggering automation...");

    try {
      const token = process.env.NEXT_PUBLIC_AUTOMATION_TOKEN;
      if (!token) {
        toast.error("Admin token not found. Please log in.", {
          updateId: toast1,
          autoClose: 3500,
        });
        setLoading(false);
        return;
      }
      const res = await triggerJobPosting(token);
      if (res.success) {
        toast.success("Jobs posted successfully!", {
          updateId: toast1,
          position: "bottom-right",
          autoClose: 3500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
        const until = Date.now() + 60 * 1000;
        setCooldownUntil(until);
        localStorage.setItem(COOLDOWN_KEY, until.toString());
      } else if (res.loginUrl) {
        const url = res.loginUrl.startsWith("http") ? res.loginUrl : BASE_URL + res.loginUrl;
        window.open(url, "_blank");
      } else {
        toast.error(res.message || "Failed.", { updateId: toast1, autoClose: 3500 });
      }
    } catch (e: any) {
      toast.error("Error: " + e.message, { updateId: toast1, autoClose: 3500 });
    }
    setLoading(false);
  };

  const handleGenerateToken = async () => {
    const toast1 = toast.info("Generating token...", {
      autoClose: 5000,
    });
    setTokenMessage("");
    setGeneratedToken(null);
    try {
      const token = await getAdminToken(password);
      localStorage.setItem("admin_token", token);
      setGeneratedToken(token);
      toast.success("Token generated and saved!", {
        updateId: toast1,
        position: "bottom-right",
        autoClose: 3500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      setTokenMessage("Token generated and saved!");
    } catch (e: any) {
      toast.error("Error: " + e.message, {
        updateId: toast1,
      });
      setTokenMessage("Error: " + e.message);
    }
  };

  const isCooldown = cooldownUntil > now;

  return (
    <div className="w-full h-screen overflow-y-scroll p-4">
      <h1 className="text-2xl font-bold mb-4">Automation Controls</h1>

      <section className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm max-w-screen-lg mb-6">
        <h2 className="text-lg font-semibold mb-3 text-primary">Job Posting Automation</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTrigger();
          }}
          className="space-y-4">
          <div className="flex flex-col gap-2 items-stretch">
            <button
              type="submit"
              disabled={loading || isCooldown}
              className="drop-shadow-primary2-hover flex items-center justify-center transition-all bg-transparent hover:bg-transparent text-black text-center border-2 border-primary font-bold h-12 rounded px-4 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed w-full">
              Trigger Automation
            </button>
            {isCooldown && <span className="text-sm text-gray-600 mt-2">Cooldown: {Math.ceil((cooldownUntil - now) / 1000)}s</span>}
          </div>
          {message && (
            <div
              className={`w-full px-4 py-2 rounded text-center text-sm ${
                message.toLowerCase().includes("success") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
              {message}
            </div>
          )}
        </form>
      </section>

      <section className="mb-10 border border-gray-200 rounded-lg p-4 bg-white shadow-sm max-w-screen-lg">
        <h2 className="text-lg font-semibold mb-1 text-primary">Generate Admin Token</h2>
        <p className="text-red-500 mb-3">Do this to only to generate a new token for automation</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerateToken();
          }}
          className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary">Encryption text</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Encryption text"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div className="flex flex-col gap-2 items-stretch">
            {generatedToken && (
              <>
                <div className="w-full break-all text-center text-black bg-gray-100 border rounded px-3 py-2 select-all mt-2">
                  {generatedToken}
                </div>
              </>
            )}
            {tokenMessage && (
              <div
                className={`w-full px-4 py-2 rounded text-center text-sm outline-1 outline mb-4 ${
                  tokenMessage.toLowerCase().includes("saved")
                    ? "outline-green-500 bg-green-100 text-green-900"
                    : "bg-red-100 text-red-900 outline-red-700"
                }`}>
                {tokenMessage}
              </div>
            )}
            <button
              type="submit"
              className="drop-shadow-primary2-hover transition-all bg-neutral-800 hover:bg-black text-white border-2 border-primary font-bold h-10 rounded-sm px-4 w-full hover:rounded">
              Generate Token
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default AutomationClient;
