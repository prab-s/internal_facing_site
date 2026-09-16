"""Built-in seed content for the editable customer-facing marketing pages."""

from copy import deepcopy


def _page(slug, label, content, seo, content_type="page"):
    from backend.site_page_layouts import MARKETING_PAGE_SLUGS, marketing_page_layout

    page = {"slug": slug, "label": label, "content_type": content_type, "content": content, "seo": seo}
    if slug in MARKETING_PAGE_SLUGS:
        page["layout"] = marketing_page_layout(slug, content)
    return page


def default_site_pages():
    return [
        _page("about-us", "About Us", {
            "hero_kicker": "About Us · Placeholder content",
            "hero_heading": "Practical products, thoughtful engineering, and people who care about the details.",
            "hero_intro": "This page is a placeholder introduction to Vent-Tech. Replace the copy, statistics, team profiles, and imagery below with approved company information when the final content is ready.",
            "hero_callout_label": "Placeholder note",
            "hero_callout_text": "Add a team photograph, workshop image, or short brand video here in the next content pass.",
            "story_kicker": "Our story",
            "story_heading": "A placeholder story about where we came from and where we are going",
            "story_paragraphs": [
                "Vent-Tech was established to help customers find dependable air-management and ventilation products without unnecessary complexity. This paragraph should eventually explain the company’s founding, its original purpose, and the people who helped shape the business.",
                "Today, our placeholder story is about combining useful product information with practical support. Add the real milestones, locations, customer types, and achievements here once they have been confirmed.",
                "We believe good service starts with listening carefully, asking useful questions, and helping customers make decisions they can feel confident about.",
            ],
            "stats": [
                {"value": "2018", "label": "Placeholder founding year"},
                {"value": "25+", "label": "Placeholder years of experience"},
                {"value": "4", "label": "Placeholder workshop services"},
                {"value": "100%", "label": "Placeholder commitment to service"},
            ],
            "values": [
                {"title": "Be useful", "text": "Make product information clear, answer questions directly, and keep the next step easy to understand."},
                {"title": "Build with care", "text": "Pay attention to materials, measurements, finishes, and the small details that make a result dependable."},
                {"title": "Keep improving", "text": "Learn from every project and keep refining our products, processes, and customer experience."},
            ],
            "team_heading": "The people behind the work",
            "team_intro": "Use this section for approved team biographies, roles, profile photos, and a short introduction to the way the team works together.",
            "team_members": ["Team member one · Placeholder role", "Team member two · Placeholder role", "Team member three · Placeholder role"],
            "cta_heading": "Have a question about a product, project, or custom requirement?",
            "cta_text": "This placeholder call to action can become a short, specific invitation to contact the team.",
            "cta_label": "Contact us",
        }, {"title": "About Us", "description": "Learn more about Vent-Tech, our placeholder company story, values, capabilities, and team."}),
        _page("contact", "Contact", {
            "hero_kicker": "Contact",
            "hero_heading": "Talk to Vent-Tech about selection, pricing, or project support",
            "hero_intro": "Use the team below for direct help with product selection, quoting, and documentation.",
            "quote_label": "Request a quote",
            "quote_text": "Send the project details through and the team can point you to the right product type, series, or model datasheet.",
            "quote_button": "Enquire",
            "address_heading": "Vent-Tech 2018 Ltd.",
            "address": "576c Fergusson Drive, Upper Hutt 5018, Wellington",
            "shopfront_image": "/static/media/venttech_shop_front.jpg",
            "direct_contacts_label": "Direct contacts",
            "contacts": [
                {"name": "Admin", "role": "Shop - general", "email": "admin@venttech.co.nz", "phone": "04 595 1403"},
                {"name": "Gerald Keown", "role": "Managing Director", "email": "gerald@venttech.co.nz", "phone": "022 0697 270"},
                {"name": "Nilesh Patel", "role": "Design / Technical / Sales", "email": "nilesh@venttech.co.nz", "phone": "021 088 969 55"},
                {"name": "Alex Keown", "role": "Operations Manager", "email": "alex@venttech.co.nz", "phone": "027 815 9924"},
                {"name": "Mahendra Dahya", "role": "Technical / Sales", "email": "mahendra@venttech.co.nz", "phone": "027 5560 197"},
            ],
        }, {"title": "Contact", "description": "Contact Vent-Tech for product selection, pricing, engineering support, and project enquiries."}),
        _page("engineering-services", "Engineering Services", {
            "hero_kicker": "Engineering services",
            "hero_heading": "Fabrication support for custom metalwork and project build-outs",
            "hero_intro": "Our engineering services cover the practical workshop processes that turn flat material into usable parts. We support laser cutting, brake pressing, rolling, and flanging for custom fabrication jobs, prototypes, and repeat work.",
            "capabilities_label": "Workshop capabilities",
            "capabilities": ["Laser cutting for clean, accurate part profiles", "Brake pressing for folds, returns, and formed sections", "Rolling for curved sections and controlled radii", "Flanging for stiffened edges and better assembly"],
            "what_we_do_heading": "Reliable workshop processes that support fabrication and product development",
            "what_we_do_paragraphs": ["Engineering services are often the bridge between design intent and a finished component. We can help with straightforward production work, one-off parts, and custom fabrication requirements where a clean, accurate result matters.", "The service list below focuses on the main processes people ask us for most often. If your job needs a combination of these steps, we can usually sequence the work so the part moves from flat material to a ready-to-use component without unnecessary rework."],
            "best_fit": ["Custom metal parts and small assemblies", "Prototype work and repeat fabrication runs", "Panels, brackets, guards, and formed components", "Edge finishing and shape control on curved parts"],
            "services": [
                {"title": "Laser cutting", "badge": "01", "image": "/static/media/laser-cutter.svg", "summary": "Clean, accurate part profiles for prototypes, production runs, and custom fabrication.", "points": ["Repeatable cut profiles", "Efficient sheet utilisation", "Suitable for one-off and repeat work"]},
                {"title": "Brake pressing", "badge": "02", "image": "/static/media/brake-press.svg", "summary": "Controlled folds, returns, and formed sections to help parts fit and assemble cleanly.", "points": ["Accurate bends and returns", "Formed panels and brackets", "Consistent results across a run"]},
                {"title": "Rolling", "badge": "03", "image": "/static/media/roller.svg", "summary": "Curved sections and controlled radii for practical metalwork and airflow applications.", "points": ["Controlled curved sections", "Repeatable radii", "Support for custom shapes"]},
                {"title": "Flanging", "badge": "04", "image": "/static/media/flanger.svg", "summary": "Stiffened edges and tidy finishing details that support robust, practical assembly.", "points": ["Stiffened component edges", "Neat assembly details", "Useful for custom ducting and parts"]},
            ],
            "custom_heading": "Need something made for a specific space, duty, or application?",
            "custom_paragraphs": ["Our fabrication capabilities can support more than standard catalogue items. From an early concept or rough sketch through to formed panels, brackets, ducting, guards, and other practical components, we can help explore a solution that fits the job.", "Share your dimensions, drawings, photos, performance requirements, or simply describe the problem. The team can review the details and come back with the next best step."],
            "custom_button": "Tell us about your project",
        }, {"title": "Engineering Services", "description": "Explore Vent-Tech engineering services including laser cutting, brake pressing, rolling, and flanging."}),
        _page("past-projects", "Past Projects", {
            "hero_kicker": "Past Projects", "hero_heading": "A quick look at previous project highlights", "hero_intro": "This page is a placeholder for now. We’ll use it to highlight finished jobs, case studies, before-and-after examples, and the kinds of outcomes customers can expect when they work with Vent-Tech.", "hero_callout_label": "Coming soon", "hero_callout_text": "Add project photos, short summaries, and key project details here once the content is ready.", "carousel_label": "Project collage", "carousel_heading": "Compact carousel of previous work", "carousel_intro": "Placeholder visuals for now, ready to replace with real project images.", "projects": [
                {"label": "Laser cutting", "text": "Precision sheet work and repeatable cut profiles", "image": "/static/media/laser-cutter.svg"}, {"label": "Brake pressing", "text": "Clean folds, returns, and formed sections", "image": "/static/media/brake-press.svg"}, {"label": "Rolling", "text": "Curved sections and controlled radii", "image": "/static/media/roller.svg"}, {"label": "Flanging", "text": "Stiffened edges and tidy assembly details", "image": "/static/media/flanger.svg"}
            ], "snapshot_heading": "Short, visual summaries", "snapshot_text": "This section can later hold a grid of project cards with photos, the problem to solve, and the finished result.", "industries_heading": "Examples by sector", "industries_text": "Use this space for industry-specific examples, like ventilation, fabrication support, commercial builds, or custom engineering jobs.", "details_heading": "A few useful details", "details_text": "Photos, project goals, fabrication steps, and any notable outcomes would all fit nicely here when the content is available."
        }, {"title": "Past Projects", "description": "Explore Vent-Tech fabrication and engineering project highlights."}),
        _page("enquiries-modal", "Enquiries modal", {"kicker": "Enquiries", "heading": "Tell us what you need", "context_loading": "Loading context...", "name_label": "Name", "company_label": "Company", "email_label": "Email", "phone_label": "Phone number", "request_heading": "How should we quote this?", "request_help": "Choose the route that best matches what you need. We’ll use the page context to keep the enquiry specific.", "request_options": [{"value": "standard", "title": "Quote this item", "text": "Use the current product or series as the starting point."}, {"value": "tailored", "title": "Tailored product", "text": "I need something that does not exist in the current catalogue."}, {"value": "unsure", "title": "Help me choose", "text": "Answer a few quick questions and we’ll point you in the right direction."}], "context_fields": {"airflow": True, "pressure": True}, "submit_label": "Send enquiry", "footer_text": "Your enquiry will be sent directly to the Vent-Tech team."}, {"title": "Enquiries", "description": "Tell Vent-Tech what you need and send the enquiry to the team."}, "modal"),
    ]


def default_site_page_map():
    return {item["slug"]: item for item in deepcopy(default_site_pages())}
