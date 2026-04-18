# G:\O meu disco\python\Trader-bot\scripts\inspect_btc_binance_5m.py

import sqlite3
from datetime import UTC, datetime

DB_PATH = r"G:\O meu disco\python\Trader-bot\market_research_lab.db"

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

print("################################################################################")
print("ÚLTIMOS 30 CANDLES | BTC/USDT | 5m | binance")
print("################################################################################")
rows = cur.execute("""
    SELECT
        open_time,
        close_time,
        open,
        high,
        low,
        close,
        volume,
        source
    FROM candles
    WHERE symbol = 'BTC/USDT'
      AND timeframe = '5m'
      AND source = 'binance'
    ORDER BY open_time DESC
    LIMIT 30
""").fetchall()

for row in rows:
    print(row)

print()
print("################################################################################")
print("ÚLTIMO OPEN_TIME E DIFERENÇA PARA AGORA UTC")
print("################################################################################")
last_row = cur.execute("""
    SELECT open_time
    FROM candles
    WHERE symbol = 'BTC/USDT'
      AND timeframe = '5m'
      AND source = 'binance'
    ORDER BY open_time DESC
    LIMIT 1
""").fetchone()

if last_row:
    last_open_raw = str(last_row[0]).replace(" ", "T")
    if "." not in last_open_raw:
        last_open_raw = f"{last_open_raw}.000000"
    last_open = datetime.fromisoformat(last_open_raw).replace(tzinfo=UTC)
    now_utc = datetime.now(UTC)
    diff_minutes = (now_utc - last_open).total_seconds() / 60
    print("LAST_OPEN_UTC:", last_open.isoformat())
    print("NOW_UTC     :", now_utc.isoformat())
    print("DIFF_MIN    :", round(diff_minutes, 2))
else:
    print("SEM CANDLES")

print()
print("################################################################################")
print("VERIFICAR LACUNAS ENTRE OS ÚLTIMOS 60 CANDLES")
print("################################################################################")
gap_rows = cur.execute("""
    SELECT open_time
    FROM candles
    WHERE symbol = 'BTC/USDT'
      AND timeframe = '5m'
      AND source = 'binance'
    ORDER BY open_time DESC
    LIMIT 60
""").fetchall()

times = [datetime.fromisoformat(str(row[0]).replace(" ", "T")) for row in reversed(gap_rows)]

for index in range(1, len(times)):
    diff = (times[index] - times[index - 1]).total_seconds() / 60
    if diff != 5:
        print(
            "GAP:",
            times[index - 1].isoformat(),
            "->",
            times[index].isoformat(),
            "| minutos =",
            diff,
        )

con.close()