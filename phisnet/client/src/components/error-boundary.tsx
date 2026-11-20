import { Component, type ReactNode, type ErrorInfo } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error:Error,info:ErrorInfo) {
    const diagnostic={id:globalThis.crypto?.randomUUID?.()||String(Date.now()),at:new Date().toISOString(),path:window.location.pathname,message:error.message,stack:error.stack,componentStack:info.componentStack,viewport:{width:window.innerWidth,height:window.innerHeight}};
    console.error('PhishNet render failure',diagnostic);
    try {sessionStorage.setItem('phishnet-last-render-error',JSON.stringify(diagnostic));} catch {}
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen flex items-center justify-center p-6">
      <div role="alert" className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">This page could not load</h1>
        <p>Please reload the page. If the problem continues, contact your organization administrator.</p>
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    </main>;
  }
}
