from dataclasses import dataclass

TRIM_SIZES = {
    "6x9": (6.0, 9.0),
    "8.5x11": (8.5, 11.0),
    "8.5x8.5": (8.5, 8.5),
}
PAPER_SPINE_IN = {
    "white": 0.002252,
    "cream": 0.0025,
    "color": 0.002347,
}

@dataclass(frozen=True)
class BookSpec:
    kind: str = "illustrated"
    trim: str = "6x9"
    pages: int = 24
    bleed: bool = True
    paper: str = "white"
    title: str = "KindleForge Sample"
    author: str = "KindleForge"

    @property
    def trim_size(self):
        if self.trim not in TRIM_SIZES:
            raise ValueError(f"Unsupported trim {self.trim}; choose {', '.join(TRIM_SIZES)}")
        return TRIM_SIZES[self.trim]

    @property
    def spine_width(self):
        if self.pages < 24:
            raise ValueError("KDP paperback books require at least 24 pages")
        if self.paper not in PAPER_SPINE_IN:
            raise ValueError(f"Unsupported paper {self.paper}")
        return self.pages * PAPER_SPINE_IN[self.paper]

    @property
    def interior_size(self):
        w, h = self.trim_size
        return (w + (0.25 if self.bleed else 0), h + (0.25 if self.bleed else 0))

    @property
    def cover_size(self):
        w, h = self.trim_size
        return (2 * w + self.spine_width + 0.25, h + 0.25)
