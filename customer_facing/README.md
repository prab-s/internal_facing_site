# Vent-tech catalogue

Server-rendered public catalogue site.

This app does **not** own product data. It renders public HTML by calling the existing customer-facing CMS API.

---

## Environment

```
BACKEND_API_BASE_URL=https://p2.bitrep.nz
PUBLIC_SITE_URL=http://0.0.0.0:8004
SITE_NAME=Vent-tech catalogue
REQUEST_TIMEOUT_SECONDS=10
CATALOGUE_CACHE_PATH=/tmp/vent-tech-catalogue-cache.json
CATALOGUE_REFRESH_INTERVAL_SECONDS=300
CMS_API_TOKEN=<same token used by the CMS consumer>
```

---

## Run Locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8004
```

The public CMS endpoints in this repo require the CMS bearer token, so local runs need `CMS_API_TOKEN` set in `.env` or the shell environment.
The customer-facing app now keeps a local read-only cache of catalogue/filter data and refreshes it on startup, periodically, and after backend write notifications.

---

## Run in Podman

```bash
./run_container.sh
```

## Run as a boot service

To run the catalogue automatically when the host boots, install the systemd service that wraps Podman:

```bash
sudo ./install_service.sh
```

This will:

- refresh the installed service unit on each service start/restart
- build the `vent-tech-catalogue:latest` image from `Containerfile`
- install a `vent-tech-catalogue.service` unit under systemd
- create `/etc/vent-tech-catalogue/vent-tech-catalogue.env` if it does not already exist
- start the service immediately and on every later boot

Edit `/etc/vent-tech-catalogue/vent-tech-catalogue.env` to set the real `PUBLIC_SITE_URL`, `BACKEND_API_BASE_URL`, and `CMS_API_TOKEN` for the host.

---

## Then open:

```
http://localhost:8004
```

---

## Routes

| Route | Description |
|------|------------|
| `/` | Lightweight overview landing page |
| `/products` | Product finder |
| `/products/type/{product_type_key}` | Product type landing page |
| `/series/{id}-{slug}` | Series detail page |
| `/products/{id}-{slug}` | Product detail page |
| `/finder/results` | Partial product result updates |

---

## Notes

- This is a **public-facing catalogue**.
- Data is sourced dynamically from the read-only `/api/cms/...` API surface.
- Designed for SEO-friendly routing and clean URLs.
- The app does not import internal backend modules at runtime; it talks to the API over HTTP.
