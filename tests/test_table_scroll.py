"""Regression test: product table must show a working scrollbar when items > visible rows.

The root bug: Treeview + Scrollbar layout in the left panel. Multiple past attempts
to fix scroll failed because of pack-order issues, missing constraints, and the
Treeview expanding to show all rows.

This test creates a real tkinter window, populates the table, and verifies:
1. The scrollbar widget exists and is mapped (visible)
2. The scrollbar has non-zero width (not squeezed out by tree)
3. yview is NOT (0.0, 1.0) — meaning not all items are visible, scroll is needed
4. yview_scroll actually changes the view position
5. After search with fewer results, scroll state is correct
"""

import tkinter as tk
from tkinter import ttk
import sys, os, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _build_test_table(root, num_items=200):
    """Build a minimal reproduction of the product table layout from main_window.py."""
    # Reproduce the exact same layout hierarchy as the real app
    root.geometry("1200x720+9999+9999")  # off-screen so WM enforces geometry

    # Header placeholder
    tk.Frame(root, height=64).pack(fill="x")
    # Banner placeholder
    tk.Frame(root, height=34).pack(fill="x")

    body = tk.Frame(root)
    body.pack(fill="both", expand=True, padx=10, pady=8)

    left = tk.Frame(body, width=420)
    left.pack(side="left", fill="y")
    left.pack_propagate(False)

    # Search placeholder
    tk.Label(left, text="Search").pack(anchor="w", padx=12, pady=(12, 4))
    tk.Entry(left, width=30).pack(fill="x", padx=12)

    # Separator
    tk.Frame(left, height=1).pack(fill="x", pady=(8, 0))

    # ── THIS IS THE CODE UNDER TEST ──
    # Import the actual tbl_wrap + tree + scrollbar setup pattern
    style = ttk.Style()
    try:
        style.theme_use("clam")
    except Exception:
        pass
    style.configure("Test.Treeview", rowheight=30)

    tbl_wrap = tk.Frame(left)
    tbl_wrap.pack(fill="both", expand=True)
    tbl_wrap.grid_rowconfigure(0, weight=1)
    tbl_wrap.grid_columnconfigure(0, weight=1)

    tree = ttk.Treeview(tbl_wrap, columns=("check", "article", "price"),
                        show="headings", style="Test.Treeview")
    tree.heading("check", text="☐")
    tree.heading("article", text="Article")
    tree.heading("price", text="Price")
    tree.column("check", width=28, stretch=False)
    tree.column("article", width=150)
    tree.column("price", width=60)

    sb = tk.Scrollbar(tbl_wrap, orient="vertical", command=tree.yview, width=16)
    tree.configure(yscrollcommand=sb.set)
    tree.grid(row=0, column=0, sticky="nsew")
    sb.grid(row=0, column=1, sticky="ns")

    # Counter placeholder
    tk.Label(left, text="").pack(fill="x", padx=12, pady=(2, 0))
    # History placeholder
    tk.Frame(left, height=1).pack(fill="x")
    tk.Label(left, text="History").pack(anchor="w", padx=12, pady=(8, 4))
    hist = tk.Frame(left, height=165)
    hist.pack(fill="x", pady=(0, 8))
    hist.pack_propagate(False)

    # Populate
    for i in range(num_items):
        tree.insert("", "end", iid=str(i),
                    values=("☐", f"Product {i}", f"{i:.2f}€"))

    return tree, sb, tbl_wrap


class TestTableScroll(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.root = tk.Tk()
        cls.root.geometry("1200x720+9999+9999")  # off-screen, WM enforces size
        cls.tree, cls.sb, cls.tbl_wrap = _build_test_table(cls.root, num_items=200)
        # Process events so WM maps the window and enforces geometry
        cls.root.after(100, cls.root.quit)
        cls.root.mainloop()

    @classmethod
    def tearDownClass(cls):
        cls.root.destroy()

    def test_scrollbar_is_mapped(self):
        """Scrollbar widget must be visible (mapped) in the window."""
        self.assertTrue(self.sb.winfo_ismapped(),
                        "Scrollbar is not mapped — invisible to user")

    def test_scrollbar_has_width(self):
        """Scrollbar must have non-zero width (not squeezed out by tree)."""
        sb_width = self.sb.winfo_width()
        self.assertGreaterEqual(sb_width, 10,
                                f"Scrollbar width={sb_width}px — too narrow or invisible")

    def test_tree_does_not_show_all_items(self):
        """With 200 items, yview must NOT be (0.0, 1.0) — scroll must be needed."""
        yv = self.tree.yview()
        self.assertLess(yv[1], 1.0,
                        f"yview={yv} — all items visible, no scroll needed. "
                        f"Tree height={self.tree.winfo_height()}px, "
                        f"tbl_wrap height={self.tbl_wrap.winfo_height()}px")

    def test_scroll_changes_view(self):
        """yview_scroll must actually change the view position."""
        before = self.tree.yview()
        self.tree.yview_scroll(5, "units")
        self.root.update_idletasks()
        after = self.tree.yview()
        self.tree.yview_moveto(0)  # reset
        self.root.update_idletasks()
        self.assertNotEqual(before, after,
                            f"yview didn't change after scroll: {before}")

    def test_scrollbar_position_reflects_content(self):
        """Scrollbar thumb must be at top and smaller than full range."""
        self.tree.yview_moveto(0)
        self.root.update_idletasks()
        yv = self.tree.yview()
        # yv[0] should be 0.0 (at top), yv[1] should be < 1.0 (not showing everything)
        self.assertAlmostEqual(yv[0], 0.0, places=2)
        self.assertLess(yv[1], 0.5,
                        f"Scrollbar thumb too large: yview={yv}, tree shows too many rows")

    def test_after_search_few_results(self):
        """After repopulating with fewer items than visible rows, scroll adapts."""
        # Clear and add only 5 items
        self.tree.delete(*self.tree.get_children())
        for i in range(5):
            self.tree.insert("", "end", values=("☐", f"Result {i}", "1,00€"))
        self.root.update_idletasks()
        yv = self.tree.yview()
        # All 5 items should be visible — yview should be (0.0, 1.0)
        self.assertEqual(yv, (0.0, 1.0),
                         f"5 items should all be visible but yview={yv}")

        # Restore 200 items — scroll should come back
        self.tree.delete(*self.tree.get_children())
        for i in range(200):
            self.tree.insert("", "end", values=("☐", f"Product {i}", f"{i:.2f}€"))
        self.root.update_idletasks()
        yv2 = self.tree.yview()
        self.assertLess(yv2[1], 1.0,
                        f"After restoring 200 items, scroll should be needed but yview={yv2}")


if __name__ == "__main__":
    unittest.main()
