"""Centralised company / contact info used by every node.

Edit the constants below to update branding everywhere — node tooltips,
right-click menus, and any future about screens all read from here.
"""

COMPANY = "Deepsoch AI Private Limited"
EMAIL = "deepsoch.ai@gmail.com"
WEBSITE = "https://deepsoch.com"
DEVELOPER = "Karim Khan"


def describe(summary: str) -> str:
    """Append the standard developer signature to a node's description.

    The result becomes the node's `DESCRIPTION` field, which ComfyUI
    surfaces as a tooltip in the node search menu and on hover.
    """
    return (
        f"{summary}\n\n"
        f"Developed by {COMPANY}\n"
        f"Contact: {EMAIL}\n"
        f"Website: {WEBSITE}"
    )
