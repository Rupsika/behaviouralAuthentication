import os
import sys
import pandas as pd
import numpy as np

# Ensure backend directory is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.classifiers import LogisticRegressionModel, SVMModel, RandomForestModel
from app.models.pipeline import evaluate_model_cross_validation, get_optimal_thresholds

def generate_synthetic_user_samples(
    n_samples: int = 10,
    dwell_mean: float = 145.0,
    dwell_std: float = 12.0,
    flight_mean: float = 195.0,
    flight_std: float = 20.0,
    speed_mean: float = 5.2,
    speed_std: float = 0.4,
    backspace_mean: float = 0.03,
    backspace_std: float = 0.01,
    pause_mean: float = 1.0,
    pause_std: float = 0.5
) -> pd.DataFrame:
    """Generates synthetic keystroke features representing a user's normal typing dynamics."""
    np.random.seed(42)
    
    dwells = np.random.normal(dwell_mean, dwell_std, n_samples)
    std_dwells = np.random.normal(dwell_std * 1.2, dwell_std * 0.2, n_samples)
    flights = np.random.normal(flight_mean, flight_std, n_samples)
    speeds = np.random.normal(speed_mean, speed_std, n_samples)
    backspaces = np.clip(np.random.normal(backspace_mean, backspace_std, n_samples), 0, 1)
    pauses = np.clip(np.random.normal(pause_mean, pause_std, n_samples), 0, None).astype(int)
    
    df = pd.DataFrame({
        "mean_dwell_time": dwells,
        "std_dwell_time": std_dwells,
        "mean_flight_time": flights,
        "typing_speed": speeds,
        "backspace_rate": backspaces,
        "pause_frequency": pauses
    })
    return df

def run_simulation():
    print("=" * 60)
    print("CORTEX-GUARD: TYPING DYNAMICS MODEL EVALUATION PIPELINE")
    print("=" * 60)
    
    # 1. Locate baseline CSV file
    csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../keystroke_behavioral_authentication_v3.csv"))
    if not os.path.exists(csv_path):
        print(f"[-] Error: Could not find baseline CSV file at: {csv_path}")
        sys.exit(1)
        
    print(f"[+] Loaded baseline background dataset: {csv_path}")
    base_df = pd.read_csv(csv_path)
    
    # 2. Generate genuine user profile (User 999)
    print("[+] Simulating enrollment typing samples for target user (User 999)...")
    genuine_df = generate_synthetic_user_samples(n_samples=12)
    genuine_df["label"] = 1
    
    # 3. Create impostor dataset from baseline CSV
    # We will sample 50 records from other users in the dataset as the impostor cohort
    print("[+] Selecting background impostor cohort from baseline dataset...")
    impostor_raw = base_df.sample(n=60, random_state=42)
    
    feature_cols = [
        "mean_dwell_time", 
        "std_dwell_time", 
        "mean_flight_time", 
        "typing_speed", 
        "backspace_rate", 
        "pause_frequency"
    ]
    
    impostor_df = impostor_raw[feature_cols].copy()
    impostor_df["label"] = 0
    
    # 4. Construct dataset
    full_df = pd.concat([genuine_df, impostor_df], ignore_index=True)
    X = full_df[feature_cols].values
    y = full_df["label"].values
    
    print(f"[+] Prepared training dataset: {len(genuine_df)} Genuine samples, {len(impostor_df)} Impostor samples.")
    
    # 5. Benchmarking model strategies
    models = [
        LogisticRegressionModel(),
        SVMModel(),
        RandomForestModel()
    ]
    
    results = []
    print("\n[+] Training and evaluating models using cross-validation...")
    for model in models:
        # Cross-validation
        eval_metrics = evaluate_model_cross_validation(model, X, y, n_splits=4)
        
        # Fit once on full dataset to get threshold curves
        model.train(X, y)
        probs = model.predict_proba(X)
        threshold_info = get_optimal_thresholds(y, probs)
        
        results.append({
            "name": model.get_model_name(),
            "accuracy": eval_metrics["accuracy"],
            "f1": eval_metrics["f1_score"],
            "eer": eval_metrics["eer"],
            "eer_threshold": eval_metrics["eer_threshold"],
            "latency": eval_metrics["mean_latency_ms"],
            "thresholds": threshold_info
        })
        
    # 6. Display results
    print("\n" + "=" * 80)
    print(f"{'Classifier Model':<22} | {'Accuracy':<10} | {'F1-Score':<10} | {'EER':<10} | {'EER Threshold':<13} | {'Inference Latency':<18}")
    print("-" * 80)
    for res in results:
        print(f"{res['name']:<22} | {res['accuracy']:<10.4f} | {res['f1']:<10.4f} | {res['eer']:<10.4f} | {res['eer_threshold']:<13.2f} | {res['latency'] * 1000:<13.2f} microseconds")
    print("=" * 80)
    
    print("\n[+] Optimized Security Profile Thresholds:")
    for res in results:
        print(f"\nModel: {res['name']}")
        t_info = res["thresholds"]
        print(f"  - Balanced Profile (EER):      Threshold={t_info['balanced']['threshold']:.3f} (FAR={t_info['balanced']['far'] * 100:.1f}%, FRR={t_info['balanced']['frr'] * 100:.1f}%)")
        print(f"  - High Security Profile (Low FAR): Threshold={t_info['high_security']['threshold']:.3f} (FAR={t_info['high_security']['far'] * 100:.1f}%, FRR={t_info['high_security']['frr'] * 100:.1f}%)")
        print(f"  - Low Friction Profile (Low FRR): Threshold={t_info['low_friction']['threshold']:.3f} (FAR={t_info['low_friction']['far'] * 100:.1f}%, FRR={t_info['low_friction']['frr'] * 100:.1f}%)")
    print("\n" + "=" * 60)

if __name__ == "__main__":
    run_simulation()
