#!/usr/bin/env python3
"""notes - 极简命令行笔记工具。

用法:
    python notes.py add "标题" --body "正文" --tags work,idea
    python notes.py list [--all]
    python notes.py archive <id>
    python notes.py delete <id>
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notes.json")


def load_db():
    if not os.path.exists(DB_PATH):
        return {"next_id": 1, "notes": []}
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_db(db):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def cmd_add(args):
    db = load_db()
    note = {
        "id": db["next_id"],
        "title": args.title,
        "body": args.body or "",
        "tags": [t for t in (args.tags or "").split(",") if t],
        "archived": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db["notes"].append(note)
    db["next_id"] += 1
    save_db(db)
    print(f"added #{note['id']}: {note['title']}")


def cmd_list(args):
    db = load_db()
    notes = db["notes"]
    if not args.all:
        notes = [n for n in notes if not n["archived"]]
    print(f"{'ID':<4} {'标题':<24} {'标签':<16} 创建时间")
    for n in notes:
        tags = ",".join(n["tags"])
        print(f"{n['id']:<4} {n['title']:<24} {tags:<16} {n['created_at'][:10]}")


def cmd_archive(args):
    db = load_db()
    for n in db["notes"]:
        if n["id"] == args.id:
            n["archived"] = True
            save_db(db)
            print(f"archived #{args.id}")
            return
    print(f"note #{args.id} not found", file=sys.stderr)
    sys.exit(1)


def cmd_delete(args):
    db = load_db()
    before = len(db["notes"])
    db["notes"] = [n for n in db["notes"] if n["id"] != args.id]
    if len(db["notes"]) == before:
        print(f"note #{args.id} not found", file=sys.stderr)
        sys.exit(1)
    save_db(db)
    print(f"deleted #{args.id}")


def main():
    parser = argparse.ArgumentParser(prog="notes")
    sub = parser.add_subparsers(dest="command", required=True)

    p_add = sub.add_parser("add")
    p_add.add_argument("title")
    p_add.add_argument("--body", default="")
    p_add.add_argument("--tags", default="")
    p_add.set_defaults(func=cmd_add)

    p_list = sub.add_parser("list")
    p_list.add_argument("--all", action="store_true", help="包含已归档笔记")
    p_list.set_defaults(func=cmd_list)

    p_archive = sub.add_parser("archive")
    p_archive.add_argument("id", type=int)
    p_archive.set_defaults(func=cmd_archive)

    p_delete = sub.add_parser("delete")
    p_delete.add_argument("id", type=int)
    p_delete.set_defaults(func=cmd_delete)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
