"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import Image from "next/image";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError("Invalid username or password");
      }
    } catch (err) {
      setError("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#003368] to-[#00DF83]"></div>
        
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-slate-100 p-4 rounded-full">
              <Lock className="w-8 h-8 text-[#003368]" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-[#003368] mb-2">Admin Portal Access</h1>
          <p className="text-center text-slate-500 text-sm mb-8">Please sign in to manage the masterclass landing page.</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-700">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] focus:bg-white transition-colors"
                placeholder="Enter admin username"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-700">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-slate-200 bg-slate-50 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#00DF83]/50 focus:border-[#00DF83] focus:bg-white transition-colors"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100 text-center">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#003368] hover:bg-[#002244] text-white font-bold py-3.5 px-6 rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? <><Loader2 className="w-5 h-5 animate-spin"/> Authenticating...</> : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
