"""Visual CMS layouts for the customer-facing marketing pages."""
from html import escape
import re

MARKETING_PAGE_SLUGS = ("about-us", "contact", "engineering-services", "past-projects")


def marketing_page_layout(slug: str, content: dict) -> list[dict]:
    if slug not in MARKETING_PAGE_SLUGS:
        raise ValueError(f"Not a marketing page: {slug}")

    def text(value): return escape(str(value or ""))
    def paragraphs(values):
        if isinstance(values, str): values = [values]
        return "".join(f"<p>{text(value)}</p>" for value in values or [])
    def bullets(values): return "<ul>" + "".join(f"<li>{text(value)}</li>" for value in values or []) + "</ul>"
    def section(key, kind, **values):
        return {"id": f"{slug}-{key}", "type": kind, "width": "full", "surface": "card", "spacing": "md", "radius": "lg", **values}
    def cards(key, title, items, **values):
        return section(key, "cards", title=title, columns=values.pop("columns", 3), tabletColumns=2,
                       cardStyle=values.pop("cardStyle", "raised"), imageFit=values.pop("imageFit", "contain"),
                       imageRatio=values.pop("imageRatio", "wide"),
                       cards=[{"id": f"{slug}-{key}-{index}", "title": name, "content": body, "image": image} for index, (name, body, image) in enumerate(items)], **values)

    hero = section("hero", "image-text", tone="dark", headingSize="display", eyebrow=content.get("hero_kicker", slug.replace("-", " ")), content=f"<h1>{text(content.get('hero_heading'))}</h1>{paragraphs(content.get('hero_intro'))}", imagePosition="right", imageFit="contain", imageRatio="square", backgroundColor="#172636", gradientEnabled=True, gradientColor="#7b222a", gradientAngle=135)

    if slug == "about-us":
        hero.update(width="half", image="", actionLabel="Talk to the team", action={"type": "page", "target": "/contact"}, buttonVariant="light")
        companion = section("intro-note", "rich-text", width="half", tone="soft", eyebrow=content.get("hero_callout_label", "About Vent-Tech"), content=f"<h2>Built for practical work.</h2><p>{text(content.get('hero_callout_text'))}</p><p>This page remains a placeholder until approved company history, team details, and photography are available.</p>")
        return [hero, companion,
            section("story", "rich-text", eyebrow=content.get("story_kicker", "Our story"), content=f"<h2>{text(content.get('story_heading'))}</h2>{paragraphs(content.get('story_paragraphs'))}"),
            cards("stats", "Vent-Tech at a glance", [(item.get("value", ""), f"<p>{text(item.get('label'))}</p>", "") for item in content.get("stats", [])], columns=4, tone="soft", textAlign="center"),
            cards("values", "What guides the work", [(item.get("title", ""), paragraphs(item.get("text")), "") for item in content.get("values", [])], columns=3, eyebrow="How we work"),
            section("team", "cta", tone="brand", eyebrow="Team", content=f"<h2>{text(content.get('team_heading'))}</h2>{paragraphs(content.get('team_intro'))}", actionLabel=content.get("cta_label", "Contact us"), action={"type": "page", "target": "/contact"}, buttonVariant="light"),
        ]

    if slug == "contact":
        hero.update(width="full", image="", actionLabel=content.get("quote_button", "Make an enquiry"), action={"type": "modal", "target": "quoteRequestModal"}, buttonVariant="light")
        people = []
        for person in content.get("contacts", []):
            phone = str(person.get("phone", "")); digits = re.sub(r"\D", "", phone); dial = "+64" + digits[1:] if digits.startswith("0") else "+" + digits
            people.append((person.get("name", ""), f"<p>{text(person.get('role'))}</p><p><a href=\"mailto:{text(person.get('email'))}\">{text(person.get('email'))}</a><br><a href=\"tel:{dial}\">{text(phone)}</a></p>", ""))
        return [hero,
            section("visit", "image-text", tone="soft", eyebrow="Visit or call", content=f"<h2>{text(content.get('address_heading'))}</h2><p class=\"lead\">{text(content.get('address'))}</p><p>{text(content.get('quote_text'))}</p>", image=content.get("shopfront_image", ""), imageAlt="Vent-Tech shop front", imagePosition="left", imageFit="cover", imageRatio="wide"),
            cards("contacts", content.get("direct_contacts_label", "Direct contacts"), people, columns=3, eyebrow="People who can help"),
        ]

    if slug == "engineering-services":
        hero.update(width="half", image="", actionLabel=content.get("custom_button", "Tell us about your project"), action={"type": "modal", "target": "quoteRequestModal"}, buttonVariant="light")
        capability_note = section("capability-note", "rich-text", width="half", tone="soft", eyebrow=content.get("capabilities_label", "Workshop capabilities"), content=f"<h2>Practical workshop support.</h2>{bullets(content.get('capabilities'))}")
        services = [(item.get("title", ""), f"{paragraphs(item.get('summary'))}{bullets(item.get('points'))}", item.get("image", "")) for item in content.get("services", [])]
        return [hero, capability_note,
            cards("services", "Built around the job", services, columns=2, eyebrow="Workshop services"),
            section("process", "image-text", tone="soft", eyebrow="From idea to component", content=f"<h2>{text(content.get('what_we_do_heading'))}</h2>{paragraphs(content.get('what_we_do_paragraphs'))}{bullets(content.get('best_fit'))}", image="/static/media/brake-press.svg", imageAlt="Brake pressing service", imagePosition="right", imageFit="contain", imageRatio="square"),
            section("cta", "cta", tone="brand", textAlign="center", content=f"<h2>{text(content.get('custom_heading'))}</h2>{paragraphs(content.get('custom_paragraphs'))}", actionLabel=content.get("custom_button", "Tell us about your project"), action={"type": "modal", "target": "quoteRequestModal"}, buttonVariant="light"),
        ]

    hero.update(width="half", image="", actionLabel="Discuss your project", action={"type": "page", "target": "/contact"}, buttonVariant="light")
    project_note = section("project-note", "rich-text", width="half", tone="soft", eyebrow=content.get("hero_callout_label", "Coming soon"), content=f"<h2>Real project stories are on the way.</h2>{paragraphs(content.get('hero_callout_text'))}")
    projects = [(item.get("label", ""), paragraphs(item.get("text")), item.get("image", "")) for item in content.get("projects", [])]
    return [hero, project_note,
        section("notice", "rich-text", tone="soft", textAlign="center", eyebrow=content.get("hero_callout_label", "Coming soon"), content=f"<h2>{text(content.get('carousel_heading'))}</h2>{paragraphs(content.get('hero_callout_text'))}{paragraphs(content.get('carousel_intro'))}"),
        cards("collage", content.get("carousel_label", "Project collage"), projects, columns=2, eyebrow="Placeholder imagery"),
        cards("context", "What future case studies will include", [(content.get(f"{key}_heading", ""), paragraphs(content.get(f"{key}_text", "")), "") for key in ("snapshot", "industries", "details")], columns=3, tone="dark", cardStyle="minimal"),
        section("cta", "cta", tone="brand", textAlign="center", content="<h2>Have a project in mind?</h2><p>Tell the team about the space, application, drawings, or performance requirements.</p>", actionLabel="Contact us", action={"type": "page", "target": "/contact"}, buttonVariant="light"),
    ]
