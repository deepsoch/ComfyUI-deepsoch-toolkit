"""Filesystem paths used across the toolkit.

Layout:

    ComfyUI-deepsoch-toolkit/                 <- TOOLKIT_ROOT
    ├── src/deepsoch_toolkit/                 <- PACKAGE_ROOT
    │   ├── core/paths.py  (this file)
    │   └── data/presets/  (shipped, read-only at runtime)
    └── user/presets/                         <- USER_PRESETS_DIR (writable, never overwritten on update)
"""

from pathlib import Path

# src/deepsoch_toolkit/core/paths.py -> parents: [core, deepsoch_toolkit, src, root]
PACKAGE_ROOT: Path = Path(__file__).resolve().parents[1]
TOOLKIT_ROOT: Path = Path(__file__).resolve().parents[3]

DATA_DIR: Path = PACKAGE_ROOT / "data"
PRESETS_DIR: Path = DATA_DIR / "presets"

USER_DIR: Path = TOOLKIT_ROOT / "user"
USER_PRESETS_DIR: Path = USER_DIR / "presets"


def ensure_user_dirs() -> None:
    """Create user-writable directories on first use."""
    USER_PRESETS_DIR.mkdir(parents=True, exist_ok=True)
