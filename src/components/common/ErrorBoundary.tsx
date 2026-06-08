import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] text-slate-200 p-6 font-sans relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-rose-950 rounded-full blur-[120px] opacity-25 pointer-events-none" />
          <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-950 rounded-full blur-[100px] opacity-15 pointer-events-none" />

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-lg text-center z-10 space-y-6">
            <div className="mx-auto bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-full w-16 h-16 flex items-center justify-center shadow-lg">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">เกิดข้อผิดพลาดในการโหลดระบบ</h1>
              <p className="text-slate-400 text-xs leading-relaxed">
                ขออภัย ระบบพบข้อผิดพลาดที่ไม่สามารถดำเนินงานต่อได้โดยอัตโนมัติ ข้อมูลบางส่วนอาจไม่ได้รับการโหลดอย่างถูกต้อง
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 text-left font-mono text-[10px] text-rose-300 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-rose-900/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 focus-visible:outline-none"
            >
              <RefreshCw size={14} /> รีโหลดและเริ่มต้นระบบใหม่
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
