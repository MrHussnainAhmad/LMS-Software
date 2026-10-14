import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { api, setAuthTokens, runInitialSync } from '../utils/api';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    
    setLoading(true);
    try {
      const resp = await api.post('/auth/login', {
        emailOrUsername: email,
        password: password,
        roleHint: 'INSTITUTION',
        returnTokens: true
      });
      
      if ((resp.token || resp.accessToken) && resp.refreshToken) {
        const token = resp.token || resp.accessToken;
        setAuthTokens(token, resp.refreshToken);
        sessionStorage.removeItem('campus_view');
        sessionStorage.removeItem('campus_name');
        localStorage.setItem('password_change_required', resp.mustChangePassword ? '1' : '0');
        if (resp.mustChangePassword) {
          window.dispatchEvent(new Event('auth-changed'));
          navigate('/change-password');
          return;
        }
        window.dispatchEvent(new Event('auth-changed'));
        setSyncing(true);
        try {
          await runInitialSync(token);
        } catch (syncErr: any) {
          setError(syncErr?.message || 'Login succeeded but data sync failed. Check internet and try again.');
          setLoading(false);
          setSyncing(false);
          return;
        }
        setSyncing(false);
        navigate('/dashboard');
      } else {
        throw new Error("No access token received from server");
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex w-full">
      {/* ── Left Panel – Campus Visual ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="./images/campus-bg.png"
          alt="Institution campus"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 via-blue-900/60 to-slate-900/70" />

        {/* Content over image */}
        <div className="relative z-10 flex flex-col justify-center p-10 w-full h-full">
          {/* Central Hero Text */}
          <div className="space-y-6 -mt-20">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Welcome to the<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-indigo-300">
                Institution Panel
              </span>
            </h1>
            <p className="text-white/70 text-lg max-w-sm leading-relaxed">
              Your unified gateway to manage campuses, staff, students, and administration — all in one place.
            </p>
            
            <div className="flex gap-6 mt-8 pt-6 border-t border-white/20">
              <div>
                <div className="text-2xl font-bold text-white">12,000+</div>
                <div className="text-sky-300 text-sm font-medium">Students</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">850+</div>
                <div className="text-sky-300 text-sm font-medium">Staff</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">5+</div>
                <div className="text-sky-300 text-sm font-medium">Campuses</div>
              </div>
            </div>
          </div>

          {/* Footer Quote */}
          <div className="absolute bottom-10 left-10 text-white/50 text-sm">
            &copy; {new Date().getFullYear()} Nisaab360. All rights reserved.
          </div>
        </div>
      </div>

      {/* ── Right Panel – Login Form ── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
            </div>
            <span className="text-slate-800 font-bold text-xl">InstitutionPanel</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.10)] border border-slate-100 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Sign in to institution</h2>
              <p className="text-slate-500 mt-2 text-sm">
                Enter your administrative credentials to manage your campuses.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@institution.edu"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                    Password
                  </label>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm shadow-md shadow-indigo-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {syncing ? 'Syncing institution data…' : 'Signing in…'}
                  </>
                ) : (
                  <>
                    Sign In
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
