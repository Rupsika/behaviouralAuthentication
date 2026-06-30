import pickle
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.storage.models import User, EnrollmentSample, SessionLog
from app.models.classifiers import BaseAuthModel

class UserRepository:
    """Manages User operations and model binary serialization."""

    @staticmethod
    def get_by_username(db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()

    @staticmethod
    def get_by_id(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def create(db: Session, username: str, model_type: str = "LogisticRegression") -> User:
        db_user = User(username=username, model_type=model_type)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def save_model(
        db: Session, 
        user: User, 
        model: BaseAuthModel, 
        thresholds: Dict[str, Dict[str, float]]
    ) -> User:
        """Serializes and saves the trained ML model strategy and its tuned thresholds."""
        # Serialize the model object using pickle
        model_binary = pickle.dumps(model)
        
        user.model_binary = model_binary
        user.is_enrolled = True
        user.model_type = model.get_model_name()
        
        # Save tuned thresholds
        user.threshold_balanced = thresholds["balanced"]["threshold"]
        user.threshold_high_security = thresholds["high_security"]["threshold"]
        user.threshold_low_friction = thresholds["low_friction"]["threshold"]
        
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def load_model(db: Session, username: str) -> Tuple[Optional[BaseAuthModel], Optional[User]]:
        """Loads and deserializes the trained model for a user."""
        user = UserRepository.get_by_username(db, username)
        if not user or not user.model_binary:
            return None, user
        
        # Deserialize model strategy object
        model = pickle.loads(user.model_binary)
        return model, user

    @staticmethod
    def update_active_profile(db: Session, user: User, profile: str) -> User:
        if profile in ["balanced", "high_security", "low_friction"]:
            user.active_profile = profile
            db.commit()
            db.refresh(user)
        return user


class EnrollmentRepository:
    """Manages user enrollment typing samples."""

    @staticmethod
    def add_sample(
        db: Session, 
        user_id: int, 
        features: Dict[str, float]
    ) -> EnrollmentSample:
        sample = EnrollmentSample(
            user_id=user_id,
            mean_dwell_time=features["mean_dwell_time"],
            std_dwell_time=features["std_dwell_time"],
            mean_flight_time=features["mean_flight_time"],
            typing_speed=features["typing_speed"],
            backspace_rate=features["backspace_rate"],
            pause_frequency=features["pause_frequency"]
        )
        db.add(sample)
        db.commit()
        db.refresh(sample)
        return sample

    @staticmethod
    def get_samples_by_user(db: Session, user_id: int) -> List[EnrollmentSample]:
        return db.query(EnrollmentSample).filter(EnrollmentSample.user_id == user_id).all()

    @staticmethod
    def clear_samples(db: Session, user_id: int) -> None:
        db.query(EnrollmentSample).filter(EnrollmentSample.user_id == user_id).delete()
        db.commit()


class SessionLogRepository:
    """Manages logging of authentication attempts and scores."""

    @staticmethod
    def log_verification(
        db: Session,
        user_id: int,
        score: float,
        threshold: float,
        profile: str,
        is_anomalous: bool,
        keystroke_count: int = 0
    ) -> SessionLog:
        log = SessionLog(
            user_id=user_id,
            score=score,
            applied_threshold=threshold,
            applied_profile=profile,
            is_anomalous=is_anomalous,
            keystroke_count=keystroke_count
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def get_recent_logs(db: Session, user_id: int, limit: int = 50) -> List[SessionLog]:
        return (
            db.query(SessionLog)
            .filter(SessionLog.user_id == user_id)
            .order_by(SessionLog.created_at.desc())
            .limit(limit)
            .all()
        )
