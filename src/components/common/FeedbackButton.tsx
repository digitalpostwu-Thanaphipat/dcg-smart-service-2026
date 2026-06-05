import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../services/api';

export const FeedbackButton: React.FC = () => {
  const { currentUser, setStatus, isOnline } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'Bug' | 'Suggestion' | 'Other'>('Suggestion');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Low');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isFirstRender = useRef(true);

  // Keyboard navigation & accessibility helpers (WCAG 2.1 AA Compliance)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Close on Escape key press
      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      // Trap focus within the modal dialog
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex="0"]'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          // Shift + Tab: Go to last element if currently on first element
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          // Tab: Go to first element if currently on last element
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading]);

  // Set focus on open, and return focus to button on close
  useEffect(() => {
    if (isOpen) {
      isFirstRender.current = false;
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      if (!isFirstRender.current) {
        buttonRef.current?.focus();
      }
    }
  }, [isOpen]);

  // If user is not logged in, do not render the feedback button (prevents unauthenticated submission error)
  if (!currentUser) return null;

  const openModal = () => {
    setIsOpen(true);
    setError(null);
    setDescription('');
    setType('Suggestion');
    setSeverity('Low');
  };

  const closeModal = () => {
    if (loading) return; // Prevent closure while submitting API request
    setIsOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setError('คุณกำลังอยู่ในโหมดออฟไลน์ ไม่สามารถส่งข้อเสนอแนะได้ในขณะนี้');
      return;
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 10) {
      setError('กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Send the feedback API call
      const result = await api.submitFeedback({
        type,
        severity,
        description: trimmedDesc,
        staffEmail: currentUser.Email
      });

      if (result.status === 'success') {
        setStatus({ type: 'success', text: 'บันทึกข้อเสนอแนะและปัญหาการใช้งานเรียบร้อยแล้ว' });
        closeModal();
      } else {
        setError(result.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FLOATING FEEDBACK TRIGGER BUTTON */}
      <button
        ref={buttonRef}
        onClick={openModal}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="ส่งข้อเสนอแนะและแจ้งปัญหา"
        title="ส่งข้อเสนอแนะ / แจ้งปัญหาการใช้งาน"
        // Style highlights: fixed to be above bottom navigation on mobile (bottom-20) and bottom-6 on desktop.
        // Meets contrast ratio guidelines: dark text on green CTA in OLED dark mode, white text on green-600 in light mode.
        className="fixed bottom-20 md:bottom-6 right-6 z-40 flex items-center justify-center p-3.5 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 focus-visible:outline-none dark:bg-[#22C55E] dark:hover:bg-green-500 dark:text-slate-950"
      >
        <MessageSquare size={20} />
      </button>

      {/* MODAL DIALOG */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Fade In */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Modal Dialog Scale In */}
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-dialog-title"
              aria-describedby="feedback-dialog-desc"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="relative w-full max-w-md bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-white/5 rounded-2xl shadow-2xl p-6 overflow-hidden z-10 text-slate-800 dark:text-slate-200"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-5">
                <h3
                  id="feedback-dialog-title"
                  className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2"
                >
                  <span className="w-1.5 h-4 bg-green-500 rounded-full inline-block"></span>
                  ส่งข้อเสนอแนะ / แจ้งปัญหาการใช้งาน
                </h3>
                <button
                  ref={closeButtonRef}
                  onClick={closeModal}
                  disabled={loading}
                  aria-label="ปิดกล่องข้อความ"
                  className="p-1 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
                >
                  <X size={18} />
                </button>
              </div>

              <p id="feedback-dialog-desc" className="sr-only">
                กรอกฟอร์มนี้เพื่อส่งข้อเสนอแนะ ปัญหาการใช้งาน หรือแจ้งบั๊กของระบบ
              </p>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* User Info (Readonly) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    ผู้ส่งรายงาน
                  </label>
                  <input
                    type="text"
                    value={currentUser.Email}
                    readOnly
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 text-slate-500 rounded-xl outline-none select-all"
                  />
                </div>

                {/* Feedback Type Selector */}
                <div className="space-y-1">
                  <label
                    htmlFor="feedback-type"
                    className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                  >
                    ประเภทของข้อเสนอแนะ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="feedback-type"
                    ref={firstInputRef}
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    disabled={loading}
                    className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="Suggestion">ข้อเสนอแนะ (Suggestion)</option>
                    <option value="Bug">แจ้งปัญหาการใช้งาน / บั๊ก (Bug)</option>
                    <option value="Other">อื่น ๆ (Other)</option>
                  </select>
                </div>

                {/* Severity Selector */}
                <div className="space-y-1">
                  <label
                    htmlFor="feedback-severity"
                    className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                  >
                    ระดับความรุนแรง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="feedback-severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    disabled={loading}
                    className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="Low">ต่ำ (Low)</option>
                    <option value="Medium">ปานกลาง (Medium)</option>
                    <option value="High">สูง - มีผลกระทบต่อการทำงาน (High)</option>
                    <option value="Critical">วิกฤต - ระบบใช้ไม่ได้ทั้งหมด (Critical)</option>
                  </select>
                  {(severity === 'High' || severity === 'Critical') && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1 animate-pulse">
                      * ระดับ สูง / วิกฤต จะมีการส่งการแจ้งเตือนด่วนผ่าน LINE Notify ไปยังกลุ่มผู้พัฒนาทันที
                    </p>
                  )}
                </div>

                {/* Feedback Description Textarea */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label
                      htmlFor="feedback-description"
                      className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                    >
                      รายละเอียด <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-400">
                      {description.length}/500
                    </span>
                  </div>
                  <textarea
                    id="feedback-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.substring(0, 500))}
                    disabled={loading}
                    required
                    rows={4}
                    placeholder="กรุณาอธิบายปัญหาหรือข้อเสนอแนะความยาวอย่างน้อย 10 ตัวอักษร..."
                    className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white rounded-xl focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all resize-none"
                  />
                </div>

                {/* Error Banner Alert */}
                {error && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold"
                  >
                    {error}
                  </div>
                )}

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={loading}
                    className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    // Complies with contrast guidelines: white text on green-600/700 in light, black text on bg-[#22C55E] in dark
                    className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-md transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 disabled:opacity-50 dark:bg-[#22C55E] dark:hover:bg-green-500 dark:text-slate-950"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        กำลังส่ง...
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        ส่งข้อมูล
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
