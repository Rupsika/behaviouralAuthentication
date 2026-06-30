import pytest
from app.features.extractor import KeystrokeEvent, FeatureExtractor

def test_feature_extractor_empty_events():
    extractor = FeatureExtractor()
    features = extractor.extract_features([])
    assert features["mean_dwell_time"] == 0.0
    assert features["std_dwell_time"] == 0.0
    assert features["mean_flight_time"] == 0.0
    assert features["typing_speed"] == 0.0
    assert features["backspace_rate"] == 0.0
    assert features["pause_frequency"] == 0

def test_feature_extractor_simple_press():
    # A single key press: KeyDown at 100ms, KeyUp at 250ms
    events = [
        KeystrokeEvent(key="a", event_type="keydown", timestamp=100.0),
        KeystrokeEvent(key="a", event_type="keyup", timestamp=250.0)
    ]
    extractor = FeatureExtractor()
    features = extractor.extract_features(events)
    
    # Dwell time should be 150ms
    assert features["mean_dwell_time"] == 150.0
    assert features["std_dwell_time"] == 0.0
    # No second key, so flight time is 0.0
    assert features["mean_flight_time"] == 0.0
    # 1 key in 150ms (0.15 seconds) -> speed = 1 / 0.15 = 6.666... keys/sec
    assert abs(features["typing_speed"] - 6.67) < 0.1
    assert features["backspace_rate"] == 0.0

def test_feature_extractor_sequential_presses():
    # Press 'a' (100 -> 200), release, then press 'b' (250 -> 320)
    events = [
        KeystrokeEvent(key="a", event_type="keydown", timestamp=100.0),
        KeystrokeEvent(key="a", event_type="keyup", timestamp=200.0),
        KeystrokeEvent(key="b", event_type="keydown", timestamp=250.0),
        KeystrokeEvent(key="b", event_type="keyup", timestamp=320.0)
    ]
    extractor = FeatureExtractor()
    features = extractor.extract_features(events)
    
    # Dwell times: 'a' is 100ms, 'b' is 70ms. Mean = (100+70)/2 = 85.0ms
    assert features["mean_dwell_time"] == 85.0
    # Flight time: KeyDown('b') at 250 - KeyUp('a') at 200 = 50.0ms
    assert features["mean_flight_time"] == 50.0
    # Total duration = 320 - 100 = 220ms (0.22 seconds)
    # Total keys pressed = 2 -> speed = 2 / 0.22 = 9.09 keys/sec
    assert abs(features["typing_speed"] - 9.09) < 0.1
    assert features["backspace_rate"] == 0.0

def test_feature_extractor_backspaces_and_pauses():
    # Type 'a' (100->200), then 'Backspace' (1300->1400)
    # The pause here is 1300 - 200 = 1100ms, which exceeds the default 1000ms threshold.
    events = [
        KeystrokeEvent(key="a", event_type="keydown", timestamp=100.0),
        KeystrokeEvent(key="a", event_type="keyup", timestamp=200.0),
        KeystrokeEvent(key="Backspace", event_type="keydown", timestamp=1300.0),
        KeystrokeEvent(key="Backspace", event_type="keyup", timestamp=1400.0)
    ]
    extractor = FeatureExtractor(pause_threshold_ms=1000.0)
    features = extractor.extract_features(events)
    
    # Backspace rate = 1 backspace / 2 total keys = 0.5
    assert features["backspace_rate"] == 0.5
    # One pause exceeding 1000ms
    assert features["pause_frequency"] == 1
    # Flight time should be 1100ms
    assert features["mean_flight_time"] == 1100.0
