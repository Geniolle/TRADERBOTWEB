# G:\O meu disco\python\Trader-bot\scripts\check_if_lag_or_timezone.py

import sqlite3
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

DB_PATH = r"G:\O meu disco\python\Trader-bot\market_research_lab.db"
LOCAL_TZ = ZoneInfo("Europe/Lisbon")

SYMBOL = "BTC/USDT"
TIMEFRAME = "5m"
SOURCE = "binance"

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

row = cur.execute("""
    SELECT open_time
    FROM candles
    WHERE symbol = ?
      AND timeframe = ?
      AND source = ?
    ORDER BY open_time DESC
    LIMIT 1
""", (SYMBOL, TIMEFRAME, SOURCE)).fetchone()

con.close()

print("################################################################################")
print("CHECK | LAG OU TIMEZONE")
print("################################################################################")

if not row:
    print("Nenhum candle encontrado.")
    raise SystemExit(0)

raw_open = str(row[0]).replace(" ", "T")
last_open_utc = datetime.fromisoformat(raw_open).replace(tzinfo=UTC)

now_utc = datetime.now(UTC)
now_local = now_utc.astimezone(LOCAL_TZ)
last_open_local = last_open_utc.astimezone(LOCAL_TZ)

diff_minutes = (now_utc - last_open_utc).total_seconds() / 60
timezone_offset_minutes = (
    now_local.utcoffset().total_seconds() / 60 if now_local.utcoffset() else 0
)

print(f"SYMBOL                : {SYMBOL}")
print(f"TIMEFRAME             : {TIMEFRAME}")
print(f"SOURCE                : {SOURCE}")
print(f"LAST_OPEN_UTC         : {last_open_utc.isoformat()}")
print(f"LAST_OPEN_LISBON      : {last_open_local.isoformat()}")
print(f"NOW_UTC               : {now_utc.isoformat()}")
print(f"NOW_LISBON            : {now_local.isoformat()}")
print(f"DIFF_MINUTES_REAL     : {diff_minutes:.2f}")
print(f"TIMEZONE_OFFSET_MIN   : {timezone_offset_minutes:.0f}")

print()
print("################################################################################")
print("INTERPRETAÇÃO")
print("################################################################################")

if abs(diff_minutes - timezone_offset_minutes) <= 2:
    print("Parece principalmente diferença de fuso horário.")
elif diff_minutes <= 7:
    print("Sem atraso relevante. Está praticamente em tempo real para 5m.")
else:
    print("Há defasagem real de dados além do fuso horário.")

if diff_minutes > 60:
    print("Conclusão forte: não é só timezone.")