"""Create the four marketing layouts through the same CMS API as the editor.

Run with python3 -m scripts.rebuild_marketing_cms_pages.
Defaults to saving drafts; --publish explicitly publishes the saved drafts.
Existing saved layouts are skipped. A JSON backup precedes all writes.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

import requests
from dotenv import dotenv_values

from backend.site_cms import default_site_page_map
from backend.site_page_layouts import MARKETING_PAGE_SLUGS, marketing_page_layout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", default=".env.deploy")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--publish", action="store_true")
    parser.add_argument("--replace", action="store_true", help="Replace an existing draft layout.")
    args = parser.parse_args()
    config = dotenv_values(args.env)
    session = requests.Session()

    def call(method, path, **kwargs):
        # The local API uses secure production cookies. Explicitly allow those
        # cookies on the loopback connection only, never on a remote HTTP URL.
        if args.base_url in {"http://127.0.0.1:8000", "http://localhost:8000"}:
            for cookie in session.cookies:
                cookie.secure = False
        response = session.request(method, args.base_url + "/api" + path, timeout=30, **kwargs)
        response.raise_for_status()
        return response.json()

    auth = call("GET", "/auth/session")
    session.headers["X-CSRF-Token"] = auth["csrf_token"]
    auth = call("POST", "/auth/login", json={"username": config["BOOTSTRAP_ADMIN_USERNAME"], "password": config["BOOTSTRAP_ADMIN_PASSWORD"]})
    session.headers["X-CSRF-Token"] = auth["csrf_token"]
    pages = call("GET", "/cms/pages")
    selected = [page for page in pages if page["slug"] in MARKETING_PAGE_SLUGS]
    if len(selected) != len(MARKETING_PAGE_SLUGS):
        raise RuntimeError("Expected all four existing marketing pages before rebuilding.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup = Path(".rebuild-state") / f"marketing-cms-{stamp}.json"
    backup.parent.mkdir(exist_ok=True)
    backup.write_text(json.dumps(selected, indent=2))
    print(f"Backup: {backup}")
    defaults = default_site_page_map()
    for page in selected:
        slug = page["slug"]
        if page.get("draft_layout") is None or args.replace:
            content = {**defaults[slug]["content"], **page.get("draft_content", {})}
            call("PUT", f"/cms/pages/{slug}", json={"content": page["draft_content"], "seo": page["draft_seo"], "layout": marketing_page_layout(slug, content)})
            print(f"Saved CMS draft: {slug}")
        else:
            print(f"Preserved existing CMS layout: {slug}")
        if args.publish:
            call("POST", f"/cms/pages/{slug}/publish")
            print(f"Published: {slug}")


if __name__ == "__main__":
    main()
