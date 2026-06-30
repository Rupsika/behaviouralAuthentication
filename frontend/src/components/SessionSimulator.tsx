import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import type { KeystrokeEvent } from '../services/api';
import { Radio, ShieldAlert, CheckCircle, Sliders } from 'lucide-react';

interface SessionSimulatorProps {
  username: string;
  activeProfile: string;
  setActiveProfile: (profile: string) => void;
  thresholds: {
    balanced: number;
    high_security: number;
    low_friction: number;
  };
}

export const SessionSimulator: React.FC<SessionSimulatorProps> = ({
  username,
  activeProfile,
  setActiveProfile,
  thresholds,
}) => {
  const [typedContent, setTypedContent] = useState('');
  const [runningKeystrokes, setRunningKeystrokes] = useState<KeystrokeEvent[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [isGenuine, setIsGenuine] = useState<boolean>(true);
  const [_isEvaluating, setIsEvaluating] = useState(false);
  const [anomalyCounter, setAnomalyCounter] = useState(0);
  
  // Real-time window telemetry stats
  const [speedSec, setSpeedSec] = useState(0);
  const [dwellMs, setDwellMs] = useState(0);
  const [backspaceCount, setBackspaceCount] = useState(0);

  const windowSize = 25; // sliding window buffer size
  const evaluationStep = 8; // evaluate every 8 keystrokes
  const keyCounterRef = useRef(0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
    }
    const timestamp = Date.now();
    
    // Add event
    const event: KeystrokeEvent = {
      key: e.key,
      event_type: 'keydown',
      timestamp
    };
    
    setRunningKeystrokes(prev => {
      const updated = [...prev, event];
      if (updated.length > windowSize * 2) {
        return updated.slice(-windowSize * 2); // Keep buffer sized appropriately
      }
      return updated;
    });

    keyCounterRef.current += 1;
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const timestamp = Date.now();
    const event: KeystrokeEvent = {
      key: e.key,
      event_type: 'keyup',
      timestamp
    };
    
    setRunningKeystrokes(prev => {
      const updated = [...prev, event];
      if (updated.length > windowSize * 2) {
        return updated.slice(-windowSize * 2);
      }
      return updated;
    });
  };

  // Whenever keystrokes buffer updates, evaluate slide
  useEffect(() => {
    if (runningKeystrokes.length >= windowSize && keyCounterRef.current >= evaluationStep) {
      keyCounterRef.current = 0; // reset evaluator tick
      evaluateSlidingWindow();
    }
  }, [runningKeystrokes]);

  const evaluateSlidingWindow = async () => {
    setIsEvaluating(true);
    
    // Take the last N keydown/keyup pairs from buffer
    // To ensure features align, we sort the buffer and slice the last 40 raw events
    const sortedEvents = [...runningKeystrokes].sort((a, b) => a.timestamp - b.timestamp);
    const windowEvents = sortedEvents.slice(-windowSize * 2);
    
    // Compute local stats for display UI
    calculateLocalStats(windowEvents);

    try {
      const res = await api.score(username, windowEvents);
      setScore(res.score);
      setIsGenuine(res.is_genuine);
      
      if (!res.is_genuine) {
        setAnomalyCounter(prev => prev + 1);
      } else {
        setAnomalyCounter(0); // reset if genuine
      }
    } catch (err) {
      console.error("Continuous evaluation error:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const calculateLocalStats = (events: KeystrokeEvent[]) => {
    const keydowns = events.filter(e => e.event_type === 'keydown');


    // Speed: keys per second
    if (events.length > 2) {
      const durationSec = (events[events.length - 1].timestamp - events[0].timestamp) / 1000.0;
      if (durationSec > 0) {
        setSpeedSec(keydowns.length / durationSec);
      }
    }

    // Backspaces
    const bsCount = keydowns.filter(e => e.key.toLowerCase() === 'backspace').length;
    setBackspaceCount(bsCount);

    // Mean Dwell
    const activePresses: { [key: string]: number } = {};
    const dwells: number[] = [];
    events.forEach(e => {
      if (e.event_type === 'keydown') {
        if (!activePresses[e.key]) activePresses[e.key] = e.timestamp;
      } else if (e.event_type === 'keyup') {
        if (activePresses[e.key]) {
          dwells.push(e.timestamp - activePresses[e.key]);
          delete activePresses[e.key];
        }
      }
    });
    if (dwells.length > 0) {
      setDwellMs(dwells.reduce((a, b) => a + b, 0) / dwells.length);
    }
  };

  const changeProfile = async (profile: string) => {
    try {
      const info = await api.updateProfile(username, profile);
      setActiveProfile(info.active_profile);
      // Re-trigger scoring if we have typing data
      if (runningKeystrokes.length >= windowSize) {
        evaluateSlidingWindow();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clearNotepad = () => {
    setTypedContent('');
    setRunningKeystrokes([]);
    setScore(null);
    setIsGenuine(true);
    setAnomalyCounter(0);
    setSpeedSec(0);
    setDwellMs(0);
    setBackspaceCount(0);
    keyCounterRef.current = 0;
  };

  // Calculate active threshold value
  const currentThreshold = thresholds[activeProfile as keyof typeof thresholds] || 0.5;

  // Calculate needle angle (-90 to +90 degrees)
  const displayScore = score !== null ? score : 1.0;
  const needleRotation = (displayScore * 180) - 90; // Map [0, 1] -> [-90, 90]

  // Decide meter color
  let meterColor = 'var(--success)';
  if (displayScore < currentThreshold) {
    meterColor = 'var(--error)';
  } else if (displayScore < currentThreshold + 0.1) {
    meterColor = 'var(--warning)';
  }

  // Anomaly alert triggers when continuous anomalies cross a tolerance threshold (e.g. 2 ticks)
  const showSecurityAlert = !isGenuine && anomalyCounter >= 1;

  return (
    <div className="grid-2" style={{ marginBottom: '24px' }}>
      
      {/* Typing Notepad Panel */}
      <div className={`card ${showSecurityAlert ? 'hijack-alert-glow' : ''}`}>
        <div className="card-title">
          <Radio size={20} color="var(--brand-orange)" />
          Continuous Session Simulator (Notepad)
        </div>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px', lineHeight: '1.4' }}>
          Type freely below. Try typing at your normal pace. Then, deliberately switch to typing with one hand, or type extremely slowly, to simulate an unauthorized user taking over your terminal.
        </p>

        <textarea
          className="key-capture-area"
          style={{ minHeight: '240px', marginBottom: '16px' }}
          value={typedContent}
          onChange={(e) => setTypedContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          placeholder="Start typing anything here to initiate Zero-Trust telemetry logging..."
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
            Buffered Key Events: {runningKeystrokes.length} / {windowSize * 2}
          </div>
          <button className="btn btn-secondary" onClick={clearNotepad}>
            Clear Editor
          </button>
        </div>
      </div>

      {/* Zero Trust Score Monitor Panel */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="card-title">
            <Sliders size={20} color="var(--brand-teal)" />
            Zero-Trust Identity Verification Engine
          </div>

          {/* Profile Selector */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {['low_friction', 'balanced', 'high_security'].map((prof) => (
              <button
                key={prof}
                className="btn"
                style={{
                  flexGrow: 1,
                  padding: '8px 10px',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  background: activeProfile === prof ? 'var(--bg-tertiary)' : 'transparent',
                  border: `1px solid ${activeProfile === prof ? 'var(--brand-orange)' : 'var(--border-color)'}`,
                  color: activeProfile === prof ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
                onClick={() => changeProfile(prof)}
              >
                {prof.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Speedometer Gauge */}
          <div className="gauge-wrapper">
            <div className="gauge-container">
              <div className="gauge-arc" />
              {/* Highlight arc */}
              <div 
                className="gauge-value-arc" 
                style={{ 
                  transform: `rotate(${displayScore * 180}deg)`,
                  borderColor: meterColor
                }} 
              />
              {/* Threshold indicator line */}
              <div 
                style={{
                  position: 'absolute',
                  width: '2px',
                  height: '110px',
                  backgroundColor: 'var(--brand-orange)',
                  left: '109px',
                  bottom: 0,
                  transformOrigin: 'bottom center',
                  transform: `rotate(${(currentThreshold * 180) - 90}deg)`,
                  zIndex: 2,
                  boxShadow: '0 0 5px var(--brand-orange)'
                }}
              />
              {/* Needle */}
              <div className="gauge-needle" style={{ transform: `rotate(${needleRotation}deg)` }} />
            </div>

            <div className="gauge-center-text">
              <div className="gauge-percentage" style={{ color: meterColor }}>
                {score !== null ? `${Math.round(score * 100)}%` : '--'}
              </div>
              <div className="gauge-label">
                Identity Confidence
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Threat Notification */}
        <div style={{ marginTop: '16px' }}>
          {showSecurityAlert ? (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--brand-red)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--brand-red)'
            }}>
              <ShieldAlert size={28} />
              <div>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Threat: Session Anomalous</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Typing dynamics mismatch. Cortex Agent triggers step-up MFA.
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--success)'
            }}>
              <CheckCircle size={28} />
              <div>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Session Secure</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Keystroke biometrics verified. Active threshold: {Math.round(currentThreshold * 100)}%.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Real-time stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginTop: '16px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '16px'
        }}>
          <div className="stat-card" style={{ padding: '10px', textAlign: 'center' }}>
            <div className="stat-label" style={{ fontSize: '0.65rem' }}>Dwell Time</div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>{Math.round(dwellMs)}ms</div>
          </div>
          <div className="stat-card" style={{ padding: '10px', textAlign: 'center' }}>
            <div className="stat-label" style={{ fontSize: '0.65rem' }}>Typing Speed</div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>{speedSec.toFixed(1)} K/s</div>
          </div>
          <div className="stat-card" style={{ padding: '10px', textAlign: 'center' }}>
            <div className="stat-label" style={{ fontSize: '0.65rem' }}>Errors (BS)</div>
            <div className="stat-value" style={{ fontSize: '1rem', color: backspaceCount > 2 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {backspaceCount}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
