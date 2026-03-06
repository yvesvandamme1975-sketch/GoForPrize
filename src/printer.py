import os
import subprocess
import sys


class DymoPrinter:
    @staticmethod
    def list_dymo_printers():
        """Return printer names available via CUPS (macOS/Linux) or Windows."""
        if sys.platform == "win32":
            return DymoPrinter._list_windows_printers()
        # macOS / Linux — use CUPS via lpstat -e (locale-independent)
        try:
            result = subprocess.run(
                ["lpstat", "-e"], capture_output=True, text=True, timeout=3)
            names = [l.strip() for l in result.stdout.splitlines() if l.strip()]
            return names or ["(aucune)"]
        except Exception:
            return ["(aucune)"]

    @staticmethod
    def _list_windows_printers():
        """Return all printer names via win32print (Windows only)."""
        try:
            import win32print
            printers = win32print.EnumPrinters(
                win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
            names = [p[2] for p in printers]
            return names or ["(aucune)"]
        except Exception:
            return ["(aucune)"]

    @staticmethod
    def print_label_pdf(pdf_path: str, printer_name: str) -> None:
        """Send a label PDF directly to the printer."""
        if sys.platform == "win32":
            DymoPrinter._win_print(pdf_path, printer_name)
        else:
            # macOS / Linux — CUPS
            subprocess.run(["lp", "-d", printer_name, pdf_path], check=True)

    @staticmethod
    def _win_print(pdf_path: str, printer_name: str) -> None:
        """Print a PDF on Windows using SumatraPDF if available, else shell print."""
        # Try SumatraPDF silent print (no dialog, respects printer choice)
        sumatra = _find_sumatra()
        if sumatra:
            subprocess.run(
                [sumatra, "-print-to", printer_name, "-silent", pdf_path],
                check=True)
            return
        # Fallback: open with the system PDF viewer and trigger the print verb.
        # The user may see a brief dialog depending on the installed viewer.
        os.startfile(os.path.abspath(pdf_path), "print")

    @staticmethod
    def open_pdf_and_print(pdf_path: str) -> None:
        """Open a PDF with the system print dialog (A4)."""
        if sys.platform == "darwin":
            subprocess.run(["open", pdf_path], check=True)
        elif sys.platform == "win32":
            # "print" verb opens the file and sends it to the default printer
            os.startfile(os.path.abspath(pdf_path), "print")
        else:
            subprocess.run(["xdg-open", pdf_path], check=True)


def _find_sumatra() -> str | None:
    """Return the path to SumatraPDF.exe if installed, else None."""
    candidates = [
        r"C:\Program Files\SumatraPDF\SumatraPDF.exe",
        r"C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None
