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
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 24, border: '1px solid rgba(224,71,59,0.25)' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 16, color: '#E0473B', marginBottom: 8 }}>
            Ошибка в разделе
          </div>
          <div style={{ fontSize: 13, color: '#5A6573', marginBottom: 14, fontFamily: 'JetBrains Mono' }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '10px 18px', borderRadius: 12, background: '#1366F0', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
