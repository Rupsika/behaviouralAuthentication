from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from app.features.extractor import KeystrokeEvent

class EnrollRequest(BaseModel):
    username: str = Field(..., example="alice")
    events: List[KeystrokeEvent] = Field(..., description="Keystroke events captured during typing sample")

class EnrollResponse(BaseModel):
    username: str
    sample_index: int
    total_samples: int
    message: str

class TrainRequest(BaseModel):
    username: str = Field(..., example="alice")
    model_type: Optional[str] = Field("LogisticRegression", description="LogisticRegression, SVM, or RandomForest")

class TrainResponse(BaseModel):
    username: str
    success: bool
    model_name: str
    accuracy: float
    f1_score: float
    eer: float
    thresholds: Dict[str, float] = Field(..., description="Balanced, high_security, and low_friction thresholds")

class VerifyRequest(BaseModel):
    username: str = Field(..., example="alice")
    events: List[KeystrokeEvent] = Field(..., description="Keystroke events for single-shot verification")

class VerifyResponse(BaseModel):
    username: str
    score: float = Field(..., description="Probability of being genuine (0.0 to 1.0)")
    is_genuine: bool = Field(..., description="True if score >= active threshold")
    active_profile: str = Field(..., description="Current profile: balanced, high_security, or low_friction")
    applied_threshold: float = Field(..., description="Threshold value applied for classification")

class ScoreRequest(BaseModel):
    username: str = Field(..., example="alice")
    events: List[KeystrokeEvent] = Field(..., description="Sliding window of raw keystroke events for continuous scoring")

class ScoreResponse(BaseModel):
    username: str
    score: float
    is_genuine: bool
    active_profile: str
    applied_threshold: float

class UpdateProfileRequest(BaseModel):
    username: str = Field(..., example="alice")
    profile: str = Field(..., description="Must be 'balanced', 'high_security', or 'low_friction'")

class UserInfoResponse(BaseModel):
    username: str
    is_enrolled: bool
    model_type: str
    active_profile: str
    thresholds: Dict[str, float]
