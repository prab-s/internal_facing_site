## Internal Facing Project Notes

This file explains how the project is currently structured, how authentication works, and what the main helper scripts do.

## Deployment stack layout

The project is now intended to run as one Podman Compose stack, not one giant container image.

Current stack layout:

- `app`
  - FastAPI API
  - Uvicorn
  - built inward-facing Svelte frontend
- `postgres`
  - primary database for the Internal Facing app

Future stack services already scaffolded in the same compose file:

- `wordpress`
  - customer-facing WordPress site
- `wordpress_db`
  - MariaDB for WordPress

So “all in one place” now means:

- one repo
- one compose stack
- one deployment workflow
- separate containers for separate responsibilities

The compose file is:

- [deploy-compose.yml](/home/user1/Documents/fan_graphs_website/deploy-compose.yml)

Important ports:

- internal app/API container address inside the compose network: `app:8000`
- deployed internal app exposed on the host: `8000`
- customer-facing WordPress exposed on the host: `8003`
- deployment Postgres exposed on the host: `5432`

`app:8000` is the internal compose-network address used by other containers.
For example, WordPress uses `http://app:8000` to talk to FastAPI from inside the same stack.

For production exposure, the intended shape is:

- exposed outward:
  - `app`
  - `wordpress`
- internal-only:
  - `wordpress_db`

`postgres` is intentionally a special case:

- it is not part of the public web app surface
- but it is exposed on host port `5432`, so local SIT/admin tasks and LAN tools can connect when networking and firewall rules allow

So the app Postgres server is reachable from the host machine and should be protected with sensible credentials/firewalling.

## Project Shape

The repo currently contains:

- An inward-facing Svelte frontend for staff use
- A FastAPI backend served by Uvicorn
- A PostgreSQL database as the primary database
- Product/media files stored in `data/`
- A Podman Compose deployment stack for production

The production stack is now intended to be "all in one place" as one deployment stack, not one single container image.

That means:

- `app` container: FastAPI backend + built Svelte frontend
- `postgres` container: primary app database
- optional future `wordpress` + `wordpress_db` containers: customer-facing site

## Databases

### Primary database

The app is now designed to run with PostgreSQL as the primary database:

- configured by `DATABASE_URL`
- for deployment, this points at the compose service name `postgres`

Example:

```env
DATABASE_URL=postgresql+psycopg://fan_graphs_user:password@postgres:5432/fan_graphs
```

## Authentication

Authentication is session-cookie based.

The split of responsibility is:

- FastAPI:
  - hashes passwords
  - verifies passwords
  - creates signed sessions
  - protects routes
- PostgreSQL:
  - stores the `users` table
  - stores the resulting password hashes
- Browser:
  - stores the signed session cookie after login

### How it works

1. A user signs in with username and password.
2. The backend verifies the password against a salted PBKDF2 hash stored in the `users` table.
3. The backend creates a signed session cookie.
4. The frontend includes cookies on API requests with `credentials: 'include'`.
5. Protected routes use backend auth dependencies to enforce access.

### Important backend auth behavior

Public endpoints:

- `/api/health`
- `/api/auth/session`
- `/api/auth/login`
- `/api/auth/logout`

Protected endpoints:

- all product CRUD endpoints
- chart/media endpoints
- graph maintenance endpoints
- database maintenance endpoints
- `/docs`
- `/openapi.json`

Media is protected too:

- `/api/media/product_images/...`
- `/api/media/product_graphs/...`

### User accounts

User accounts live in the `users` table.

Where the auth pieces live:

- hashing and verification:
  - [backend/main.py](/home/user1/Documents/fan_graphs_website/backend/main.py)
  - `hash_password(...)`
  - `verify_password(...)`
- user model:
  - [backend/models.py](/home/user1/Documents/fan_graphs_website/backend/models.py)
  - `User`
- session handling:
  - [backend/main.py](/home/user1/Documents/fan_graphs_website/backend/main.py)
  - `SessionMiddleware`

Fields currently include:

- `username`
- `password_hash`
- `is_admin`
- `is_active`

### Bootstrap admin

If no users exist yet, startup creates the first admin account from env vars:

```env
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=your_password_here
```

This bootstrap behavior only applies when the database has no users yet.

Once users exist, accounts are managed from the database, not re-created from env vars on every startup.

### Password changes and resets

There are two flows:

1. Self-service password change

- a signed-in user goes to `Setup`
- enters current password + new password
- backend verifies the current password before changing it

2. Admin reset

- an admin goes to `Setup`
- uses `Reset Password` for another user
- no old password is required for the target user
- backend overwrites the stored password hash

## Roles and future permissions

Right now the main role split is:

- normal signed-in user
- admin

The foundation for future role-based permissions is already in place in the backend:

- `get_current_user`
- `require_admin_user`

This means future permission checks can be added route-by-route without reworking auth from scratch.

## Frontend pages

Main internal pages:

- `/` Home
- `/entry` Product Editor
- `/catalogue` Product Data
- `/map` QA Preview
- `/setup` Account and admin setup

The `Setup` page now contains:

- `My Account` password change for any signed-in user
- `Current Users` overview
- `Access` / user creation card for admins only
- background maintenance controls for:
  - regenerating all product graph images
  - clearing all product graph images
  - regenerating all product PDFs
  - creating a database backup archive
  - creating a media data backup archive
  - restoring a database backup archive
- maintenance job polling with status text and a progress bar

## Environment files

### SIT

- [`.env.sit`](/home/user1/Documents/fan_graphs_website/.env.sit)

Used by:

- `./run_sit.sh`

`run_sit.sh` now loads:

1. [`.env.sit`](/home/user1/Documents/fan_graphs_website/.env.sit)

SIT should use its own PostgreSQL database name, even if it shares the same Postgres server as deployment.

That lets SIT keep its own schema/data while still overriding things like:

- `SESSION_SECRET`
- `AUTH_COOKIE_SECURE`

### PROD / deployment

- [`.env.deploy`](/home/user1/Documents/fan_graphs_website/.env.deploy)

Used by:

- `./redeploy.sh`
- `./backup_db_data.sh` for DB data
- `./backup_media_data.sh` for media data

Compatibility wrappers still exist at `./backup_bundle.sh` and `./backup_data.sh`.

### Important env values

Internal app:

- `DATABASE_URL`
- `SESSION_SECRET`
- `BOOTSTRAP_ADMIN_USERNAME`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `AUTH_COOKIE_SECURE`

Deployment Postgres:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Future WordPress stack:

- `COMPOSE_PROFILES`
- `WORDPRESS_PORT`
- `WORDPRESS_DB_NAME`
- `WORDPRESS_DB_USER`
- `WORDPRESS_DB_PASSWORD`
- `WORDPRESS_DB_ROOT_PASSWORD`

## Shell scripts

### `run_sit.sh`

Purpose:

- starts the SIT backend on port `8002`
- starts the SIT frontend on port `8001`
- loads `.env.sit`
- prepares the configured database with Alembic before startup
- keeps SIT on a separate database from deployment by default
- configures Chromium for product PDF generation in SIT

SIT PDF generation now works in either of these modes:

- preferred:
  - use a host-installed Chromium-compatible browser
  - `run_sit.sh` auto-detects `chromium`, `chromium-browser`, `google-chrome`, or `google-chrome-stable`
- fallback:
  - use Chromium from the local Podman app image through [sit-chromium-wrapper.sh](/home/user1/Documents/fan_graphs_website/scripts/sit-chromium-wrapper.sh)
  - this is used automatically when no host browser is found but `localhost/fan-graphs:latest` exists

If neither is available, `run_sit.sh` now stops with an actionable error instead of letting PDF generation fail later.

Use:

```bash
./run_sit.sh
```

### `redeploy.sh`

Purpose:

- loads `.env.deploy`
- brings down the existing deployment stack
- rebuilds the application image
- starts the Podman Compose deployment stack
- seeds the PROD app data volume from the existing host `data/` tree when it is still empty
- app startup prepares/applies database migrations before `uvicorn` starts
- waits for the FastAPI health endpoint
- if the WordPress profile is enabled, waits for WordPress too
- prints compose status and recent logs if startup times out

Use:

```bash
./redeploy.sh
```

### `migrate_db.sh`

Purpose:

- prepares the configured database(s) with Alembic
- creates the target database first when needed
- upgrades brand-new databases to the current baseline
- stamps and normalizes older databases so future revisions have a consistent base

Use:

```bash
./migrate_db.sh --sit
./migrate_db.sh --deploy
```

This now manages the whole stack from:

- [deploy-compose.yml](/home/user1/Documents/fan_graphs_website/deploy-compose.yml)

### `backup_db_data.sh`

Purpose:

- creates a DB data backup ZIP for SIT or deployment
- includes a PostgreSQL dump
- when backing up the deployment stack with WordPress running, it also includes:
  - a WordPress MariaDB dump
  - a `wp-content` snapshot
- prints timestamped progress in the terminal while it runs

Use:

```bash
./backup_db_data.sh
```

For SIT specifically:

```bash
./backup_db_data.sh --sit
```

For deployment specifically:

```bash
./backup_db_data.sh --deploy
```

Output:

- zip files written into `data/backups/` by default

### `backup_media_data.sh`

Purpose:

- creates a media data ZIP for SIT or deployment
- includes generated product and series assets when present:
  - `product_images`
  - `product_graphs`
  - `product_pdfs`
  - `product_type_pdfs`
  - `series_graphs`
  - `series_pdfs`
- includes templates when present
- excludes `data/backups/`
- prints timestamped progress in the terminal while it runs

Use:

```bash
./backup_media_data.sh
```

For SIT specifically:

```bash
./backup_media_data.sh --sit
```

For deployment specifically:

```bash
./backup_media_data.sh --deploy
```

Output:

- zip files written into `data/backups/` by default

### `restore_db_data.sh`

Purpose:

- restores a DB data zip created by `backup_db_data.sh`
- restores the PostgreSQL dump into SIT or deployment, depending on `ENV_FILE`
- restores WordPress data too when a deployment backup includes it
- prints timestamped progress in the terminal while it runs
- shows byte-stream progress for large restore phases when `pv` is installed
- terminates active PostgreSQL sessions before resetting the schema, which helps avoid restores hanging on `DROP SCHEMA`
- prefers direct `podman exec` into the existing named containers during deployment restores

Use:

```bash
./restore_db_data.sh data/backups/your_db_backup_file.zip
```

To restore a SIT DB backup into deployment:

```bash
./restore_db_data.sh data/backups/your_db_backup_file.zip --deploy
```

To restore into SIT:

```bash
./restore_db_data.sh data/backups/your_db_backup_file.zip --sit
```

This script currently restores:

- the Postgres SQL dump
- WordPress MariaDB + `wp-content` if present in the backup and restoring into deployment

### `restore_media_data.sh`

Purpose:

- restores a media data zip created by `backup_media_data.sh`
- restores media folders back into `data/` when they are present in the archive
- restores the `templates/` tree when present in the archive
- prints timestamped progress in the terminal while it runs

Use:

```bash
./restore_media_data.sh data/backups/your_media_backup_file.zip
```

To restore a SIT media backup into deployment:

```bash
./restore_media_data.sh data/backups/your_media_backup_file.zip --deploy
```

To restore into SIT:

```bash
./restore_media_data.sh data/backups/your_media_backup_file.zip --sit
```

This script currently restores:

- `data/product_images` when present
- `data/product_graphs` when present
- `data/product_pdfs` when present
- `data/product_type_pdfs` when present
- `data/series_graphs` when present
- `data/series_pdfs` when present
- `templates/` when present

### `postgres-compose.yml`

Purpose:

- local helper stack for a standalone Postgres instance
- useful for SIT/local database work

This is separate from the production deployment stack.

### `migrate_prod_data_volume.sh`

Purpose:

- copies the existing host-side `data/` media directories into the PROD Podman volume
- intended as a one-time migration helper before or after switching deployment to the named volume
- skips the SQLite database file and copies directory data only

Use:

```bash
./migrate_prod_data_volume.sh
```

## Podman deployment layout

### Current production stack

Defined in:

- [deploy-compose.yml](/home/user1/Documents/fan_graphs_website/deploy-compose.yml)

Current always-on services:

- `app`
- `postgres`
- `wordpress` when `COMPOSE_PROFILES=wordpress`
- `wordpress_db` when `COMPOSE_PROFILES=wordpress`

### Future WordPress stack

Also defined in the same compose file, behind the `wordpress` profile:

- `wordpress`
- `wordpress_db`

This means the customer-facing site lives in the same deployment stack and repo, but does not need to be forced into the same container image as the internal app.

To run WordPress in deployment, set in `.env.deploy`:

```env
COMPOSE_PROFILES=wordpress
```

and fill in the WordPress DB settings.

## WordPress / CMS foundation

The deployment stack already includes the WordPress foundation.

Configuration lives in:

- [deploy-compose.yml](/home/user1/Documents/fan_graphs_website/deploy-compose.yml)
- [`.env.deploy`](/home/user1/Documents/fan_graphs_website/.env.deploy)

WordPress-related env vars include:

- `WORDPRESS_PORT`
- `WORDPRESS_DB_NAME`
- `WORDPRESS_DB_USER`
- `WORDPRESS_DB_PASSWORD`
- `WORDPRESS_DB_ROOT_PASSWORD`
- `WORDPRESS_INTERNAL_API_BASE_URL`
- `CMS_API_TOKEN`

Important URL note:

- `WORDPRESS_INTERNAL_API_BASE_URL=http://app:8000` is correct inside the compose stack
- it is not a browser URL
- it is the internal container-to-container URL from the `wordpress` container to the `app` container
- the host-facing WordPress port is separate and currently intended to be `8003`
- WordPress derives its public URL dynamically from proxy headers such as `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto`

### Reverse proxy note for WordPress

If WordPress is accessible locally by `http://host:8003` but not by its public subdomain, the first thing to check is the WordPress canonical URL.

In this project:

- `wordpress_db` does not need a public host and is not the cause of public URL loading problems
- WordPress talks to `wordpress_db` internally on the compose network
- the common issue is that WordPress thinks its site URL is something local like `http://xps.local:8003`

The reverse proxy should preserve headers such as:

- `X-Forwarded-Proto`
- `X-Forwarded-Host`

### How WordPress will pull fan content

A dedicated read-only CMS API path now exists on the FastAPI side:

- `/api/cms/products`
- `/api/cms/products/{id}`

These endpoints use a dedicated CMS token, not the internal session-cookie login.

That token is configured with:

- `CMS_API_TOKEN` on the FastAPI side
- the same `CMS_API_TOKEN` is injected into WordPress as `FAN_GRAPHS_API_TOKEN`

### WordPress plugin

A custom plugin scaffold now lives at:

- [wordpress/plugins/fan-graphs-api/fan-graphs-api.php](/home/user1/Documents/fan_graphs_website/wordpress/plugins/fan-graphs-api/fan-graphs-api.php)

This plugin is intended for Elementor-friendly use via shortcodes.

It connects to these FastAPI endpoints:

- `GET /api/cms/products`
  - list of customer-facing products for WordPress cards/grids
- `GET /api/cms/products/{product_id}`
  - one detailed customer-facing product
- `GET /api/cms/series`
  - list of customer-facing series for landing pages and series cards
- `GET /api/cms/series/{series_id}`
  - one detailed customer-facing series
- `GET /api/cms/media/product_images/{file_name}`
- `GET /api/cms/media/product_graphs/{file_name}`
 - `GET /api/cms/media/product_pdfs/{file_name}`
 - `GET /api/cms/media/series_graphs/{file_name}`
 - `GET /api/cms/media/series_pdfs/{file_name}`
  - public customer media endpoints used server-side by the plugin

The plugin does not expose the internal app hostname to the browser.
Instead, it rewrites product image and graph URLs to a WordPress-side media proxy using:

- `/?internal_facing_media=product_images/...`
- `/?internal_facing_media=product_graphs/...`
- `/?internal_facing_media=product_pdfs/...`
- `/?internal_facing_media=series_graphs/...`
- `/?internal_facing_media=series_pdfs/...`

Legacy `?fan_graphs_media=...` requests are still accepted for backward compatibility.

So the flow is:

1. WordPress shortcode renders product content from `/api/cms/products...`
2. product image / graph URLs come back as `/api/cms/media/...`
3. the plugin rewrites those to `/?internal_facing_media=...`
4. WordPress fetches the actual media file from the internal FastAPI app using `FAN_GRAPHS_INTERNAL_API_BASE_URL`
5. the browser only ever sees the public WordPress domain

Preferred shortcodes:

- `[internal_facing_products]`
- `[internal_facing_product id="123"]`
- `[internal_facing_series]`
- `[internal_facing_product_types_nav]`
- `[internal_facing_product_picker]`

Legacy aliases still supported:

- `[fan_graphs_fans]`
- `[fan_graphs_fan id="123"]`

These can be placed inside Elementor’s shortcode widget to render product data pulled from the FastAPI CMS endpoints.

### WordPress shortcode usage

List shortcode:

```text
[internal_facing_products]
```

Supported attributes:

- `limit`
- `search`
- `product_type`
- `series`
- `parameter_filters`
- `parameter_string_filters`
- `parameter_number_filters`

Examples:

```text
[internal_facing_products]
```

```text
[internal_facing_products limit="6" product_type="fan"]
```

```text
[internal_facing_products product_type="fan" series="A series"]
```

```text
[internal_facing_products search="AFD" product_type="silencer"]
```

```text
[internal_facing_products parameter_string_filters="Motor|Type|TEFC"]
```

```text
[internal_facing_products parameter_number_filters="Motor|Power|2|5"]
```

```text
[internal_facing_products parameter_string_filters="Impeller|Type|Axial Aerofoil" parameter_number_filters="Motor|Power|2|5"]
```

Filter syntax:

- `parameter_string_filters`
  - `Group Name|Parameter Name|Exact Value`
- `parameter_number_filters`
  - `Group Name|Parameter Name|Min|Max`
- multiple filters are separated by `;`

Single product shortcode:

```text
[internal_facing_product id="1"]
```

Series shortcode examples:

```text
[internal_facing_series product_type="fan"]
```

```text
[internal_facing_series id="1"]
```

Product type navbar shortcode:

```text
[internal_facing_product_types_nav]
```

Product picker shortcode:

```text
[internal_facing_product_picker]
```

What the plugin renders:

- primary product image
- product title / product type
- basic meta fields such as mounting and discharge when present
- graph download link when a graph image exists
- PDF download link when a PDF exists
- for single-product rendering:
  - inline graph preview when available
  - inline PDF preview when available
  - `Description1`
  - `Description2`
  - `Description3`
  - grouped parameter/specification sections
  - `Comments`
- for single-series rendering:
  - inline graph preview when available
  - inline PDF preview when available

Additional plugin-supported public routes:

- `/products/type/{product_type_key}/`
  - product type landing page
  - intended to list all series for that product type
  - each series card includes links for the series detail page and series PDF
- `/products/{product_slug-or-id}/`
  - dedicated product detail page
  - intended to be crawlable and indexable
- `/series/{series_slug-or-id}/`
  - dedicated series detail page
  - intended to be crawlable and indexable

Preferred public links now use slugified names, for example:

- `/products/fan-1/`
- `/series/fan-a-series/`

Numeric routes are still accepted for compatibility.

### Recommended WordPress page structure

To support the customer-facing navigation and picker flow:

1. Create a homepage and place:
   - `[internal_facing_product_types_nav]`
   - `[internal_facing_product_picker]`
2. Create top-level product type pages as needed, for example:
   - `/fans`
   - `/silencers`
   - `/speed-controllers`
3. Add those pages to the main WordPress navbar.
4. On each of those pages, place the series shortcode for the relevant type, for example:

```text
[internal_facing_series product_type="fan"]
```

5. The plugin also exposes dedicated dynamic public routes:
   - `/products/type/{product_type_key}/`
   - `/products/{product_slug-or-id}/`
   - `/series/{series_slug-or-id}/`

These routes are generated by the plugin itself and can be linked from menus, cards, buttons, or search results.

If you want to change the default layout of the customer-facing product/series cards or detail views, the main places to edit are:

- `internal_facing_render_product_card(...)`
- `internal_facing_render_series_card(...)`

in:

- [wordpress/plugins/fan-graphs-api/fan-graphs-api.php](/home/user1/Documents/fan_graphs_website/wordpress/plugins/fan-graphs-api/fan-graphs-api.php)

The plugin’s CSS is also defined in that same file, in `internal_facing_enqueue_styles()`.

### Product picker behavior

`[internal_facing_product_picker]` renders a server-side filter form for customers.

It currently supports:

- product type dropdown
- mounting style dropdown when available for that product type
- discharge type dropdown when available for that product type
- grouped specification filters inferred from products of that type:
  - exact-value dropdowns for string specs
  - min/max range inputs for numeric specs

The picker then renders matching products below the form, with links to the dedicated product pages and product PDFs.

## PDF templates

Product and series PDF templates are controlled by:

- [registry.json](/home/user1/Documents/fan_graphs_website/templates/registry.json)

Template files currently live under:

- [template.html](/home/user1/Documents/fan_graphs_website/templates/product/default/template.html)
- [template.css](/home/user1/Documents/fan_graphs_website/templates/product/default/template.css)
- [template.html](/home/user1/Documents/fan_graphs_website/templates/series/default/template.html)
- [template.css](/home/user1/Documents/fan_graphs_website/templates/series/default/template.css)

The HTML uses placeholder tokens that the backend replaces before Chromium renders the PDF.

Useful product placeholders include:

- `{{product.model}}`
- `{{product.product_type_label}}`
- `{{product.series_name}}`
- `{{product.description1_html}}`
- `{{product.description2_html}}`
- `{{product.description3_html}}`
- `{{product.comments_html}}`
- `{{product.primary_product_image_url}}`
- `{{product.graph_image_url}}`
- `{{product.image_gallery}}`
- `{{product.grouped_specs_table}}`

### Adding grouped specifications to a template

The grouped-spec content is already rendered as HTML before it is injected into the template.

So in the template HTML, add a placeholder where you want that table block to appear:

```html
<section class="specifications-block">
  <h2>Grouped Specifications</h2>
  <div class="specifications-table">
    {{product.grouped_specs_table}}
  </div>
</section>
```

Then style the wrapper in the template CSS however you like.

Important detail:

- `{{product.grouped_specs_table}}` is not plain text
- it expands to fully rendered HTML sections/tables for each parameter group
- that means you should place it inside a normal container element like `<div>` or `<section>`, not inside an attribute

The same pattern applies to the rich-text description fields:

- `{{product.description1_html}}` -> `Description1`
- `{{product.description2_html}}` -> `Description2`
- `{{product.description3_html}}` -> `Description3`

### Referencing one specific grouped-spec value

You can now target a single grouped parameter in a product PDF template with this token format:

```text
{{spec.group_slug.parameter_slug}}
```

Examples:

```text
{{spec.impeller.size}}
{{spec.motor.power}}
{{spec.fan.weight}}
```

How the slugs are built:

- lowercase
- spaces and punctuation become underscores

Examples:

- `Impeller` + `Size` -> `{{spec.impeller.size}}`
- `Motor` + `Power Supply` -> `{{spec.motor.power_supply}}`
- `Fan` + `Max. Temp` -> `{{spec.fan.max_temp}}`

These tokens render the final value exactly as the grouped specification would show it, including the unit when it is a numeric field.

Required plugin config:

- `FAN_GRAPHS_INTERNAL_API_BASE_URL`
  - internal backend URL reachable from the WordPress container
  - example: `http://app:8000`
- `FAN_GRAPHS_API_TOKEN`
  - CMS bearer token accepted by `/api/cms/products...`

### Basic WordPress bring-up

With `COMPOSE_PROFILES=wordpress` in `.env.deploy`, `./redeploy.sh` will start:

- `wordpress`
- `wordpress_db`

After deployment, open:

- `http://your-host:8003`

and complete the standard WordPress installer.

Once that is done, you can:

1. sign into WordPress admin
2. activate the `Internal Facing API` plugin
3. create a basic page
4. place one of the shortcodes on the page

### Elementor

Elementor itself is not auto-installed yet.

The expected workflow later is:

1. enable the `wordpress` profile in `.env.deploy`
2. bring the stack up with `./redeploy.sh`
3. finish WordPress setup
4. install Elementor in WordPress
5. use Elementor’s drag-and-drop builder with the provided shortcodes

## Backup contents

The DB backup currently captures:

- PostgreSQL SQL dump
- WordPress MariaDB dump if the deployment WordPress stack is running in the backed-up environment
- WordPress `wp-content` snapshot if the deployment WordPress stack is running in the backed-up environment

The media data backup currently captures:

- `data/product_images`
- `data/product_graphs`
- `data/product_pdfs`
- `data/product_type_pdfs`
- `data/series_graphs`
- `data/series_pdfs`
- `templates/`
That gives two zip archives, one for DB data and one for media data.

This also explains why SIT backups can be much smaller than older deployment backups:

- SIT DB backups usually contain the app database + WordPress only if present
- SIT media backups usually contain the app media + templates only
- deployment backups can additionally contain:
  - `wordpress_dump.sql`
  - `wordpress/wp-content.tar`

So a small SIT backup is not automatically a broken backup.

## SIT to PROD initialisation

SIT and deployment should normally use separate databases.

If you intentionally want to copy current SIT data into deployment, the intended flow is:

1. create a backup from SIT:

```bash
    ./backup_db_data.sh --sit
    ./backup_media_data.sh --sit
```

2. restore the DB backup and media backup into deployment:

```bash
./restore_db_data.sh data/backups/your_db_backup_file.zip --deploy
./restore_media_data.sh data/backups/your_media_backup_file.zip --deploy
```

3. bring the deployment stack fully back up:

```bash
./redeploy.sh
```

Important:

- this is a data copy, not just a schema migration
- `./redeploy.sh` runs schema migration/startup, but it does not copy SIT data into deployment by itself
- restoring a SIT archive into deployment overwrites the deployment app database and any media captured in that archive

For larger backup/restore/regeneration tasks, the `Setup` page now uses background maintenance jobs instead of one long blocking browser request. The page starts the job, polls for status, and shows a progress bar. This is the recommended workflow when you want to avoid browser or Cloudflare request timeouts.

## Notes

- Keep `AUTH_COOKIE_SECURE=true` in deployed HTTPS environments.
- Keep `AUTH_COOKIE_SECURE=false` for local SIT if you are serving over plain HTTP.
- The old shared `APP_PASSWORD` approach is obsolete.
- PostgreSQL is now the intended primary database.
- Legacy compatibility wrappers remain available as:
  - `./backup_bundle.sh`
  - `./backup_data.sh`
  - `./restore_bundle.sh`
  - `./restore_data.sh`
