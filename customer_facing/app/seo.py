from app.config import settings


def seo_meta(title, description="", path="/"):
    canonical = f"{settings.public_site_url}{path}"

    return {
        "title": f"{title} | {settings.site_name}",
        "description": description or settings.site_name,
        "canonical": canonical,
    }
