export interface KeystrokeEvent {
  key: string;
  event_type: 'keydown' | 'keyup';
  timestamp: number; // in milliseconds
}

export interface EnrollResponse {
  username: string;
  sample_index: number;
  total_samples: number;
  message: string;
}

export interface TrainResponse {
  username: string;
  success: boolean;
  model_name: string;
  accuracy: number;
  f1_score: number;
  eer: number;
  thresholds: {
    balanced: number;
    high_security: number;
    low_friction: number;
  };
}

export interface VerifyResponse {
  username: string;
  score: number;
  is_genuine: boolean;
  active_profile: string;
  applied_threshold: number;
}

export interface ScoreResponse {
  username: string;
  score: number;
  is_genuine: boolean;
  active_profile: string;
  applied_threshold: number;
}

export interface UserInfoResponse {
  username: string;
  is_enrolled: boolean;
  model_type: string;
  active_profile: string;
  thresholds: {
    balanced: number;
    high_security: number;
    low_friction: number;
  };
}

export interface SessionLogEntry {
  id: number;
  score: number;
  applied_threshold: number;
  applied_profile: string;
  is_anomalous: boolean;
  keystroke_count: number;
  timestamp: string;
}

const API_BASE = 'http://localhost:8000/api';

export const api = {
  async enroll(username: string, events: KeystrokeEvent[]): Promise<EnrollResponse> {
    const res = await fetch(`${API_BASE}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, events }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to enroll sample');
    }
    return res.json();
  },

  async train(username: string, modelType: string): Promise<TrainResponse> {
    const res = await fetch(`${API_BASE}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, model_type: modelType }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to train model');
    }
    return res.json();
  },

  async verify(username: string, events: KeystrokeEvent[]): Promise<VerifyResponse> {
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, events }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to verify');
    }
    return res.json();
  },

  async score(username: string, events: KeystrokeEvent[]): Promise<ScoreResponse> {
    const res = await fetch(`${API_BASE}/session/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, events }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to score session');
    }
    return res.json();
  },

  async updateProfile(username: string, profile: string): Promise<UserInfoResponse> {
    const res = await fetch(`${API_BASE}/user/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, profile }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to update security profile');
    }
    return res.json();
  },

  async getUserInfo(username: string): Promise<UserInfoResponse> {
    const res = await fetch(`${API_BASE}/user/${username}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'User not found');
    }
    return res.json();
  },

  async getUserLogs(username: string, limit = 15): Promise<SessionLogEntry[]> {
    const res = await fetch(`${API_BASE}/user/${username}/logs?limit=${limit}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to fetch logs');
    }
    return res.json();
  }
};
