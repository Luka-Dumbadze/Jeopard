"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label shown in the fallback card */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Catches runtime render errors and shows a recoverable Georgian/English fallback
 * instead of blanking the entire projector or mobile screen.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Unknown UI error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-jeopardy-blue-dark px-6 py-10">
          <div className="w-full max-w-md rounded-2xl bg-jeopardy-blue/50 p-8 text-center ring-2 ring-jeopardy-gold/40">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-jeopardy-gold/70">
              {this.props.label ?? "Jeopardy"}
            </p>
            <h1 className="mt-3 text-2xl font-bold text-jeopardy-gold">
              რაღაც შეცდომა მოხდა
            </h1>
            <p className="mt-2 text-sm text-white/70">
              A UI error was caught so the live session stays recoverable.
            </p>
            {this.state.message && (
              <p className="mt-4 rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-red-200/90">
                {this.state.message}
              </p>
            )}
            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-6 rounded-xl bg-jeopardy-gold px-6 py-3 text-base font-bold text-jeopardy-blue-dark transition hover:bg-yellow-300 active:scale-95"
            >
              ხელახლა სცადეთ (Retry)
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
