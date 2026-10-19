import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('HeatSense UI caught an unhandled error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || 'Unknown render error';
      return (
        <div className="min-h-[50vh] bg-[#FAFAF9] dark:bg-[#0B1215] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-slate-900 dark:text-white">
            Something unexpected occurred
          </h1>
          <p className="text-xs text-slate-500 max-w-md mt-2 mb-6">
            {this.props.pageName ? `${this.props.pageName} could not render.` : 'The application could not render this screen.'} The error details are shown below.
          </p>
          <pre role="alert" className="max-w-3xl w-full max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-rose-200 bg-rose-50 p-3 text-left text-xs text-rose-900 mb-4">{message}{import.meta.env.DEV && this.state.error?.stack ? `\n\n${this.state.error.stack}` : ''}</pre>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              this.setState({ hasError: false });
              this.setState({ hasError: false, error: undefined });
            }}
            className="text-xs gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry this screen</span>
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
