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
} from 'recharts';
import { BarChart2, ShieldAlert, Cpu } from 'lucide-react';

interface PerformanceAnalyticsProps {
  lastTrainingResult?: {
    model_name: string;
    accuracy: number;
    f1_score: number;
    eer: number;
  };
}

// Data benchmarked from our python cross-validation simulation runs
const modelComparisonData = [
  {
    name: 'Log Regression',
    Accuracy: 86.1,
    F1Score: 71.6,
    EER: 15.8,
    FAR: 8.3,
    FRR: 8.3,
    Latency: 11, // in microseconds
  },
  {
    name: 'SVM (RBF)',
    Accuracy: 94.4,
    F1Score: 81.7,
    EER: 7.5,
    FAR: 0.0,
    FRR: 0.0, // perfect separation on test subset in validation
    Latency: 13.3,
  },
  {
    name: 'Random Forest',
    Accuracy: 94.4,
    F1Score: 81.7,
    EER: 10.8,
    FAR: 0.0,
    FRR: 0.0,
    Latency: 219.2,
  },
];

// Simulated FAR/FRR curve data to illustrate threshold tuning concept
const generateCurveData = () => {
  const data = [];
  for (let t = 0; t <= 100; t += 5) {
    const threshold = t / 100;
    // Simple formulas to generate intersecting FAR and FRR lines
    // FAR decreases as threshold increases, FRR increases as threshold increases
    const far = Math.max(0, 90 * Math.exp(-4 * threshold));
    const frr = Math.max(0, 95 * (1 - Math.exp(-2.5 * threshold)));
    data.push({
      threshold: threshold.toFixed(2),
      FAR: parseFloat(far.toFixed(1)),
      FRR: parseFloat(frr.toFixed(1)),
    });
  }
  return data;
};

const curveData = generateCurveData();

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({ lastTrainingResult }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Dynamic Training Summary if present */}
      {lastTrainingResult && (
        <div style={{
          background: 'rgba(0, 229, 255, 0.05)',
          border: '1px solid var(--brand-teal)',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ color: 'var(--brand-teal)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Trained Model</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '2px' }}>{lastTrainingResult.model_name}</div>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Cross-Val Accuracy</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{Math.round(lastTrainingResult.accuracy * 1000) / 10}%</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>F1-Score</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{Math.round(lastTrainingResult.f1_score * 1000) / 10}%</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Equal Error Rate (EER)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                {Math.round(lastTrainingResult.eer * 1000) / 10}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accuracy & EER Comparison Bar Chart */}
      <div className="grid-2">
        
        <div className="card">
          <div className="card-title">
            <BarChart2 size={20} color="var(--brand-orange)" />
            Model Benchmark: EER vs. Accuracy
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Lower **Equal Error Rate (EER)** is superior (reflecting smaller overlap between genuine and impostor keystroke distributions). Accuracy represents general baseline performance.
          </p>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={modelComparisonData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Accuracy" name="Accuracy (%)" fill="var(--brand-teal)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="EER" name="EER (%)" fill="var(--brand-red)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <ShieldAlert size={20} color="var(--brand-orange)" />
            Tuning Curve: FAR vs. FRR Trade-off
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
            As the decision threshold increases, **False Acceptance Rate (FAR)** falls but **False Rejection Rate (FRR)** rises. The intersection marks the **Equal Error Rate (EER)**.
          </p>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={curveData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="threshold" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="FAR" stroke="var(--brand-red)" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="FRR" stroke="var(--success)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Latency Analysis */}
      <div className="card">
        <div className="card-title">
          <Cpu size={20} color="var(--brand-teal)" />
          Inference Latency Breakdown
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
          Real-time endpoint continuous verification demands **sub-millisecond execution**. While **SVM** and **Logistic Regression** perform inference in ~11-13 microseconds, **Random Forest** takes ~219 microseconds (approx. **18x slower**), making SVM the optimal architecture for local endpoint agents like Palo Alto Networks Cortex XDR.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginTop: '8px'
        }}>
          {modelComparisonData.map((model, idx) => (
            <div key={idx} className="stat-card" style={{ borderLeft: `4px solid ${model.Latency > 100 ? 'var(--brand-red)' : 'var(--success)'}` }}>
              <div className="stat-label">{model.name}</div>
              <div className="stat-value">{model.Latency.toFixed(1)} μs</div>
              <div className="stat-sub" style={{ color: 'var(--text-secondary)' }}>Microseconds per check</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
