import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import type { TrainResponse, SessionLogEntry } from './services/api';
import { EnrollmentPanel } from './components/EnrollmentPanel';
import { VerificationPanel } from './components/VerificationPanel';
import { SessionSimulator } from './components/SessionSimulator';
import { PerformanceAnalytics } from './components/PerformanceAnalytics';
import { Shield, BarChart2, Radio, Terminal, Settings, UserCheck, AlertOctagon } from 'lucide-react';

function App() {
  const [username, setUsername] = useState('alice_cortex');
  const [activeTab, setActiveTab] = useState<'enroll' | 'verify' | 'session' | 'analytics'>('enroll');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [modelType, setModelType] = useState('LogisticRegression');
  const [activeProfile, setActiveProfile] = useState('balanced');
  const [thresholds, setThresholds] = useState({
    balanced: 0.5,
    high_security: 0.7,
    low_friction: 0.3
  });
  
  const [lastTraining, setLastTraining] = useState<any>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState('LogisticRegression');
  const [_generalError, setGeneralError] = useState<string | null>(null);

  // Sync user profile state from API on load / username modification
  const syncUserProfile = async (targetUser: string) => {
    try {
      setGeneralError(null);
      const info = await api.getUserInfo(targetUser);
      setIsEnrolled(info.is_enrolled);
      setModelType(info.model_type);
      setActiveProfile(info.active_profile);
      setThresholds({
        balanced: info.thresholds.balanced,
        high_security: info.thresholds.high_security,
        low_friction: info.thresholds.low_friction
      });
      fetchLogs(targetUser);
    } catch (err: any) {
      // User does not exist in db, reset states
      setIsEnrolled(false);
      setModelType('LogisticRegression');
      setSessionLogs([]);
    }
  };

  const fetchLogs = async (targetUser: string) => {
    try {
      const logs = await api.getUserLogs(targetUser, 8);
      setSessionLogs(logs);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  };

  useEffect(() => {
    syncUserProfile(username);
  }, [username]);

  // Periodically fetch logs during continuous notepad typing (to keep event log table updated)
  useEffect(() => {
    let interval: any;
    if (activeTab === 'session' && isEnrolled) {
      interval = setInterval(() => {
        fetchLogs(username);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTab, isEnrolled, username]);

  const handleEnrollmentComplete = (trainRes: TrainResponse) => {
    setIsEnrolled(true);
    setModelType(trainRes.model_name);
    setThresholds({
      balanced: trainRes.thresholds.balanced,
      high_security: trainRes.thresholds.high_security,
      low_friction: trainRes.thresholds.low_friction
    });
    setLastTraining({
      model_name: trainRes.model_name,
      accuracy: trainRes.accuracy,
      f1_score: trainRes.f1_score,
      eer: trainRes.eer
    });
    fetchLogs(username);
    setActiveTab('session'); // auto navigate to live testing
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (val) {
      setUsername(val);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-header">
          <Shield size={28} color="var(--brand-orange)" />
          <h1 className="brand-logo">CORTEX<span>GUARD</span></h1>
        </div>

        <nav>
          <ul className="nav-menu">
            <li>
              <div 
                className={`nav-item ${activeTab === 'enroll' ? 'active' : ''}`}
                onClick={() => setActiveTab('enroll')}
              >
                <Settings size={18} />
                Enroll Profile
              </div>
            </li>
            <li>
              <div 
                className={`nav-item ${!isEnrolled ? 'disabled' : ''} ${activeTab === 'verify' ? 'active' : ''}`}
                style={{ opacity: isEnrolled ? 1 : 0.5, cursor: isEnrolled ? 'pointer' : 'not-allowed' }}
                onClick={() => isEnrolled && setActiveTab('verify')}
              >
                <UserCheck size={18} />
                Single-Shot Test
              </div>
            </li>
            <li>
              <div 
                className={`nav-item ${!isEnrolled ? 'disabled' : ''} ${activeTab === 'session' ? 'active' : ''}`}
                style={{ opacity: isEnrolled ? 1 : 0.5, cursor: isEnrolled ? 'pointer' : 'not-allowed' }}
                onClick={() => isEnrolled && setActiveTab('session')}
              >
                <Radio size={18} />
                Notepad Simulator
              </div>
            </li>
            <li>
              <div 
                className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <BarChart2 size={18} />
                ML Analytics
              </div>
            </li>
          </ul>
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>
            Session Context
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.7rem' }}>Operator ID</label>
            <input 
              type="text" 
              className="form-input" 
              defaultValue={username} 
              onBlur={handleUsernameChange}
              placeholder="e.g. alice_cortex"
              style={{ padding: '8px' }}
            />
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <div>State: {isEnrolled ? (
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>Enrolled</span>
            ) : (
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Unenrolled</span>
            )}</div>
            {isEnrolled && (
              <div style={{ marginTop: '4px' }}>
                Strategy: <span style={{ fontFamily: 'var(--font-mono)' }}>{modelType}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Top telemetry banner */}
        <div style={{
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px',
          marginBottom: '32px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Continuous Behavioral Biometrics</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Zero-Trust identity verification concepts for endpoint telemetry defense.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="badge badge-success" style={{ background: 'rgba(0, 229, 255, 0.05)', color: 'var(--brand-teal)', borderColor: 'rgba(0, 229, 255, 0.2)' }}>
              Cortex XDR v8.4
            </div>
            <div className="badge badge-success">
              DB Connected
            </div>
          </div>
        </div>

        {/* Dynamic Panels */}
        {activeTab === 'enroll' && (
          <EnrollmentPanel 
            username={username} 
            onEnrollmentComplete={handleEnrollmentComplete}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
          />
        )}

        {activeTab === 'verify' && isEnrolled && (
          <VerificationPanel username={username} />
        )}

        {activeTab === 'session' && isEnrolled && (
          <SessionSimulator 
            username={username}
            activeProfile={activeProfile}
            setActiveProfile={setActiveProfile}
            thresholds={thresholds}
          />
        )}

        {activeTab === 'analytics' && (
          <PerformanceAnalytics lastTrainingResult={lastTraining} />
        )}

        {/* Continuous Log Table (always displayed at the bottom) */}
        {isEnrolled && (
          <div className="card" style={{ marginTop: '32px' }}>
            <div className="card-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} color="var(--brand-orange)" />
                Cortex continuous Telemetry Logs (Real-time)
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => fetchLogs(username)}
              >
                Refresh Log
              </button>
            </div>

            {sessionLogs.length > 0 ? (
              <div className="table-wrapper">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Biometric Confidence</th>
                      <th>Applied Threshold</th>
                      <th>Security Profile</th>
                      <th>Key Count</th>
                      <th>Threat Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionLogs.map((log) => (
                      <tr key={log.id} style={{
                        backgroundColor: log.is_anomalous ? 'rgba(239, 68, 68, 0.03)' : 'transparent'
                      }}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td style={{
                          fontWeight: 700,
                          color: log.is_anomalous ? 'var(--brand-red)' : 'var(--success)'
                        }}>
                          {Math.round(log.score * 100)}%
                        </td>
                        <td>{Math.round(log.applied_threshold * 100)}%</td>
                        <td style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>
                          {log.applied_profile.replace('_', ' ')}
                        </td>
                        <td>{log.keystroke_count}</td>
                        <td>
                          {log.is_anomalous ? (
                            <span className="badge badge-error" style={{ fontSize: '0.7rem' }}>
                              <AlertOctagon size={12} style={{ marginRight: '4px' }} />
                              Anomaly
                            </span>
                          ) : (
                            <span className="badge badge-success" style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                              Verified
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center', padding: '16px' }}>
                No continuous verification logs recorded yet. Begin typing in the Notepad Simulator to generate telemetry.
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
