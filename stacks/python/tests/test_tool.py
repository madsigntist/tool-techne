"""Smoke tests: tool.json is valid, its documents exist, and main.py runs.
Add tests beside these as soon as the tool does something."""
import json
import pathlib
import unittest

import main

ROOT = pathlib.Path(__file__).resolve().parent.parent


class ToolTest(unittest.TestCase):
    def test_docs_exist(self):
        manifest = json.loads((ROOT / "tool.json").read_text(encoding="utf-8"))
        for rel in manifest["docs"].values():
            self.assertTrue((ROOT / rel).exists(), f"{rel} is missing")

    def test_main_runs(self):
        self.assertIn("Hello, test.", main.main(["--name", "test"]))


if __name__ == "__main__":
    unittest.main()
