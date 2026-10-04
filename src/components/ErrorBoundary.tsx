import React, { Component, ErrorInfo, ReactNode } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";

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
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside React Tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0F1115] text-[#D1D5DB] flex flex-col items-center justify-center p-6">
          <div className="bg-[#161B22] rounded-lg border border-[#30363D] p-8 shadow-2xl max-w-md w-full text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-950/45 border border-amber-800/45 flex items-center justify-center mb-4">
              <ShieldAlert className="h-6 w-6 text-amber-500" />
            </div>
            <h2 className="text-md font-bold font-display uppercase tracking-wider text-white mb-2">
              Application Error Intercepted
            </h2>
            <p className="text-xs text-[#8B949E] font-mono leading-relaxed mb-6">
              {this.state.error?.message || "An unexpected dynamic runtime error occurred inside the gateway."}
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-mono text-xs font-semibold tracking-wide transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>RESET GATEWAY CONSOLE</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
