import pytest
from pypdf import PdfReader, PdfWriter

from backend.main import (
    SEPARATOR_PAGE_HEIGHT_PT,
    SEPARATOR_PAGE_WIDTH_PT,
    _append_pdf_page_slice,
)


def test_combined_pdf_page_slice_normalises_mixed_a4_boxes(tmp_path):
    source = tmp_path / "mixed.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=594.96, height=841.92)
    writer.add_blank_page(width=595.275591, height=841.889764)
    with source.open("wb") as handle:
        writer.write(handle)

    combined = PdfWriter()
    assert _append_pdf_page_slice(combined, source, 0) == 2
    output = tmp_path / "combined.pdf"
    with output.open("wb") as handle:
        combined.write(handle)

    pages = PdfReader(str(output)).pages
    assert len(pages) == 2
    for page in pages:
        assert float(page.mediabox.width) == pytest.approx(SEPARATOR_PAGE_WIDTH_PT)
        assert float(page.mediabox.height) == pytest.approx(SEPARATOR_PAGE_HEIGHT_PT)
        assert float(page.cropbox.width) == pytest.approx(SEPARATOR_PAGE_WIDTH_PT)
        assert float(page.cropbox.height) == pytest.approx(SEPARATOR_PAGE_HEIGHT_PT)
