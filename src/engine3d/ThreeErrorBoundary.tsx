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
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0a0a12',
              color: '#e8dcc8',
              padding: 24,
              textAlign: 'center',
              fontFamily: 'Vazirmatn, sans-serif',
            }}
            dir="rtl"
          >
            <h2 style={{ marginBottom: 12 }}>⚠️ خطا در موتور سه‌بعدی</h2>
            <p style={{ maxWidth: 480, lineHeight: 1.8 }}>
              رندر سه‌بعدی با مشکل مواجه شد. لطفاً صفحه را تازه‌سازی کنید یا به نمای کلاسیک برگردید.
            </p>
            <pre
              style={{
                marginTop: 16,
                fontSize: 12,
                opacity: 0.7,
                maxWidth: 600,
                overflow: 'auto',
                direction: 'ltr',
              }}
            >
              {this.state.error?.message ?? 'Unknown error'}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                marginTop: 20,
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid #c9a86a',
                background: '#1a1a2e',
                color: '#e8dcc8',
                cursor: 'pointer',
              }}
            >
              تلاش مجدد
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
