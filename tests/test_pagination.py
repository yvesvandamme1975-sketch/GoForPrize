import sys, os, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.pagination import page_bounds


class TestPageBounds(unittest.TestCase):
    def test_2900_products_span_6_pages(self):
        self.assertEqual(page_bounds(2900, 0, 500), (0, 500, 0, 6))
        self.assertEqual(page_bounds(2900, 5, 500), (2500, 2900, 5, 6))

    def test_page_clamped_to_range(self):
        self.assertEqual(page_bounds(2900, 99, 500), (2500, 2900, 5, 6))
        self.assertEqual(page_bounds(2900, -3, 500), (0, 500, 0, 6))

    def test_empty_and_small(self):
        self.assertEqual(page_bounds(0, 0, 500), (0, 0, 0, 1))
        self.assertEqual(page_bounds(42, 1, 500), (0, 42, 0, 1))

    def test_exact_multiple(self):
        self.assertEqual(page_bounds(1000, 1, 500), (500, 1000, 1, 2))


if __name__ == "__main__":
    unittest.main()
