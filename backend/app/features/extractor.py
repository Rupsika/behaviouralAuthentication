import numpy as np
from typing import List, Dict, Any
from pydantic import BaseModel, Field

class KeystrokeEvent(BaseModel):
    key: str = Field(..., description="The key character or code pressed, e.g., 'a', 'Backspace', 'Shift'")
    event_type: str = Field(..., description="Type of event: 'keydown' or 'keyup'")
    timestamp: float = Field(..., description="Epoch timestamp in milliseconds, e.g., using performance.now() or time.time() * 1000")

class FeatureExtractor:
    """
    Extracts behavioral keystroke features from a sequence of raw KeystrokeEvents.
    Features extracted:
    - mean_dwell_time: average time a key is held down (KeyUp - KeyDown) in ms.
    - std_dwell_time: standard deviation of dwell times in ms.
    - mean_flight_time: average time between key releases and subsequent presses in ms.
    - typing_speed: typing speed in keys per second.
    - backspace_rate: ratio of Backspace presses to total keys.
    - pause_frequency: count of pauses longer than a threshold (e.g. 1000ms).
    """

    def __init__(self, pause_threshold_ms: float = 1000.0):
        self.pause_threshold_ms = pause_threshold_ms

    def extract_features(self, events: List[KeystrokeEvent]) -> Dict[str, Any]:
        """
        Processes a sequence of keystroke events and extracts typing profile features.
        Returns a dictionary of features.
        """
        if not events:
            return self._default_features()

        dwell_times = []
        flight_times = []
        backspace_count = 0
        total_keys_pressed = 0

        # Track currently pressed keys to handle overlaps (key -> keydown_timestamp)
        active_presses: Dict[str, float] = {}
        last_keyup_time = None

        # Sort events by timestamp to ensure chronological processing
        sorted_events = sorted(events, key=lambda e: e.timestamp)

        for event in sorted_events:
            key = event.key
            # Normalise key representations (e.g. Case-insensitive comparison for Backspace)
            is_backspace = key.lower() == "backspace" or key == "\x08"

            if event.event_type == "keydown":
                # If key is already down (e.g., repeating keys), don't overwrite the initial down time
                if key not in active_presses:
                    active_presses[key] = event.timestamp

                if is_backspace:
                    backspace_count += 1
                total_keys_pressed += 1

                # Calculate Flight Time: KeyDown(current) - KeyUp(previous)
                if last_keyup_time is not None:
                    flight_time = event.timestamp - last_keyup_time
                    flight_times.append(flight_time)

            elif event.event_type == "keyup":
                if key in active_presses:
                    keydown_time = active_presses.pop(key)
                    dwell_time = event.timestamp - keydown_time
                    # Only record positive dwell times (handles minor timestamp anomalies)
                    if dwell_time >= 0:
                        dwell_times.append(dwell_time)
                    last_keyup_time = event.timestamp

        # Calculate durations and rates
        total_duration_ms = 0.0
        if len(sorted_events) > 1:
            total_duration_ms = sorted_events[-1].timestamp - sorted_events[0].timestamp

        total_duration_sec = total_duration_ms / 1000.0

        # Calculate average/std of dwell times
        if dwell_times:
            mean_dwell = float(np.mean(dwell_times))
            std_dwell = float(np.std(dwell_times)) if len(dwell_times) > 1 else 0.0
        else:
            mean_dwell = 0.0
            std_dwell = 0.0

        # Calculate average flight time
        if flight_times:
            mean_flight = float(np.mean(flight_times))
            # Pauses: flight time exceeding threshold
            pause_frequency = int(sum(1 for ft in flight_times if ft > self.pause_threshold_ms))
        else:
            mean_flight = 0.0
            pause_frequency = 0

        # Calculate typing speed (keys per second)
        # Prevent division by zero or unreasonably high speed in tiny windows
        if total_duration_sec > 0.1 and total_keys_pressed > 0:
            typing_speed = float(total_keys_pressed / total_duration_sec)
        else:
            typing_speed = 0.0

        # Calculate backspace rate
        if total_keys_pressed > 0:
            backspace_rate = float(backspace_count / total_keys_pressed)
        else:
            backspace_rate = 0.0

        return {
            "mean_dwell_time": mean_dwell,
            "std_dwell_time": std_dwell,
            "mean_flight_time": mean_flight,
            "typing_speed": typing_speed,
            "backspace_rate": backspace_rate,
            "pause_frequency": pause_frequency
        }

    def _default_features(self) -> Dict[str, Any]:
        """Returns standard baseline values when no events are provided."""
        return {
            "mean_dwell_time": 0.0,
            "std_dwell_time": 0.0,
            "mean_flight_time": 0.0,
            "typing_speed": 0.0,
            "backspace_rate": 0.0,
            "pause_frequency": 0
        }
