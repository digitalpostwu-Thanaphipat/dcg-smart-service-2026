import React, { useState, useEffect } from 'react';
import { Globe, Settings, AlertCircle, ArrowRight, Mail, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';
interface LoginViewProps {
  onLogin: (email: string, fullName?: string, sessionToken?: string, role?: string, userID?: string) => void;
  onShowPublic: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onShowPublic }) => {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [showDevMode, setShowDevMode] = useState(false);

  const isLocalhost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname === '::1';

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMsg('กรุณากรอกอีเมลผู้ใช้งาน');
      return;
    }

    // ตรวจสอบรูปแบบอีเมลพื้นฐาน
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('กรุณากรอกรูปแบบอีเมลให้ถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      const res = await api.requestOTP(trimmedEmail);
      if (res.status === 'success') {
        setOtpSent(true);
        setCooldown(60);
        setInfoMsg(res.data?.message || `รหัส OTP ถูกจัดส่งไปยัง ${trimmedEmail} แล้ว`);
      } else {
        setErrorMsg(res.message || 'ไม่สามารถร้องขอรหัส OTP ได้');
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
        setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือติดต่อผู้ดูแลระบบ');
      } else {
        setErrorMsg(msg || 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = otpCode.trim();

    if (!trimmedCode) {
      setErrorMsg('กรุณากรอกรหัส OTP 6 หลัก');
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyOTP(trimmedEmail, trimmedCode);
      if (res.status === 'success' && res.data) {
        onLogin(res.data.email, res.data.fullName, res.data.sessionToken, res.data.role, res.data.userID);
      } else {
        setErrorMsg(res.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
        setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือติดต่อผู้ดูแลระบบ');
      } else {
        setErrorMsg(msg || 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMockSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    const formData = new FormData(e.currentTarget);
    const mockEmail = formData.get('email') as string;
    if (mockEmail) {
      onLogin(mockEmail.trim(), 'Mock User (Developer)', 'mock-token-123');
    }
  };

  return (
    <div className="space-y-6 text-left">
      <p className="text-slate-400 text-xs font-semibold text-center mb-1">
        ลงชื่อเข้าใช้งานสำหรับเจ้าหน้าที่
      </p>

      {/* Form Area */}
      {!otpSent ? (
        <form onSubmit={handleRequestOTP} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="user-email" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              อีเมลมหาวิทยาลัยวลัยลักษณ์
            </label>
            <div className="relative">
              <input
                id="user-email"
                type="email"
                required
                placeholder="example@wu.ac.th"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/60 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-white focus:ring-1 focus:ring-purple-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none outline-none transition-all"
                disabled={loading}
              />
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            {loading ? 'กำลังดำเนินการ...' : 'ขอรหัสผ่านใช้ครั้งเดียว (OTP)'}
            {!loading && <ArrowRight size={12} />}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                รหัสยืนยันตัวตน (OTP)
              </span>
              <button 
                type="button" 
                onClick={() => setOtpSent(false)} 
                className="text-[10px] font-bold text-purple-400 hover:text-purple-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded"
              >
                เปลี่ยนอีเมล
              </button>
            </div>
            
            <input
              id="otp-code"
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="กรอกรหัส 6 หลัก"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-slate-900/60 border border-white/10 rounded-2xl px-4 py-3 text-center text-lg font-black tracking-[0.5em] text-white focus:ring-1 focus:ring-purple-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none outline-none transition-all"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'ยืนยันและเข้าสู่ระบบ'}
          </button>

          {/* Resend OTP button with cooldown */}
          <div className="text-center">
            {cooldown > 0 ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                ขอรหัสใหม่ได้อีกครั้งในอีก {cooldown} วินาที
              </p>
            ) : (
              <button
                type="button"
                onClick={handleRequestOTP}
                className="text-[10px] text-purple-400 hover:text-purple-300 font-bold hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded"
              >
                ส่งรหัส OTP อีกครั้ง
              </button>
            )}
          </div>
        </form>
      )}

      {/* Messages */}
      {errorMsg && (
        <div className="w-full bg-rose-500/10 border border-rose-500/20 text-rose-200 text-[11px] p-3 rounded-2xl flex items-start gap-2 text-left leading-relaxed">
          <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-[11px] p-3 rounded-2xl flex items-start gap-2 text-left leading-relaxed">
          <ShieldAlert size={14} className="text-emerald-400 shrink-0 mt-0.5" />
          <span>{infoMsg}</span>
        </div>
      )}

      {/* Developer Mock Login (เฉพาะบน localhost) */}
      {isLocalhost && (
        <div className="pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => setShowDevMode(!showDevMode)}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1.5 mx-auto py-1 px-3 rounded-full hover:bg-white/5 transition-all"
          >
            <Settings size={12} />
            {showDevMode ? 'ซ่อนโหมดนักพัฒนา' : 'โหมดนักพัฒนา (Mock Login)'}
          </button>

          {showDevMode && (
            <form onSubmit={handleMockSubmit} className="mt-4 p-4 bg-slate-950/40 border border-white/5 rounded-2xl space-y-3.5 text-left">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  อีเมลทดสอบ (Role ตามชีต Master_Users)
                </label>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  required
                  defaultValue="admin@wu.ac.th"
                  placeholder="admin@wu.ac.th หรือ user@wu.ac.th"
                  className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:ring-1 focus:ring-purple-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-purple-600/30 hover:bg-purple-600 border border-purple-500/30 hover:border-purple-500 text-purple-200 hover:text-white py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 focus-visible:outline-none"
              >
                เข้าสู่ระบบด้วยบัญชีจำลอง <ArrowRight size={12} />
              </button>
            </form>
          )}
        </div>
      )}

      {/* ลิงก์สำหรับบุคคลทั่วไปตรวจสอบไปรษณีย์ภัณฑ์ */}
      <div className="pt-4 border-t border-white/5">
        <button
          type="button"
          onClick={onShowPublic}
          className="text-purple-400 hover:text-purple-300 text-xs font-bold flex items-center justify-center gap-2 w-full p-2.5 hover:bg-white/5 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
        >
          <Globe size={14} /> ตรวจสอบการใช้บริการของหน่วยงาน
        </button>
      </div>
    </div>
  );
};
