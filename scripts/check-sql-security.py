#!/usr/bin/env python3
"""
Script para validar segurança em arquivos SQL.
Procura por padrões perigosos como SQL injection risks.
"""

import re
import sys
from pathlib import Path

# Padrões perigosos a detectar
DANGEROUS_PATTERNS = {
    'concatenation': r"'.*'\s*\+\+|CONCAT\(",
    'string_concat_unsafe': r"query\s*=\s*['\"].*['\"].*\+.*var",
    'drop_table': r"(?i)DROP\s+TABLE\s+(?!IF\s+EXISTS)",
    'truncate_table': r"(?i)TRUNCATE\s+TABLE(?!\s+)",
    'dynamic_exec': r"(?i)EXECUTE\s+IMMEDIATE|EXEC\s+\(",
    'no_where_clause': r"(?i)(UPDATE|DELETE)\s+\w+\s*;",
}

WARNINGS = {
    'no_rls_policy': r"(?i)CREATE\s+TABLE",
    'no_comments': r"(?i)ALTER\s+TABLE",
    'unsafe_defaults': r"(?i)CREATE\s+TABLE.*DEFAULT\s+CURRENT_TIMESTAMP",
}


def check_file(filepath):
    """Verifica um arquivo SQL para padrões perigosos."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')

    errors = []
    warnings = []

    for pattern_name, pattern in DANGEROUS_PATTERNS.items():
        for i, line in enumerate(lines, 1):
            if re.search(pattern, line):
                # Ignorar comentários
                if not line.strip().startswith('--'):
                    errors.append({
                        'file': filepath,
                        'line': i,
                        'pattern': pattern_name,
                        'content': line.strip(),
                        'severity': 'ERROR'
                    })

    for warning_name, pattern in WARNINGS.items():
        for i, line in enumerate(lines, 1):
            if re.search(pattern, line):
                if not line.strip().startswith('--'):
                    warnings.append({
                        'file': filepath,
                        'line': i,
                        'pattern': warning_name,
                        'content': line.strip(),
                        'severity': 'WARNING'
                    })

    return errors, warnings


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: check-sql-security.py <directory>")
        sys.exit(1)

    directory = Path(sys.argv[1])
    if not directory.exists():
        print(f"Error: Directory {directory} does not exist")
        sys.exit(1)

    all_errors = []
    all_warnings = []

    # Processa todos os arquivos .sql
    for sql_file in directory.rglob('*.sql'):
        errors, warnings = check_file(sql_file)
        all_errors.extend(errors)
        all_warnings.extend(warnings)

    # Output
    if all_errors:
        print("🚨 SECURITY ERRORS FOUND:\n")
        for error in all_errors:
            print(f"  {error['file']}:{error['line']}")
            print(f"    Pattern: {error['pattern']}")
            print(f"    Code: {error['content']}\n")
        sys.exit(1)

    if all_warnings:
        print("⚠️  WARNINGS:\n")
        for warning in all_warnings:
            print(f"  {warning['file']}:{warning['line']}")
            print(f"    Pattern: {warning['pattern']}")
            print(f"    Code: {warning['content']}\n")

    print("✅ SQL Security check passed!")
    sys.exit(0)


if __name__ == '__main__':
    main()
