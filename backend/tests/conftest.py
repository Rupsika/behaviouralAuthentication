import os
import sys

# Add the 'backend' folder to the system path so pytest can resolve 'app.*' imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
