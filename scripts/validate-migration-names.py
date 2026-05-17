#!/usr/bin/env python3
"""
Script para validar nomes de arquivos de migration SQL.
Garante que as migrations seguem o padrão de nomenclatura correto.
"""

import re
import sys
from pathlib import Path
from datetime import datetime

# Padrão esperado: YYYYMMDDHHMMSS_description.sql
MIGRATION_PATTERN = r'^\d{14}_[\w\-]+\.sql$'

# Padrão de data válida
DATE_PATTERN = r'^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_'


def is_valid_migration_name(filename):
    """Verifica se o nome da migration é válido."""
    if not re.match(MIGRATION_PATTERN, filename):
        return False, f"Invalid format. Expected: YYYYMMDDHHMMSS_description.sql"

    # Extrai timestamp
    match = re.match(DATE_PATTERN, filename)
    if not match:
        return False, "Could not parse timestamp"

    year, month, day, hour, minute, second = map(int, match.groups())

    # Valida data
    try:
        datetime(year, month, day, hour, minute, second)
    except ValueError:
        return False, f"Invalid timestamp: {year}{month}{day} {hour}:{minute}:{second}"

    # Valida descrição
    description = filename.split('_', 1)[1].replace('.sql', '')
    if not re.match(r'^[\w\-]+$', description):
        return False, "Description contains invalid characters (only alphanumeric, underscore, hyphen)"

    if len(description) < 3:
        return False, "Description is too short (minimum 3 characters)"

    if len(description) > 50:
        return False, "Description is too long (maximum 50 characters)"

    return True, "Valid"


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: validate-migration-names.py <directory>")
        sys.exit(1)

    directory = Path(sys.argv[1])
    if not directory.exists():
        print(f"Error: Directory {directory} does not exist")
        sys.exit(1)

    errors = []
    warnings = []
    valid_migrations = []

    # Processa todos os arquivos .sql
    for sql_file in sorted(directory.glob('*.sql')):
        filename = sql_file.name
        is_valid, message = is_valid_migration_name(filename)

        if is_valid:
            valid_migrations.append(filename)
        else:
            errors.append({
                'file': filename,
                'message': message
            })

    # Verifica se há duplicatas ou conflitos de timestamp
    timestamps = {}
    for migration in valid_migrations:
        timestamp = migration[:14]
        if timestamp in timestamps:
            errors.append({
                'file': migration,
                'message': f"Duplicate timestamp with {timestamps[timestamp]}"
            })
        else:
            timestamps[timestamp] = migration

    # Output
    print("📋 Migration Files Validation\n")

    if valid_migrations:
        print(f"✅ Valid migrations: {len(valid_migrations)}\n")
        # for migration in valid_migrations[:5]:  # Show first 5
        #     print(f"   {migration}")
        # if len(valid_migrations) > 5:
        #     print(f"   ... and {len(valid_migrations) - 5} more")

    if errors:
        print("❌ Invalid migrations:\n")
        for error in errors:
            print(f"  {error['file']}")
            print(f"    {error['message']}\n")
        sys.exit(1)

    print("✅ All migrations have valid names!")
    sys.exit(0)


if __name__ == '__main__':
    main()
