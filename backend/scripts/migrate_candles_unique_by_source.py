# G:\O meu disco\python\Trader-bot\scripts\migrate_candles_unique_by_source.py

from __future__ import annotations

import argparse
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


def normalize_source(value: str | None) -> str:
    normalized = (value or "unknown").strip().lower()
    return normalized or "unknown"


def backup_database_file(db_path: Path) -> Path:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_path = db_path.with_name(f"{db_path.stem}_backup_{timestamp}{db_path.suffix}")
    shutil.copy2(db_path, backup_path)
    return backup_path


def table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def recreate_candles_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE candles_new (
            id TEXT PRIMARY KEY NOT NULL,
            asset_id TEXT NULL,
            symbol TEXT NOT NULL,
            timeframe TEXT NOT NULL,
            open_time TEXT NOT NULL,
            close_time TEXT NOT NULL,
            open NUMERIC NOT NULL,
            high NUMERIC NOT NULL,
            low NUMERIC NOT NULL,
            close NUMERIC NOT NULL,
            volume NUMERIC NOT NULL DEFAULT 0,
            source TEXT NOT NULL DEFAULT 'unknown',
            CONSTRAINT uq_candles_symbol_timeframe_open_time_source
                UNIQUE (symbol, timeframe, open_time, source)
        )
        """
    )


def migrate_rows(connection: sqlite3.Connection) -> tuple[int, int]:
    rows = connection.execute(
        """
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
        ORDER BY rowid ASC
        """
    ).fetchall()

    inserted = 0
    replaced = 0
    seen_keys: set[tuple[str, str, str, str]] = set()

    for row in rows:
        (
            row_id,
            asset_id,
            symbol,
            timeframe,
            open_time,
            close_time,
            open_value,
            high_value,
            low_value,
            close_value,
            volume_value,
            source_value,
        ) = row

        normalized_symbol = str(symbol).strip().upper()
        normalized_timeframe = str(timeframe).strip().lower()
        normalized_source = normalize_source(source_value)

        dedupe_key = (
            normalized_symbol,
            normalized_timeframe,
            str(open_time),
            normalized_source,
        )

        if dedupe_key in seen_keys:
            replaced += 1

        seen_keys.add(dedupe_key)

        connection.execute(
            """
            INSERT OR REPLACE INTO candles_new (
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row_id,
                asset_id,
                normalized_symbol,
                normalized_timeframe,
                open_time,
                close_time,
                open_value,
                high_value,
                low_value,
                close_value,
                volume_value,
                normalized_source,
            ),
        )
        inserted += 1

    return inserted, replaced


def replace_old_table(connection: sqlite3.Connection) -> None:
    connection.execute("DROP TABLE candles")
    connection.execute("ALTER TABLE candles_new RENAME TO candles")
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_candles_symbol_timeframe_open_time
        ON candles(symbol, timeframe, open_time)
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_candles_symbol_timeframe_source_open_time
        ON candles(symbol, timeframe, source, open_time)
        """
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migra a tabela candles para unicidade por symbol+timeframe+open_time+source."
    )
    parser.add_argument(
        "--db",
        required=True,
        help="Caminho do ficheiro SQLite.",
    )
    args = parser.parse_args()

    db_path = Path(args.db).expanduser().resolve()

    if not db_path.exists():
        raise FileNotFoundError(f"Base de dados não encontrada: {db_path}")

    backup_path = backup_database_file(db_path)
    print(f"[MIGRATE] Backup criado em: {backup_path}")

    connection = sqlite3.connect(str(db_path))
    try:
        connection.execute("PRAGMA foreign_keys = OFF")
        connection.execute("BEGIN")

        if not table_exists(connection, "candles"):
            raise RuntimeError("Tabela 'candles' não encontrada.")

        recreate_candles_table(connection)
        inserted, replaced = migrate_rows(connection)
        replace_old_table(connection)

        connection.commit()

        print("[MIGRATE] Migração concluída com sucesso.")
        print(f"[MIGRATE] Registos processados: {inserted}")
        print(f"[MIGRATE] Duplicados substituídos por chave nova: {replaced}")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()