import React from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

interface ConfirmDialogProps {
  /** Whether the dialog is currently open */
  open: boolean;
  /** Callback when the user confirms (clicks the action button) */
  onConfirm: () => void;
  /** Callback when the user cancels or closes the dialog */
  onCancel: () => void;
  /** Dialog title text */
  title?: string;
  /** Dialog description/body text */
  description?: string;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Visual variant — 'danger' uses rose/red styling */
  variant?: 'danger' | 'default';
}

/**
 * ConfirmDialog — Accessible confirmation dialog built on Radix AlertDialog.
 * Replaces native `confirm()` with a styled, WCAG 2.2 AA compliant dialog.
 * Supports focus trapping, keyboard navigation, and screen readers.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onConfirm,
  onCancel,
  title = 'ยืนยันการดำเนินการ',
  description = 'คุณแน่ใจหรือไม่ว่าต้องการดำเนินการนี้?',
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  variant = 'default',
}) => {
  return (
    <AlertDialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] animate-in fade-in duration-200" />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[90vw] max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 focus:outline-none"
        >
          <AlertDialog.Title className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {description}
          </AlertDialog.Description>

          <div className="flex justify-end gap-3 mt-6">
            <AlertDialog.Cancel asChild>
              <button
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500 dark:focus-visible:ring-orange-500 focus-visible:outline-none"
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/20 focus-visible:ring-rose-500'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-900/20 focus-visible:ring-purple-500'
                }`}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
