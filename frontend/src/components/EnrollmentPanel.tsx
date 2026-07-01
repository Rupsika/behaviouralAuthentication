import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import type { KeystrokeEvent, TrainResponse } from '../services/api';
import { Shield, RefreshCw, HelpCircle, CheckCircle, Keyboard, RotateCcw } from 'lucide-react';

interface EnrollmentPanelProps {
  username: string;
  onEnrollmentComplete: (trainData: TrainResponse) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const SENTENCES = [
  "Zero Trust architecture requires continuous verification of every user and device on the network.",
  "The quick brown fox jumps over the lazy dog near the riverbank at sunset.",
  "Cybersecurity professionals must adapt to evolving threats and implement proactive defense strategies.",
];

const MIN_SAMPLES = 5;
const MAX_SAMPLES = 15;
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
  const [selectedSentence, setSelectedSentence] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (username) {
      setError(null);
      setSuccessMsg(null);
      api.getUserInfo(username)
        .then(info => {
          setUserState(info);
          setSamplesCount(info.is_enrolled ? 8 : 0);
        })
        .catch(() => {
          setSamplesCount(0);
          setUserState(null);
        });
    }
  }, [username]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') e.preventDefault();
    setKeystrokes(prev => [...prev, { key: e.key, event_type: 'keydown', timestamp: Date.now() }]);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    setKeystrokes(prev => [...prev, { key: e.key, event_type: 'keyup', timestamp: Date.now() }]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setError('⚠️ Paste blocked. You must type manually to capture keystroke dynamics for biometric enrollment.');
  };

  const submitSample = async () => {
    setError(null);
    setSuccessMsg(null);
    const TARGET_TEXT = SENTENCES[selectedSentence];
    const similarity = checkSimilarity(typedText.trim(), TARGET_TEXT);
    if (similarity < 0.85) {
      setError(`Typing mismatch. Please match the prompt more closely (current similarity: ${Math.round(similarity * 100)}%).`);
      return;
    }
    try {
      const res = await api.enroll(username, keystrokes);
      setSamplesCount(res.sample_index);
      setTypedText('');
      setKeystrokes([]);
      setSuccessMsg(`Sample ${res.sample_index} captured! ${res.sample_index >= MIN_SAMPLES ? 'You can train now or keep adding more.' : ''}`);
      if (textareaRef.current) textareaRef.current.focus();
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
      setSuccessMsg(`Model trained with ${res.model_name}!`);
      onEnrollmentComplete(res);
    } catch (err: any) {
      setError(err.message || 'Training failed. Ensure you have submitted enough samples.');
    } finally {
      setIsTraining(false);
    }
  };

  const resetEnrollment = () => {
    if (window.confirm("Clear all enrollment samples and start over?")) {
      setSamplesCount(0);
      setTypedText('');
      setKeystrokes([]);
      setError(null);
      setSuccessMsg(null);
    }
  };

  const checkSimilarity = (s1: string, s2: string): number => {
    const len1 = s1.length, len2 = s2.length;
    if (!len1 || !len2) return 0;
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    for (let i = 1; i <= len1; i++)
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+cost);
      }
    return (Math.max(len1, len2) - matrix[len1][len2]) / Math.max(len1, len2);
  };

  const TOTAL_SAMPLES = MAX_SAMPLES;

  return (
    <div className="light-page">

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '11px',
            background: 'linear-gradient(135deg, var(--brand-orange), #ff8c42)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(255,90,0,0.3)'
          }}>
            <Shield size={19} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e1b4b', margin: 0 }}>Profile Enrollment</h2>
            <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>
              Operator: <strong style={{ color: '#374151' }}>{username}</strong>
            </p>
          </div>
          {/* Always-visible Reset */}
          <button
            className="btn btn-light-secondary"
            onClick={resetEnrollment}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
          >
            <RotateCcw size={13} /> Reset & Re-enroll
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div className="light-card" style={{ marginBottom: '20px' }}>
        <div className="light-card-title" style={{ marginBottom: '16px' }}>
          <Keyboard size={17} color="#6366f1" />
          Biometric Enrollment Progress
        </div>

        <div className="progress-dots" style={{ marginBottom: '16px' }}>
          {Array.from({ length: TOTAL_SAMPLES }, (_, i) => {
            const sampleNum = i + 1;
            const isDone = sampleNum <= samplesCount;
            const isActive = sampleNum === samplesCount + 1 && samplesCount < TOTAL_SAMPLES;
            const isMin = sampleNum === MIN_SAMPLES;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                <div
                  className={`progress-dot ${isDone ? 'progress-dot-done' : isActive ? 'progress-dot-active' : 'progress-dot-empty'}`}
                >
                  {isDone ? '✓' : sampleNum}
                </div>
                {isMin && <div style={{ fontSize: '0.55rem', color: '#f97316', fontWeight: 700 }}>MIN</div>}
              </div>
            );
          })}
          <span style={{ fontSize: '0.82rem', color: '#6b7280', marginLeft: '8px' }}>
            {samplesCount}/{TOTAL_SAMPLES} captured
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(samplesCount / TOTAL_SAMPLES) * 100}%`,
            background: samplesCount === TOTAL_SAMPLES
              ? 'linear-gradient(90deg, #10b981, #059669)'
              : 'linear-gradient(90deg, var(--brand-orange), #ff8c42)',
            borderRadius: '999px',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Prompt + Input */}
      <div className="light-card">
        <div className="light-card-title">
          <Shield size={17} color="#f97316" />
          Type the Benchmark Sentence
          <span className="light-badge light-badge-orange" style={{ marginLeft: 'auto' }}>
            Sample {Math.min(samplesCount + 1, MAX_SAMPLES)} of {MAX_SAMPLES}
          </span>
        </div>

        <p style={{ color: '#6b7280', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '14px' }}>
          Type the sentence <strong>{MIN_SAMPLES}–{MAX_SAMPLES} times</strong> at your natural pace.
          You can train after <strong>{MIN_SAMPLES} samples</strong> — more samples = better accuracy.
        </p>

        {/* Sentence Selector */}
        <div style={{ marginBottom: '12px' }}>
          <label className="light-label">Choose Enrollment Sentence</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SENTENCES.map((sentence, idx) => (
              <div
                key={idx}
                onClick={() => { setSelectedSentence(idx); setTypedText(''); setKeystrokes([]); setError(null); }}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: `2px solid ${selectedSentence === idx ? 'var(--brand-orange)' : '#e5e7eb'}`,
                  background: selectedSentence === idx ? '#fff7ed' : '#fafafa',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-mono)',
                  color: selectedSentence === idx ? '#92400e' : '#6b7280',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontWeight: 700, marginRight: '8px', color: selectedSentence === idx ? '#f97316' : '#9ca3af' }}>
                  {idx + 1}.
                </span>
                {sentence}
              </div>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div style={{ marginBottom: '16px' }}>
          <label className="light-label">
            Your input — Sample {Math.min(samplesCount + 1, MAX_SAMPLES)}
          </label>
          <textarea
            ref={textareaRef}
            className="light-capture-area"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onPaste={handlePaste}
            placeholder={`Type sentence ${selectedSentence + 1} here exactly...`}
            disabled={samplesCount >= TOTAL_SAMPLES || isTraining}
          />
        </div>

        {/* Messages */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
            background: '#fef2f2', border: '1px solid #fecaca',
            color: '#dc2626', fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            color: '#15803d', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {samplesCount < MIN_SAMPLES ? (
              <button
                className="btn btn-light-primary"
                onClick={submitSample}
                disabled={typedText.trim().length === 0}
              >
                Submit Sample ({samplesCount}/{MIN_SAMPLES} min)
              </button>
            ) : samplesCount < TOTAL_SAMPLES ? (
              <>
                <button
                  className="btn btn-light-primary"
                  onClick={submitSample}
                  disabled={typedText.trim().length === 0}
                >
                  + Add Sample ({samplesCount}/{TOTAL_SAMPLES})
                </button>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select
                    className="light-input"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    style={{ width: '190px', padding: '10px 14px' }}
                  >
                    <option value="LogisticRegression">Logistic Regression</option>
                    <option value="SVM">Support Vector Machine</option>
                    <option value="RandomForest">Random Forest</option>
                  </select>
                  <button className="btn btn-light-teal" onClick={triggerTraining} disabled={isTraining}>
                    {isTraining ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Training...</> : '🚀 Train Now'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 600 }}>✓ Max samples reached</span>
                <select
                  className="light-input"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ width: '190px', padding: '10px 14px' }}
                >
                  <option value="LogisticRegression">Logistic Regression</option>
                  <option value="SVM">Support Vector Machine</option>
                  <option value="RandomForest">Random Forest</option>
                </select>
                <button className="btn btn-light-teal" onClick={triggerTraining} disabled={isTraining}>
                  {isTraining ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Training...</> : '🚀 Train Profile'}
                </button>
              </div>
            )}
            {samplesCount > 0 && samplesCount < TOTAL_SAMPLES && (
              <button className="btn btn-light-secondary" onClick={resetEnrollment}>
                Reset
              </button>
            )}
          </div>

          <span className="light-badge light-badge-orange">
            ⚡ Biometric Telemetry Active
          </span>
        </div>
      </div>

      {/* Live Telemetry Log */}
      <div className="light-card" style={{ marginBottom: 0 }}>
        <div className="light-card-title" style={{ marginBottom: '12px' }}>
          <HelpCircle size={17} color="#0891b2" />
          Live Telemetry Stream
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>
            Last 4 events
          </span>
        </div>
        <div style={{
          background: '#f8fafc',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          padding: '12px 14px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          color: '#374151',
          minHeight: '72px',
          maxHeight: '100px',
          overflowY: 'auto',
        }}>
          {keystrokes.length > 0 ? (
            keystrokes.slice(-4).map((evt, idx) => (
              <div key={idx} style={{ marginBottom: '2px' }}>
                <span style={{ color: '#9ca3af' }}>[{new Date(evt.timestamp).toISOString().split('T')[1].slice(0, -1)}]</span>
                {' '}
                <span style={{ color: evt.event_type === 'keydown' ? '#059669' : '#d97706', fontWeight: 600 }}>
                  {evt.event_type}
                </span>
                {' '}<span style={{ color: '#6366f1' }}>"{evt.key}"</span>
              </div>
            ))
          ) : (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Waiting for keypress inputs...</div>
          )}
        </div>
      </div>

    </div>
  );
};
