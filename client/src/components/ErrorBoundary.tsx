import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

// Top-level safety net. Without this, any render-time error unmounts the whole
// React tree and leaves a blank (black, in dark mode) screen with no information.
// Now a crash shows a readable message + recovery actions instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface it in the console for debugging.
    console.error("App crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">😵‍💫</div>
          <h1 className="text-2xl font-black">Something glitched</h1>
          <p className="text-muted-foreground font-medium">
            The page hit an unexpected error. Try reloading — your progress is safe.
          </p>
          <pre className="text-left text-xs bg-muted/60 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold"
              data-testid="error-reload"
            >
              Reload
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="px-4 py-2 rounded-lg border border-border font-bold"
              data-testid="error-home"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
