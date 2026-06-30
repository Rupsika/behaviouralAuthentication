import pytest
import numpy as np
from app.models.classifiers import get_model_by_name, LogisticRegressionModel, SVMModel, RandomForestModel
from app.models.pipeline import calculate_far_frr, evaluate_threshold_curves, find_eer

def test_get_model_by_name():
    assert isinstance(get_model_by_name("LogisticRegression"), LogisticRegressionModel)
    assert isinstance(get_model_by_name("SVM"), SVMModel)
    assert isinstance(get_model_by_name("RandomForest"), RandomForestModel)
    
    with pytest.raises(ValueError):
        get_model_by_name("UnsupportedModel")

def test_calculate_far_frr():
    # Setup test labels and probabilities
    # 5 genuine samples, 5 impostor samples
    y_true = np.array([1, 1, 1, 1, 1, 0, 0, 0, 0, 0])
    
    # Probabilities of being genuine:
    # Genuines: 3 are >= 0.5 (TP=3), 2 are < 0.5 (FN=2) -> FRR = 2/5 = 0.4
    # Impostors: 1 is >= 0.5 (FP=1), 4 are < 0.5 (TN=4) -> FAR = 1/5 = 0.2
    y_prob = np.array([0.9, 0.8, 0.7, 0.4, 0.2, 0.1, 0.2, 0.1, 0.6, 0.3])
    
    far, frr = calculate_far_frr(y_true, y_prob, threshold=0.5)
    
    assert far == 0.2
    assert frr == 0.4

def test_find_eer():
    # Setup curves where FAR and FRR intersect
    curve = [
        {"threshold": 0.1, "far": 0.9, "frr": 0.0},
        {"threshold": 0.3, "far": 0.6, "frr": 0.2},
        {"threshold": 0.5, "far": 0.3, "frr": 0.3},  # EER point (0.3)
        {"threshold": 0.7, "far": 0.1, "frr": 0.7},
        {"threshold": 0.9, "far": 0.0, "frr": 0.9}
    ]
    
    eer_thresh, eer_val = find_eer(curve)
    
    assert eer_thresh == 0.5
    assert eer_val == 0.3
