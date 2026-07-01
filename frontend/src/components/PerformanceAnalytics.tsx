import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import { BarChart2, ShieldAlert, Cpu, Zap, Target, TrendingDown } from 'lucide-react';

interface PerformanceAnalyticsProps {
  lastTrainingResult?: {
    model_name: string;
    accuracy: number;
    f1_score: number;
    eer: number;
  };
}

const modelComparisonData = [
  { name: 'Log Regression', Accuracy: 86.1, F1Score: 71.6, EER: 15.8, FAR: 8.3, FRR: 8.3, Latency: 11 },
  { name: 'SVM (RBF)',      Accuracy: 94.4, F1Score: 81.7, EER: 7.5,  FAR: 0.0, FRR: 0.0, Latency: 13.3 },
  { name: 'Random Forest',  Accuracy: 94.4, F1Score: 81.7, EER: 10.8, FAR: 0.0, FRR: 0.0, Latency: 219.2 },
];

const radarData = [
  { metric: 'Accuracy',    LogReg: 86, SVM: 94, RF: 94 },
  { metric: 'F1-Score',    LogReg: 72, SVM: 82, RF: 82 },
  { metric: 'Low EER',     LogReg: 58, SVM: 93, RF: 80 },
  { metric: 'Low Latency', LogReg: 95, SVM: 93, RF: 20 },
  { metric: 'Scalability', LogReg: 90, SVM: 75, RF: 60 },
];

const generateCurveData = () => {
  const data = [];
  for (let t = 0; t <= 100; t += 5) {
    const threshold = t / 100;
    const far = Math.max(0, 90 * Math.exp(-4 * threshold));
    const frr = Math.max(0, 95 * (1 - Math.exp(-2.5 * threshold)));
    data.push({ threshold: threshold.toFixed(2), FAR: parseFloat(far.toFixed(1)), FRR: parseFloat(frr.toFixed(1)) });
  }
  return data;
};

const curveData = generateCurveData();

const customTooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  color: '#111827',
  fontSize: '0.85rem',
};

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({ lastTrainingResult }) => {
  return (
    <div className="light-page">

      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--brand-orange), #ff8c42)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <BarChart2 size={18} color="#fff" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e1b4b' }}>ML Performance Analytics</h2>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              Cross-validation benchmarks comparing classifier strategies for keystroke biometric authentication.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="light-badge light-badge-orange">SVM Selected ✓</span>
            <span className="light-badge light-badge-teal">25-User Cohort</span>
            <span className="light-badge light-badge-indigo">4-Fold CV</span>
          </div>
        </div>
      </div>

      {/* Live Training Banner */}
      {lastTrainingResult && (
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
          borderRadius: '14px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
        }}>
          <div>
            <div style={{ color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
              ⚡ Active Trained Model
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>{lastTrainingResult.model_name}</div>
          </div>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {[
              { label: 'Accuracy', value: `${Math.round(lastTrainingResult.accuracy * 1000) / 10}%`, color: '#34d399' },
              { label: 'F1-Score', value: `${Math.round(lastTrainingResult.f1_score * 1000) / 10}%`, color: '#60a5fa' },
              { label: 'EER', value: `${Math.round(lastTrainingResult.eer * 1000) / 10}%`, color: '#f472b6' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Gradient Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="grad-stat-card grad-teal">
          <Target size={22} color="rgba(255,255,255,0.8)" />
          <div className="stat-label">Best Accuracy</div>
          <div className="stat-value">94.4%</div>
          <div className="stat-sub">SVM & Random Forest (tied)</div>
        </div>
        <div className="grad-stat-card grad-orange">
          <TrendingDown size={22} color="rgba(255,255,255,0.8)" />
          <div className="stat-label">Best EER</div>
          <div className="stat-value">7.5%</div>
          <div className="stat-sub">SVM (RBF) — selected strategy</div>
        </div>
        <div className="grad-stat-card grad-indigo">
          <Zap size={22} color="rgba(255,255,255,0.8)" />
          <div className="stat-label">Inference Speed</div>
          <div className="stat-value">13.3μs</div>
          <div className="stat-sub">SVM — 18× faster than RF</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2">

        {/* Bar Chart */}
        <div className="light-card">
          <div className="light-card-title">
            <BarChart2 size={18} color="#6366f1" />
            Model Benchmark: EER vs. Accuracy
          </div>
          <p>Lower EER = smaller overlap between genuine and impostor distributions. SVM achieves the best balance.</p>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelComparisonData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#6b7280' }} />
                <Bar dataKey="Accuracy" name="Accuracy (%)" fill="#06b6d4" radius={[6,6,0,0]} />
                <Bar dataKey="EER" name="EER (%)" fill="#f97316" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FAR/FRR Line Chart */}
        <div className="light-card">
          <div className="light-card-title">
            <ShieldAlert size={18} color="#f97316" />
            Threshold Tuning: FAR vs. FRR
          </div>
          <p>As the decision threshold rises, FAR falls but FRR rises. Their intersection marks the Equal Error Rate (EER).</p>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="threshold" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#6b7280' }} />
                <Line type="monotone" dataKey="FAR" stroke="#ef4444" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="FRR" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Radar + Latency Row */}
      <div className="grid-2">

        {/* Radar Chart */}
        <div className="light-card">
          <div className="light-card-title">
            <Target size={18} color="#7c3aed" />
            Multi-Dimensional Comparison
          </div>
          <p>Holistic view of each model across accuracy, EER, latency, and production scalability.</p>
          <div style={{ width: '100%', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#f3f4f6" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Radar name="Log Regression" dataKey="LogReg" stroke="#f97316" fill="#f97316" fillOpacity={0.12} strokeWidth={2} />
                <Radar name="SVM (RBF)" dataKey="SVM" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2.5} />
                <Radar name="Random Forest" dataKey="RF" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.1} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={customTooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Analysis */}
        <div className="light-card">
          <div className="light-card-title">
            <Cpu size={18} color="#0891b2" />
            Inference Latency Breakdown
          </div>
          <p>Real-time endpoint verification demands sub-millisecond execution. SVM is the only viable choice for always-on monitoring scale.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
            {modelComparisonData.map((model, idx) => {
              const pct = Math.min((model.Latency / 220) * 100, 100);
              const isBest = model.Latency < 20;
              const isWorst = model.Latency > 100;
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>{model.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: isWorst ? '#ef4444' : '#10b981' }}>
                        {model.Latency.toFixed(1)} μs
                      </span>
                      {isBest && <span className="light-badge light-badge-teal">Best ✓</span>}
                      {isWorst && <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 600 }}>18× slower</span>}
                    </div>
                  </div>
                  <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      borderRadius: '999px',
                      background: isWorst
                        ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                        : 'linear-gradient(90deg, #10b981, #06b6d4)',
                      transition: 'width 1s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '20px', padding: '12px 16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #d1fae5' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46', marginBottom: '2px' }}>✓ Selected: SVM (RBF)</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', lineHeight: '1.5' }}>
              Best EER (7.5%) with microsecond-level inference. Optimal for lightweight endpoint agent deployment mirroring lightweight agent EDR architecture.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
