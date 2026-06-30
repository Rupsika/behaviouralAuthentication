import time
import numpy as np
from typing import Dict, List, Any, Tuple
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from app.models.classifiers import BaseAuthModel

def calculate_far_frr(y_true: np.ndarray, y_prob: np.ndarray, threshold: float) -> Tuple[float, float]:
    """
    Computes False Acceptance Rate (FAR) and False Rejection Rate (FRR)
    for a given decision threshold.
    y_true: binary labels (1 = genuine, 0 = impostor)
    y_prob: predicted probabilities of being genuine
    """
    y_pred = (y_prob >= threshold).astype(int)
    
    # Class 0: Impostor, Class 1: Genuine
    impostors = (y_true == 0)
    genuine = (y_true == 1)
    
    total_impostors = int(np.sum(impostors))
    total_genuine = int(np.sum(genuine))
    
    # FP: Impostor classified as Genuine (y_true=0, y_pred=1)
    fp = int(np.sum((y_true == 0) & (y_pred == 1)))
    # FN: Genuine classified as Impostor (y_true=1, y_pred=0)
    fn = int(np.sum((y_true == 1) & (y_pred == 0)))
    
    far = float(fp / total_impostors) if total_impostors > 0 else 0.0
    frr = float(fn / total_genuine) if total_genuine > 0 else 0.0
    
    return far, frr

def evaluate_threshold_curves(y_true: np.ndarray, y_prob: np.ndarray, steps: int = 100) -> List[Dict[str, float]]:
    """
    Computes FAR and FRR across a range of thresholds from 0.0 to 1.0.
    """
    thresholds = np.linspace(0.0, 1.0, steps)
    curve = []
    for t in thresholds:
        far, frr = calculate_far_frr(y_true, y_prob, t)
        curve.append({
            "threshold": float(t),
            "far": far,
            "frr": frr
        })
    return curve

def find_eer(curve: List[Dict[str, float]]) -> Tuple[float, float]:
    """
    Finds the Equal Error Rate (EER) threshold and value from the FAR/FRR curves.
    EER is the point where FAR and FRR are closest.
    Returns: (eer_threshold, eer_value)
    """
    min_diff = float('inf')
    eer_threshold = 0.5
    eer_val = 0.5
    
    for pt in curve:
        diff = abs(pt["far"] - pt["frr"])
        if diff < min_diff:
            min_diff = diff
            eer_threshold = pt["threshold"]
            # EER is the average of FAR and FRR at the closest point
            eer_val = (pt["far"] + pt["frr"]) / 2.0
            
    return eer_threshold, eer_val

def get_optimal_thresholds(y_true: np.ndarray, y_prob: np.ndarray) -> Dict[str, Dict[str, float]]:
    """
    Calculates operational decision thresholds for different security profiles:
    - Balanced (EER)
    - High Security (Minimizes FAR, targets FAR <= 0.02 if possible)
    - Low Friction (Minimizes FRR, targets FRR <= 0.02 if possible)
    """
    curve = evaluate_threshold_curves(y_true, y_prob, steps=200)
    eer_thresh, eer_val = find_eer(curve)
    
    # High Security: select highest threshold where FAR <= 0.02, or the threshold that minimizes FAR.
    high_sec_candidates = [pt for pt in curve if pt["far"] <= 0.02]
    if high_sec_candidates:
        # Of those, pick the one with the lowest FRR (usually lower threshold among candidates)
        best_high_sec = min(high_sec_candidates, key=lambda pt: pt["frr"])
        high_sec_thresh = best_high_sec["threshold"]
        high_sec_far = best_high_sec["far"]
        high_sec_frr = best_high_sec["frr"]
    else:
        # Default to minimizing FAR
        best_high_sec = min(curve, key=lambda pt: (pt["far"], pt["frr"]))
        high_sec_thresh = best_high_sec["threshold"]
        high_sec_far = best_high_sec["far"]
        high_sec_frr = best_high_sec["frr"]

    # Low Friction: select lowest threshold where FRR <= 0.02, or the threshold that minimizes FRR.
    low_fric_candidates = [pt for pt in curve if pt["frr"] <= 0.02]
    if low_fric_candidates:
        best_low_fric = min(low_fric_candidates, key=lambda pt: pt["far"])
        low_fric_thresh = best_low_fric["threshold"]
        low_fric_far = best_low_fric["far"]
        low_fric_frr = best_low_fric["frr"]
    else:
        best_low_fric = min(curve, key=lambda pt: (pt["frr"], pt["far"]))
        low_fric_thresh = best_low_fric["threshold"]
        low_fric_far = best_low_fric["far"]
        low_fric_frr = best_low_fric["frr"]

    return {
        "balanced": {"threshold": eer_thresh, "far": eer_val, "frr": eer_val},
        "high_security": {"threshold": high_sec_thresh, "far": high_sec_far, "frr": high_sec_frr},
        "low_friction": {"threshold": low_fric_thresh, "far": low_fric_far, "frr": low_fric_frr}
    }

def evaluate_model_cross_validation(
    model: BaseAuthModel, 
    X: np.ndarray, 
    y: np.ndarray, 
    n_splits: int = 5
) -> Dict[str, Any]:
    """
    Evaluates a model using Stratified K-Fold cross-validation.
    Measures metrics including accuracy, f1, EER, and average inference latency.
    """
    # If we have too few samples of either class, adjust splits dynamically
    unique, counts = np.unique(y, return_counts=True)
    min_class_samples = min(counts) if len(counts) > 1 else 0
    actual_splits = min(n_splits, min_class_samples)
    
    if actual_splits < 2:
        # Fall back to a simple train/test split if data is too scarce
        return _evaluate_fallback(model, X, y)
        
    skf = StratifiedKFold(n_splits=actual_splits, shuffle=True, random_state=42)
    
    accuracies, precisions, recalls, f1s = [], [], [], []
    all_y_true = []
    all_y_prob = []
    latencies = []
    
    for train_idx, test_idx in skf.split(X, y):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]
        
        # Clone strategy object implicitly by retraining it
        # (This is safe since sklearn fit overwrites model coefficients/weights)
        model.train(X_train, y_train)
        
        # Benchmark prediction latency (milliseconds per sample)
        start_time = time.perf_counter()
        probs = model.predict_proba(X_test)
        end_time = time.perf_counter()
        
        latency_ms = ((end_time - start_time) * 1000.0) / len(X_test)
        latencies.append(latency_ms)
        
        preds = (probs >= 0.5).astype(int)
        
        accuracies.append(accuracy_score(y_test, preds))
        precisions.append(precision_score(y_test, preds, zero_division=0))
        recalls.append(recall_score(y_test, preds, zero_division=0))
        f1s.append(f1_score(y_test, preds, zero_division=0))
        
        all_y_true.extend(y_test)
        all_y_prob.extend(probs)
        
    # Aggregate curves across all folds
    all_y_true_arr = np.array(all_y_true)
    all_y_prob_arr = np.array(all_y_prob)
    
    curve = evaluate_threshold_curves(all_y_true_arr, all_y_prob_arr)
    eer_thresh, eer_val = find_eer(curve)
    
    return {
        "model_name": model.get_model_name(),
        "accuracy": float(np.mean(accuracies)),
        "precision": float(np.mean(precisions)),
        "recall": float(np.mean(recalls)),
        "f1_score": float(np.mean(f1s)),
        "eer": eer_val,
        "eer_threshold": eer_thresh,
        "mean_latency_ms": float(np.mean(latencies)),
        "threshold_curves": curve
    }

def _evaluate_fallback(model: BaseAuthModel, X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    """Helper method for evaluation when data size is too small for cross-validation."""
    # Split 75/25
    n_samples = len(X)
    split_idx = int(n_samples * 0.75)
    
    # Shuffle indices
    indices = np.random.permutation(n_samples)
    train_idx, test_idx = indices[:split_idx], indices[split_idx:]
    
    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]
    
    model.train(X_train, y_train)
    
    start_time = time.perf_counter()
    probs = model.predict_proba(X_test) if len(X_test) > 0 else np.array([])
    end_time = time.perf_counter()
    
    latency_ms = ((end_time - start_time) * 1000.0) / len(X_test) if len(X_test) > 0 else 0.0
    preds = (probs >= 0.5).astype(int) if len(probs) > 0 else np.array([])
    
    acc = float(accuracy_score(y_test, preds)) if len(y_test) > 0 else 0.0
    prec = float(precision_score(y_test, preds, zero_division=0)) if len(y_test) > 0 else 0.0
    rec = float(recall_score(y_test, preds, zero_division=0)) if len(y_test) > 0 else 0.0
    f1 = float(f1_score(y_test, preds, zero_division=0)) if len(y_test) > 0 else 0.0
    
    curve = evaluate_threshold_curves(y_test, probs) if len(y_test) > 0 else []
    eer_thresh, eer_val = find_eer(curve) if curve else (0.5, 0.0)
    
    return {
        "model_name": model.get_model_name(),
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1_score": f1,
        "eer": eer_val,
        "eer_threshold": eer_thresh,
        "mean_latency_ms": latency_ms,
        "threshold_curves": curve
    }
