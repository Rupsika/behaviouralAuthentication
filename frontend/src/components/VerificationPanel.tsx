import React, { useState } from 'react';
import { api } from '../services/api';
import type { KeystrokeEvent, VerifyResponse } from '../services/api';
import { CheckCircle, ShieldAlert, Key } from 'lucide-react';


interface VerificationPanelProps {
  username: string;
}

const VERIFY_PROMPT = "Authentication protocols must adapt dynamically to defend against credential theft and session exploitation.";

export const VerificationPanel: React.FC<VerificationPanelProps> = ({ username }) => {
  const [typedText, setTypedText] = useState('');
  const [keystrokes, setKeystrokes] = useState<KeystrokeEvent[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteBlocked, setPasteBlocked] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
    }
    const timestamp = Date.now();
    setKeystrokes(prev => [...prev, { key: e.key, event_type: 'keydown', timestamp }]);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const timestamp = Date.now();
    setKeystrokes(prev => [...prev, { key: e.key, event_type: 'keyup', timestamp }]);
  };

  const runVerification = async () => {
    if (keystrokes.length < 15) {
      setError("Please type a longer sequence of keystrokes to authenticate.");
      return;
    }

    setError(null);
    setIsVerifying(true);
    setResult(null);

    try {
      const res = await api.verify(username, keystrokes);
      setResult(res);
      // Keep keystrokes for debugging, reset text
      setTypedText('');
      setKeystrokes([]);
    } catch (err: any) {
      setError(err.message || 'Verification request failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setPasteBlocked(true);
    setError('⚠️ Paste detected and blocked. Keystroke biometrics require manual typing — pasting produces no timing signature and would be flagged as an anomaly.');
    setTimeout(() => setPasteBlocked(false), 3000);
  };

  const resetForm = () => {
    setTypedText('');
    setKeystrokes([]);
    setResult(null);
    setError(null);
  };

  return (
    <div className="card">
      <div className="card-title">
        <Key size={20} color="var(--brand-teal)" />
        Cortex-Guard: Single-Shot Verification
      </div>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Test your enrolled profile. Type the validation prompt below. We will analyze the timing signature of this session against your enrolled ML classifier.
        </p>
      </div>

      <div className="prompt-text" style={{ borderLeftColor: 'var(--brand-orange)' }}>
        {VERIFY_PROMPT}
      </div>

      <div className="form-group">
        <label className="form-label">Type validation text</label>
        <textarea
          className="key-capture-area"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onPaste={handlePaste}
          placeholder="Start typing the prompt here to verify..."
          disabled={isVerifying}
          style={{ borderColor: pasteBlocked ? 'var(--brand-red)' : undefined }}
        />
      </div>

      {error && <div style={{ color: 'var(--brand-red)', fontSize: '0.9rem', marginBottom: '16px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          className="btn btn-primary"
          onClick={runVerification}
          disabled={isVerifying || typedText.trim().length === 0}
          style={{ background: 'var(--brand-teal)', color: '#0a0b0d' }}
        >
          Verify Typing Identity
        </button>
        {(typedText.length > 0 || result) && (
          <button className="btn btn-secondary" onClick={resetForm}>
            Clear / Retry
          </button>
        )}
      </div>

      {result && (
        <div style={{
          padding: '20px',
          borderRadius: '8px',
          background: 'var(--bg-tertiary)',
          border: `1px solid ${result.is_genuine ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {result.is_genuine ? (
              <CheckCircle size={32} color="var(--success)" />
            ) : (
              <ShieldAlert size={32} color="var(--error)" />
            )}
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {result.is_genuine ? 'Access Granted: User Verified' : 'Access Denied: Anomaly Detected'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Zero-Trust validation completed successfully.
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            background: 'var(--bg-primary)',
            padding: '12px',
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem'
          }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>CONFIDENCE SCORE</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: result.is_genuine ? 'var(--success)' : 'var(--error)' }}>
                {Math.round(result.score * 100)}%
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>PROFILE THRESHOLD</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {Math.round(result.applied_threshold * 100)}%
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>SECURITY LEVEL</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand-orange)' }}>
                {result.active_profile.replace('_', ' ')}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {result.is_genuine ? (
              <span>The input typing profile matches your behavioral template. The confidence level is above the required score for the <strong>{result.active_profile}</strong> profile.</span>
            ) : (
              <span><strong>Warning:</strong> The keystroke signature mismatch is significant (confidence score fell below threshold). In a live enterprise scenario, Cortex-XDR would flag this endpoint and initiate a secondary Multi-Factor Authentication (MFA) challenge.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
