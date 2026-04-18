from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = r"G:\O meu disco\python\Trader-bot\market_research_lab.db"


def normalize_symbol_for_matching(symbol: str) -> str:
    value = (symbol or "").upper().strip()
    for ch in ["/", "-", "_", " "]:
        value = value.replace(ch, "")
    return value


def normalize_symbol_for_storage(symbol: str) -> str:
    compact = normalize_symbol_for_matching(symbol)

    if len(compact) == 6 and compact.isalpha():
        return f"{compact[:3]}/{compact[3:]}"
    return compact


def table_exists(cur: sqlite3.Cursor, table_name: str) -> bool:
    row = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return row is not None


def fetch_all_candles(cur: sqlite3.Cursor) -> list[sqlite3.Row]:
    cur.execute("""
        SELECT
            id,
            asset_id,
            symbol,
            timeframe,
            open_time,
            close_time,
            open,
            high,
            low,
            close,
            volume,
            source
        FROM candles
        ORDER BY timeframe, open_time, id
    """)
    return cur.fetchall()


def build_dedup_key(row: sqlite3.Row) -> tuple[str, str, str]:
    normalized_symbol = normalize_symbol_for_storage(str(row["symbol"]))
    timeframe = str(row["timeframe"])
    open_time = str(row["open_time"])
    return normalized_symbol, timeframe, open_time


def choose_best_row(current: sqlite3.Row, candidate: sqlite3.Row) -> sqlite3.Row:
    """
    Regra simples:
    - preferir linha com source preenchido
    - se ambas equivalentes, manter a mais recente por id lexical apenas como fallback
    """
    current_source = str(current["source"] or "").strip()
    candidate_source = str(candidate["source"] or "").strip()

    if not current_source and candidate_source:
      return candidate

    if current_source and not candidate_source:
      return current

    return current


def preview_summary(rows: list[sqlite3.Row]) -> None:
    per_symbol: dict[tuple[str, str], int] = {}

    for row in rows:
        key = (str(row["symbol"]), str(row["timeframe"]))
        per_symbol[key] = per_symbol.get(key, 0) + 1

    print("################################################################################")
    print("RESUMO ANTES DA MIGRAÇÃO")
    print("################################################################################")
    for (symbol, timeframe), total in sorted(per_symbol.items()):
        print(f"{symbol} | {timeframe} | {total}")
    print("################################################################################")


def build_migrated_rows(rows: list[sqlite3.Row]) -> tuple[list[dict[str, Any]], int]:
    chosen_by_key: dict[tuple[str, str, str], sqlite3.Row] = {}
    duplicates_removed = 0

    for row in rows:
        key = build_dedup_key(row)

        if key in chosen_by_key:
            duplicates_removed += 1
            chosen_by_key[key] = choose_best_row(chosen_by_key[key], row)
        else:
            chosen_by_key[key] = row

    migrated_rows: list[dict[str, Any]] = []

    for key, row in sorted(chosen_by_key.items(), key=lambda item: (item[0][1], item[0][2], item[0][0])):
        normalized_symbol, timeframe, open_time = key

        migrated_rows.append(
            {
                "id": str(row["id"]),
                "asset_id": row["asset_id"],
                "symbol": normalized_symbol,
                "timeframe": timeframe,
                "open_time": open_time,
                "close_time": str(row["close_time"]),
                "open": row["open"],
                "high": row["high"],
                "low": row["low"],
                "close": row["close"],
                "volume": row["volume"],
                "source": row["source"],
            }
        )

    return migrated_rows, duplicates_removed


def backup_database_file() -> Path:
    src = Path(DB_PATH)
    backup = src.with_name(src.stem + "_backup_before_symbol_normalization" + src.suffix)
    backup.write_bytes(src.read_bytes())
    return backup


def recreate_candles_table(cur: sqlite3.Cursor) -> None:
    cur.execute("""
        CREATE TABLE candles_new (
            id TEXT PRIMARY KEY,
            asset_id TEXT NULL,
            symbol TEXT NOT NULL,
            timeframe TEXT NOT NULL,
            open_time DATETIME NOT NULL,
            close_time DATETIME NOT NULL,
            open NUMERIC(18, 8) NOT NULL,
            high NUMERIC(18, 8) NOT NULL,
            low NUMERIC(18, 8) NOT NULL,
            close NUMERIC(18, 8) NOT NULL,
            volume NUMERIC(18, 8) NOT NULL DEFAULT 0,
            source TEXT NULL,
            CONSTRAINT uq_candles_symbol_timeframe_open_time UNIQUE (symbol, timeframe, open_time)
        )
    """)


def insert_migrated_rows(cur: sqlite3.Cursor, rows: list[dict[str, Any]]) -> None:
    cur.executemany(
        """
        INSERT INTO candles_new (
            id,
            asset_id,
            symbol,
            timeframe,
            open_time,
            close_time,
            open,
            high,
            low,
            close,
            volume,
            source
        )
        VALUES (
            :id,
            :asset_id,
            :symbol,
            :timeframe,
            :open_time,
            :close_time,
            :open,
            :high,
            :low,
            :close,
            :volume,
            :source
        )
        """,
        rows,
    )


def replace_old_table(cur: sqlite3.Cursor) -> None:
    cur.execute("DROP TABLE candles")
    cur.execute("ALTER TABLE candles_new RENAME TO candles")
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_candles_symbol_timeframe_open_time "
        "ON candles(symbol, timeframe, open_time)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS ix_candles_symbol_timeframe_open_time "
        "ON candles(symbol, timeframe, open_time)"
    )


def print_after_summary(cur: sqlite3.Cursor) -> None:
    rows = cur.execute("""
        SELECT
            symbol,
            timeframe,
            COUNT(*) AS total,
            MIN(open_time),
            MAX(open_time)
        FROM candles
        GROUP BY symbol, timeframe
        ORDER BY symbol, timeframe
    """).fetchall()

    print("################################################################################")
    print("RESUMO DEPOIS DA MIGRAÇÃO")
    print("################################################################################")
    for row in rows:
        print(
            f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]}"
        )
    print("################################################################################")


def main() -> None:
    db_file = Path(DB_PATH)
    if not db_file.exists():
        raise FileNotFoundError(f"Base não encontrada: {DB_PATH}")

    backup_path = backup_database_file()
    print(f"BACKUP criado em: {backup_path}")

    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row

    try:
        cur = con.cursor()

        if not table_exists(cur, "candles"):
            raise RuntimeError("Tabela candles não encontrada.")

        rows = fetch_all_candles(cur)
        print(f"TOTAL ORIGINAL DE LINHAS: {len(rows)}")
        preview_summary(rows)

        migrated_rows, duplicates_removed = build_migrated_rows(rows)
        print(f"TOTAL APÓS NORMALIZAÇÃO/DEDUP: {len(migrated_rows)}")
        print(f"DUPLICADOS REMOVIDOS: {duplicates_removed}")

        cur.execute("BEGIN")
        recreate_candles_table(cur)
        insert_migrated_rows(cur, migrated_rows)
        replace_old_table(cur)
        con.commit()

        print_after_summary(cur)
        print("MIGRAÇÃO CONCLUÍDA COM SUCESSO.")
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


if __name__ == "__main__":
    main()