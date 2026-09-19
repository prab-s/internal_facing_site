"""Seed the editable footer-only Terms & Conditions CMS page."""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa


revision = "20260920_000032"
down_revision = "20260919_000031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    content = json.dumps({})
    seo = json.dumps({
        "title": "Terms & Conditions",
        "description": "Vent-Tech terms and conditions.",
    })
    layout = json.dumps([{
        "id": "terms-introduction",
        "type": "rich-text",
        "width": "full",
        "surface": "card",
        "spacing": "md",
        "radius": "lg",
        "content": "<h1>Terms &amp; Conditions</h1><p>Add the approved terms and conditions for Vent-Tech here.</p>",
    }])
    op.execute(sa.text("""
        INSERT INTO site_pages (
            slug, label, content_type,
            draft_content, published_content,
            draft_layout, published_layout,
            draft_seo, published_seo,
            status, published_at
        ) VALUES (
            'terms-and-conditions', 'Terms & Conditions', 'page',
            CAST(:content AS jsonb), CAST(:content AS jsonb),
            CAST(:layout AS jsonb), CAST(:layout AS jsonb),
            CAST(:seo AS jsonb), CAST(:seo AS jsonb),
            'published', CURRENT_TIMESTAMP
        )
        ON CONFLICT (slug) DO NOTHING
    """).bindparams(content=content, layout=layout, seo=seo))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM site_pages WHERE slug = 'terms-and-conditions'"))
