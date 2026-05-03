import re


def slugify(value):
    value = str(value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def product_url(product):
    return f"/products/{product['id']}-{slugify(product.get('model'))}"


def series_url(series):
    return f"/series/{series['id']}-{slugify(series.get('name'))}"


def product_type_url(product_type):
    return f"/products/type/{product_type['key']}"


def products_url():
    return "/products"
