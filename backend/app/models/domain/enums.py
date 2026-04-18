from enum import Enum


class MarketType(str, Enum):
    STOCK = "stock"
    FOREX = "forex"
    CRYPTO = "crypto"


class RunMode(str, Enum):
    HISTORICAL = "historical"
    REPLAY = "replay"
    LIVE = "live"


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CaseStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class CaseOutcome(str, Enum):
    HIT = "hit"
    FAIL = "fail"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class StrategyCategory(str, Enum):
    MEAN_REVERSION = "mean_reversion"
    TREND_FOLLOWING = "trend_following"
    BREAKOUT = "breakout"
    MOMENTUM = "momentum"
    CUSTOM = "custom"