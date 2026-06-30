import numpy as np
from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

class BaseAuthModel(ABC):
    """
    Abstract Base Class defining the strategy interface for behavioral authentication classifiers.
    """
    @abstractmethod
    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        """Train the classifier on feature matrix X and label vector y."""
        pass

    @abstractmethod
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Predict the probability of the sample being the genuine user (class 1).
        Returns a 1D numpy array of probabilities.
        """
        pass

    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """
        Predict class labels (1 for Genuine, 0 for Impostor) based on a probability threshold.
        """
        probabilities = self.predict_proba(X)
        return (probabilities >= threshold).astype(int)

    @abstractmethod
    def get_model_name(self) -> str:
        """Return the name of the model type."""
        pass


class LogisticRegressionModel(BaseAuthModel):
    """
    Logistic Regression baseline with L2 regularization and StandardScaler.
    """
    def __init__(self, C: float = 1.0, max_iter: int = 1000):
        self.C = C
        self.max_iter = max_iter
        # Create pipeline to prevent data leakage during scaling
        self.pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', LogisticRegression(
                C=self.C,
                max_iter=self.max_iter,
                class_weight='balanced',
                random_state=42
            ))
        ])

    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        self.pipeline.fit(X, y)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        # predict_proba returns probability estimates for all classes.
        # Class 1 is genuine, so we return the second column.
        return self.pipeline.predict_proba(X)[:, 1]

    def get_model_name(self) -> str:
        return "LogisticRegression"


class SVMModel(BaseAuthModel):
    """
    Support Vector Machine classifier with RBF kernel and StandardScaler.
    """
    def __init__(self, C: float = 1.0, kernel: str = 'rbf', gamma: str = 'scale'):
        self.C = C
        self.kernel = kernel
        self.gamma = gamma
        self.pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', SVC(
                C=self.C,
                kernel=self.kernel,
                gamma=self.gamma,
                probability=True,  # Crucial for predict_proba
                class_weight='balanced',
                random_state=42
            ))
        ])

    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        self.pipeline.fit(X, y)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.pipeline.predict_proba(X)[:, 1]

    def get_model_name(self) -> str:
        return "SVM"


class RandomForestModel(BaseAuthModel):
    """
    Random Forest ensemble classifier.
    """
    def __init__(self, n_estimators: int = 100, max_depth: int = None):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        # Trees don't strictly require scaling, but standardizing columns 
        # preserves pipeline compatibility.
        self.pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', RandomForestClassifier(
                n_estimators=self.n_estimators,
                max_depth=self.max_depth,
                class_weight='balanced',
                random_state=42
            ))
        ])

    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        self.pipeline.fit(X, y)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.pipeline.predict_proba(X)[:, 1]

    def get_model_name(self) -> str:
        return "RandomForest"


def get_model_by_name(name: str) -> BaseAuthModel:
    """Factory function to retrieve model strategies by name."""
    name_lower = name.lower().replace("_", "").replace("-", "")
    if name_lower == "logisticregression":
        return LogisticRegressionModel()
    elif name_lower == "svm":
        return SVMModel()
    elif name_lower == "randomforest":
        return RandomForestModel()
    else:
        raise ValueError(f"Unknown model strategy type: {name}. Supported: 'LogisticRegression', 'SVM', 'RandomForest'")
