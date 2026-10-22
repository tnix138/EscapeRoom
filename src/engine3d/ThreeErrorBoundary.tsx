'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ThreeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ThreeErrorBoundary]', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="scene-fallback" dir="rtl">
            <h2>⚠️ خطا در موتور سه‌بعدی</h2>
            <p>رندر سه‌بعدی با مشکل مواجه شد. لطفاً صفحه را تازه کنید یا به نمای کلاسیک برگردید.</p>
            <pre>{this.state.error?.message ?? 'Unknown error'}</pre>
            <button type="button" onClick={() => this.setState({ hasError: false, error: null })}>
              تلاش مجدد
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
