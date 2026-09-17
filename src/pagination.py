def page_bounds(total: int, page: int, size: int):
    """Return (start, end, page, pages) with page clamped to a valid index."""
    pages = max(1, -(-total // size))
    page = min(max(page, 0), pages - 1)
    start = page * size
    return start, min(start + size, total), page, pages
