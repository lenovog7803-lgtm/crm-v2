import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 24, border: '1px solid rgba(var(--rgb-224-71-59), 0.25)' }}>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: 'var(--fg-e0473b)', marginBottom: 8 }}>
            Ошибка в разделе
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => this.setState({ error: null })} className="btn-primary"
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
