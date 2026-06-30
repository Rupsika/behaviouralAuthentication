import os
import pandas as pd
import numpy as np
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.storage.database import get_db
from app.storage.models import Base
from app.storage.database import engine
from app.storage.repository import UserRepository, EnrollmentRepository, SessionLogRepository
from app.features.extractor import FeatureExtractor
from app.models.classifiers import get_model_by_name
from app.models.pipeline import evaluate_model_cross_validation, get_optimal_thresholds
from app.api.schemas import (
    EnrollRequest, EnrollResponse, TrainRequest, TrainResponse,
    VerifyRequest, VerifyResponse, ScoreRequest, ScoreResponse,
    UpdateProfileRequest, UserInfoResponse
)

# Auto-create SQLite database tables if they do not exist
Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/api")

# Global cache for background population (impostor) features
_impostor_cache: Optional[np.ndarray] = None
FEATURE_COLS = [
    "mean_dwell_time",
    "std_dwell_time",
    "mean_flight_time",
    "typing_speed",
    "backspace_rate",
    "pause_frequency"
]

def get_impostor_features() -> np.ndarray:
    """Helper to load and cache the baseline dataset for negative samples during training."""
    global _impostor_cache
    if _impostor_cache is not None:
        return _impostor_cache
        
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.abspath(os.path.join(current_dir, "../../../keystroke_behavioral_authentication_v3.csv"))
    
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Baseline CSV file not found at: {csv_path}")
        
    df = pd.read_csv(csv_path)
    # Extract only relevant feature columns
    _impostor_cache = df[FEATURE_COLS].values
    return _impostor_cache


@router.post("/enroll", response_model=EnrollResponse)
def enroll_sample(request: EnrollRequest, db: Session = Depends(get_db)):
    # 1. Fetch or create User
    user = UserRepository.get_by_username(db, request.username)
    if not user:
        user = UserRepository.create(db, request.username)
        
    # 2. Extract features from raw keystrokes
    extractor = FeatureExtractor()
    features = extractor.extract_features(request.events)
    
    # Check if we got invalid/empty features
    if features["mean_dwell_time"] == 0.0 and features["typing_speed"] == 0.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Keystroke events could not be parsed into features. Ensure keydown/keyup timestamps are correct."
        )
        
    # 3. Save sample
    sample = EnrollmentRepository.add_sample(db, user.id, features)
    
    # 4. Count total samples enrolled so far
    all_samples = EnrollmentRepository.get_samples_by_user(db, user.id)
    total_samples = len(all_samples)
    
    return EnrollResponse(
        username=user.username,
        sample_index=total_samples,
        total_samples=total_samples,
        message=f"Sample {total_samples} enrolled successfully for user {user.username}."
    )


@router.post("/train", response_model=TrainResponse)
def train_model(request: TrainRequest, db: Session = Depends(get_db)):
    user = UserRepository.get_by_username(db, request.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{request.username}' not found. Please enroll first."
        )
        
    # Retrieve enrollment samples
    samples = EnrollmentRepository.get_samples_by_user(db, user.id)
    if len(samples) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient enrollment samples. Got {len(samples)}, require at least 5 (recommended 8-10)."
        )
        
    # Convert genuine database records into numpy feature matrix
    genuine_list = []
    for s in samples:
        genuine_list.append([
            s.mean_dwell_time,
            s.std_dwell_time,
            s.mean_flight_time,
            s.typing_speed,
            s.backspace_rate,
            s.pause_frequency
        ])
    X_genuine = np.array(genuine_list)
    y_genuine = np.ones(len(X_genuine))
    
    # Get impostor samples from the cached CSV
    try:
        X_impostor = get_impostor_features()
        # Sub-sample/select background population (e.g. up to 100 samples)
        # to prevent severe class imbalance and slow training
        if len(X_impostor) > 100:
            indices = np.random.RandomState(42).choice(len(X_impostor), size=100, replace=False)
            X_impostor = X_impostor[indices]
        y_impostor = np.zeros(len(X_impostor))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load background reference cohort: {str(e)}"
        )
        
    # Concatenate features
    X = np.vstack([X_genuine, X_impostor])
    y = np.concatenate([y_genuine, y_impostor])
    
    # Instantiate model strategy
    try:
        model = get_model_by_name(request.model_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        
    # Evaluate performance using cross-validation
    eval_metrics = evaluate_model_cross_validation(model, X, y, n_splits=4)
    
    # Fit once on full dataset to tune operational thresholds
    model.train(X, y)
    probs = model.predict_proba(X)
    thresholds = get_optimal_thresholds(y, probs)
    
    # Save serialized model and thresholds in DB
    UserRepository.save_model(db, user, model, thresholds)
    
    return TrainResponse(
        username=user.username,
        success=True,
        model_name=model.get_model_name(),
        accuracy=eval_metrics["accuracy"],
        f1_score=eval_metrics["f1_score"],
        eer=eval_metrics["eer"],
        thresholds={
            "balanced": thresholds["balanced"]["threshold"],
            "high_security": thresholds["high_security"]["threshold"],
            "low_friction": thresholds["low_friction"]["threshold"]
        }
    )


@router.post("/verify", response_model=VerifyResponse)
def verify_session(request: VerifyRequest, db: Session = Depends(get_db)):
    model, user = UserRepository.load_model(db, request.username)
    if not model or not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trained authentication model not found. Please enroll and train first."
        )
        
    # Extract features from current typing session
    extractor = FeatureExtractor()
    features = extractor.extract_features(request.events)
    
    if features["mean_dwell_time"] == 0.0 and features["typing_speed"] == 0.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Keystroke events could not be parsed."
        )
        
    # Convert features to 2D numpy array
    X_test = np.array([[
        features["mean_dwell_time"],
        features["std_dwell_time"],
        features["mean_flight_time"],
        features["typing_speed"],
        features["backspace_rate"],
        features["pause_frequency"]
    ]])
    
    # Predict probability of being the genuine user
    prob = float(model.predict_proba(X_test)[0])
    
    # Determine the threshold to apply based on user active profile
    profile = user.active_profile
    if profile == "high_security":
        threshold = user.threshold_high_security
    elif profile == "low_friction":
        threshold = user.threshold_low_friction
    else:
        threshold = user.threshold_balanced
        
    is_genuine = (prob >= threshold)
    
    # Log attempt
    SessionLogRepository.log_verification(
        db=db,
        user_id=user.id,
        score=prob,
        threshold=threshold,
        profile=profile,
        is_anomalous=not is_genuine,
        keystroke_count=len(request.events)
    )
    
    return VerifyResponse(
        username=user.username,
        score=prob,
        is_genuine=is_genuine,
        active_profile=profile,
        applied_threshold=threshold
    )


@router.post("/session/score", response_model=ScoreResponse)
def continuous_score(request: ScoreRequest, db: Session = Depends(get_db)):
    """
    Score a sliding window of keystrokes. Identical core logic to verify,
    but separatescontinuous session logs from manual single-shot verifications.
    """
    model, user = UserRepository.load_model(db, request.username)
    if not model or not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trained authentication model not found."
        )
        
    extractor = FeatureExtractor()
    features = extractor.extract_features(request.events)
    
    if features["mean_dwell_time"] == 0.0 and features["typing_speed"] == 0.0:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid typing features found.")
         
    X_test = np.array([[
        features["mean_dwell_time"],
        features["std_dwell_time"],
        features["mean_flight_time"],
        features["typing_speed"],
        features["backspace_rate"],
        features["pause_frequency"]
    ]])
    
    prob = float(model.predict_proba(X_test)[0])
    profile = user.active_profile
    
    if profile == "high_security":
        threshold = user.threshold_high_security
    elif profile == "low_friction":
        threshold = user.threshold_low_friction
    else:
        threshold = user.threshold_balanced
        
    is_genuine = (prob >= threshold)
    
    # Log sliding window telemetry
    SessionLogRepository.log_verification(
        db=db,
        user_id=user.id,
        score=prob,
        threshold=threshold,
        profile=profile,
        is_anomalous=not is_genuine,
        keystroke_count=len(request.events)
    )
    
    return ScoreResponse(
        username=user.username,
        score=prob,
        is_genuine=is_genuine,
        active_profile=profile,
        applied_threshold=threshold
    )


@router.post("/user/profile", response_model=UserInfoResponse)
def update_profile(request: UpdateProfileRequest, db: Session = Depends(get_db)):
    user = UserRepository.get_by_username(db, request.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        
    if request.profile not in ["balanced", "high_security", "low_friction"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid security profile.")
        
    UserRepository.update_active_profile(db, user, request.profile)
    
    return UserInfoResponse(
        username=user.username,
        is_enrolled=user.is_enrolled,
        model_type=user.model_type,
        active_profile=user.active_profile,
        thresholds={
            "balanced": user.threshold_balanced,
            "high_security": user.threshold_high_security,
            "low_friction": user.threshold_low_friction
        }
    )


@router.get("/user/{username}", response_model=UserInfoResponse)
def get_user_info(username: str, db: Session = Depends(get_db)):
    user = UserRepository.get_by_username(db, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        
    return UserInfoResponse(
        username=user.username,
        is_enrolled=user.is_enrolled,
        model_type=user.model_type,
        active_profile=user.active_profile,
        thresholds={
            "balanced": user.threshold_balanced,
            "high_security": user.threshold_high_security,
            "low_friction": user.threshold_low_friction
        }
    )


@router.get("/user/{username}/logs")
def get_user_logs(username: str, limit: int = 15, db: Session = Depends(get_db)):
    user = UserRepository.get_by_username(db, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        
    logs = SessionLogRepository.get_recent_logs(db, user.id, limit=limit)
    return [
        {
            "id": log.id,
            "score": log.score,
            "applied_threshold": log.applied_threshold,
            "applied_profile": log.applied_profile,
            "is_anomalous": log.is_anomalous,
            "keystroke_count": log.keystroke_count,
            "timestamp": log.created_at.isoformat()
        } for log in logs
    ]
