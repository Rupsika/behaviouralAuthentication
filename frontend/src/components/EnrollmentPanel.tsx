import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { KeystrokeEvent, TrainResponse } from '../services/api';
import { Shield, RefreshCw, HelpCircle } from 'lucide-react';

interface EnrollmentPanelProps {
  username: string;
  onEnrollmentComplete: (trainData: TrainResponse) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const TARGET_TEXT = "Zero Trust architecture requires continuous verification of every user and device on the network.";

export const EnrollmentPanel: React.FC<EnrollmentPanelProps> = ({
  username,
  onEnrollmentComplete,
  selectedModel,
  setSelectedModel,
}) => {
  const [typedText, setTypedText] = useState('');
  const [keystrokes, setKeystrokes] = useState<KeystrokeEvent[]>([]);
  const [samplesCount, setSamplesCount] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [_userState, setUserState] = useState<{ is_enrolled: boolean } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check user enrollment state on load / username change
  useEffect(() => {
    if (username) {
      setError(null);
      setSuccessMsg(null);
      api.getUserInfo(username)
        .then(info => {
          setUserState(info);
          if (info.is_enrolled) {
            setSamplesCount(8); // Assume completed if database shows enrolled
          } else {
            // Fetch sample counts if any
            setSamplesCount(0);
          }
        })
        .catch(() => {
          // User doesn't exist yet, which is fine
          setSamplesCount(0);
          setUserState(null);
        });
    }
  }, [username]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent capturing Tab key focusing out or causing anomalies
    if (e.key === 'Tab') {
      e.preventDefault();
    }
    const timestamp = Date.now();
    const event: KeystrokeEvent = {
      key: e.key,
      event_type: 'keydown',
      timestamp
    };
    setKeystrokes(prev => [...prev, event]);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const timestamp = Date.now();
    const event: KeystrokeEvent = {
      key: e.key,
      event_type: 'keyup',
      timestamp
    };
    setKeystrokes(prev => [...prev, event]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setError('⚠️ Paste blocked. You must type manually to capture keystroke dynamics for biometric enrollment.');
  };

  const submitSample = async () => {
    setError(null);
    setSuccessMsg(null);

    // Simple validation: check if the typed text matches at least 85% of target text
    const similarity = checkSimilarity(typedText.trim(), TARGET_TEXT);
    if (similarity < 0.85) {
      setError(`Typing mismatch. Please match the prompt closely (current similarity: ${Math.round(similarity * 100)}%).`);
      return;
    }

    try {
      const res = await api.enroll(username, keystrokes);
      setSamplesCount(res.sample_index);
      setTypedText('');
      setKeystrokes([]);
      setSuccessMsg(`Sample ${res.sample_index} enrolled successfully!`);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit enrollment sample');
    }
  };

  const triggerTraining = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsTraining(true);

    try {
      const res = await api.train(username, selectedModel);
      setSuccessMsg(`Model successfully trained using ${res.model_name}!`);
      onEnrollmentComplete(res);
    } catch (err: any) {
      setError(err.message || 'Training failed. Ensure you have submitted enough samples.');
    } finally {
      setIsTraining(false);
    }
  };

  const resetEnrollment = () => {
    if (window.confirm("Are you sure you want to clear your current enrollment samples and start over?")) {
      setSamplesCount(0);
      setTypedText('');
      setKeystrokes([]);
      setError(null);
      setSuccessMsg(null);
    }
  };

  // Helper function to calculate similarity (Levenshtein distance baseline)
  const checkSimilarity = (s1: string, s2: string): number => {
    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0) return 0;
    if (len2 === 0) return 0;

    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return (maxLen - distance) / maxLen;
  };

  return (
    <div className="card">
      <div className="card-title">
        <Shield size={20} color="var(--brand-orange)" />
        Cortex-Guard: Profile Enrollment
      </div>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          To establish your unique biometric typing signature, you must type the benchmark Zero-Trust sentence below **8 times**. 
          Type at your natural speed and rhythm.
        </p>
      </div>

      <div className="prompt-text">
        {TARGET_TEXT}
      </div>

      <div className="form-group">
        <label className="form-label">
          Type the prompt above (Sample {Math.min(samplesCount + 1, 8)} of 8)
        </label>
        <textarea
          ref={textareaRef}
          className="key-capture-area"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onPaste={handlePaste}
          placeholder="Start typing the prompt here exactly..."
          disabled={samplesCount >= 8 || isTraining}
        />
      </div>

      {error && <div style={{ color: 'var(--brand-red)', fontSize: '0.9rem', marginBottom: '16px' }}>{error}</div>}
      {successMsg && <div style={{ color: 'var(--success)', fontSize: '0.9rem', marginBottom: '16px' }}>{successMsg}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {samplesCount < 8 ? (
            <button
              className="btn btn-primary"
              onClick={submitSample}
              disabled={typedText.trim().length === 0}
            >
              Submit Sample ({samplesCount}/8)
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="form-input"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ width: '180px', padding: '10px' }}
                >
                  <option value="LogisticRegression">Logistic Regression</option>
                  <option value="SVM">Support Vector Machine</option>
                  <option value="RandomForest">Random Forest</option>
                </select>
              </div>
              <button
                className="btn btn-primary"
                onClick={triggerTraining}
                disabled={isTraining}
                style={{ background: 'var(--brand-teal)', color: '#0a0b0d' }}
              >
                {isTraining ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} />
                    Training Model...
                  </>
                ) : 'Train Profile'}
              </button>
            </div>
          )}

          {samplesCount > 0 && (
            <button className="btn btn-secondary" onClick={resetEnrollment}>
              Reset Samples
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="badge badge-warning" style={{ background: 'rgba(255, 90, 0, 0.05)', color: 'var(--brand-orange)' }}>
            Biometric Telemetry Active
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '16px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
          <HelpCircle size={14} /> Telemetry Metadata Log
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', maxHeight: '100px', overflowY: 'auto' }}>
          {keystrokes.length > 0 ? (
            keystrokes.slice(-4).map((evt, idx) => (
              <div key={idx}>
                [{new Date(evt.timestamp).toISOString().split('T')[1].slice(0, -1)}] Key: "{evt.key}" | Event: {evt.event_type}
              </div>
            ))
          ) : (
            <div style={{ fontStyle: 'italic' }}>Waiting for keypress inputs...</div>
          )}
        </div>
      </div>
    </div>
  );
};
