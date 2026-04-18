# G:\O meu disco\python\Trader-bot\scripts\check_candles_by_source.py

import sqlite3

DB_PATH = r"G:\O meu disco\python\Trader-bot\market_research_lab.db"

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

print("################################################################################")
print("TOTAL POR SOURCE")
print("################################################################################")
for row in cur.execute("""
    SELECT source, COUNT(*) AS total
    FROM candles
    GROUP BY source
    ORDER BY total DESC, source ASC
"""):
    print(row)

print()
print("################################################################################")
print("DUPLICADOS NA CHAVE NOVA")
print("################################################################################")
for row in cur.execute("""
    SELECT
        symbol,
        timeframe,
        open_time,
        source,
        COUNT(*) AS total
    FROM candles
    GROUP BY symbol, timeframe, open_time, source
    HAVING COUNT(*) > 1
    ORDER BY total DESC, symbol ASC, timeframe ASC, open_time ASC
    LIMIT 50
"""):
    print(row)

print()
print("################################################################################")
print("ÚLTIMO CANDLE POR SOURCE / SYMBOL / TIMEFRAME")
print("################################################################################")
for row in cur.execute("""
    SELECT c.source, c.symbol, c.timeframe, MAX(c.open_time) AS last_open_time
    FROM candles c
    GROUP BY c.source, c.symbol, c.timeframe
    ORDER BY c.symbol ASC, c.timeframe ASC, c.source ASC
    LIMIT 100
"""):
    print(row)

con.close()