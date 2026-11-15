import {Component, type ErrorInfo, type ReactNode} from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error internally without crashing UI
    void error;
    void errorInfo;
  }

  private handleReload = () => {
    this.setState({hasError: false, error: null});
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center font-mono text-regolith">
          <div className="rounded-xl border border-mars/40 bg-void-2 p-8 max-w-md space-y-4 shadow-2xl">
            <span className="text-3xl">⚠️</span>
            <h2 className="font-display text-lg text-white font-bold uppercase tracking-wider">
              Something went wrong.
            </h2>
            <p className="text-xs text-regolith/75 leading-relaxed">
              An unexpected client boundary error was caught. Operational state is safely preserved.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-earth px-5 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
