#!/usr/bin/env python3
"""export_logs - 把 logs/ 目录下的日志导出为 CSV。

用法:
    python export_logs.py

行为:读取 logs/*.log 的所有行,解析为 (timestamp, level, message),
写入固定路径 ./export.csv(UTF-8,总是覆盖)。无法解析的行直接跳过。
"""
import csv
import glob
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE, "logs")
OUT_PATH = os.path.join(BASE, "export.csv")

LINE_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(DEBUG|INFO|WARN|ERROR)\s+(.*)$"
)


def parse_lines():
    rows = []
    for path in sorted(glob.glob(os.path.join(LOG_DIR, "*.log"))):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                m = LINE_RE.match(line.rstrip("\n"))
                if not m:
                    continue  # 无法解析的行直接跳过
                rows.append(m.groups())
    return rows


def main():
    rows = parse_lines()
    with open(OUT_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "level", "message"])
        writer.writerows(rows)
    print(f"exported {len(rows)} rows -> {OUT_PATH}")


if __name__ == "__main__":
    main()
