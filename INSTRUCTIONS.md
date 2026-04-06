## Fan Graphs Project Notes

This file explains how the project is currently structured, how authentication works, and what the main helper scripts do.

## Deployment stack layout

The project is now intended to run as one Podman Compose stack, not one giant container image.

Current stack layout:

- `app`
  - FastAPI API
  - Uvicorn
  - built inward-facing Svelte frontend
- `postgres`
  - primary database for the Fan Graphs app

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
- deployment Postgres bound to host loopback only: `127.0.0.1:5432`

`app:8000` is the internal compose-network address used by other containers.
For example, WordPress uses `http://app:8000` to talk to FastAPI from inside the same stack.

For production exposure, the intended shape is:

- exposed outward:
  - `app`
  - `wordpress`
- internal-only:
  - `wordpress_db`

`postgres` is intentionally a special case:

- it is not exposed publicly to the outside world
- but it is bound to `127.0.0.1:5432` on the host so local SIT and admin tasks can use the same database safely

So the databases are still not public, but the app Postgres database is available locally on the host machine.

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

### Optional mirror database

There is still code support for a Postgres mirror via `POSTGRES_DATABASE_URL`, but once you are fully Postgres-primary you should normally leave that empty.

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

- all fan CRUD endpoints
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
- `/entry` Data Entry
- `/catalogue` Catalogue
- `/map` Fan Map
- `/setup` Account and admin setup

The `Setup` page now contains:

- `My Account` password change for any signed-in user
- `Current Users` overview
- `Access` / user creation card for admins only

## Environment files

### SIT

- [`.env.sit`](/home/user1/Documents/fan_graphs_website/.env.sit)

Used by:

- `./run_sit.sh`

`run_sit.sh` now loads:

1. [`.env.deploy`](/home/user1/Documents/fan_graphs_website/.env.deploy)
2. [`.env.sit`](/home/user1/Documents/fan_graphs_website/.env.sit)

in that order.

That means SIT can share the same PostgreSQL database as deployment by default, while still overriding things like:

- `SESSION_SECRET`
- `AUTH_COOKIE_SECURE`

### PROD / deployment

- [`.env.deploy`](/home/user1/Documents/fan_graphs_website/.env.deploy)

Used by:

- `./redeploy.sh`
- `./backup_bundle.sh`

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
- loads `.env.deploy` first, then `.env.sit`
- lets SIT reuse the deployment Postgres database while keeping SIT-specific overrides

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
- waits for the FastAPI health endpoint
- if the WordPress profile is enabled, waits for WordPress too
- prints compose status and recent logs if startup times out

Use:

```bash
./redeploy.sh
```

This now manages the whole stack from:

- [deploy-compose.yml](/home/user1/Documents/fan_graphs_website/deploy-compose.yml)

### `backup_bundle.sh`

Purpose:

- creates a zip backup bundle for SIT or deployment
- includes a PostgreSQL dump
- includes media folders from `data/`
- automatically includes `product_pdfs` later if that folder exists
- when backing up the deployment stack with WordPress running, it also includes:
  - a WordPress MariaDB dump
  - a `wp-content` snapshot

Use:

```bash
./backup_bundle.sh
```

For SIT specifically:

```bash
./backup_bundle.sh --sit
```

For deployment specifically:

```bash
./backup_bundle.sh --deploy
```

Output:

- zip files written into `backups/`

### `restore_bundle.sh`

Purpose:

- restores a zip bundle created by `backup_bundle.sh`
- restores the PostgreSQL dump into SIT or deployment, depending on `ENV_FILE`
- restores media folders back into `data/`
- restores WordPress data too when a deployment backup includes it

Use:

```bash
./restore_bundle.sh backups/your_backup_file.zip
```

To restore a SIT backup into deployment:

```bash
./restore_bundle.sh backups/your_backup_file.zip --deploy
```

To restore into SIT:

```bash
./restore_bundle.sh backups/your_backup_file.zip --sit
```

This script currently restores:

- the Postgres SQL dump
- `data/product_images`
- `data/product_graphs`
- `data/product_pdfs` if present in the backup
- WordPress MariaDB + `wp-content` if present in the backup and restoring into deployment

### `migrate_sqlite_to_postgres.sh`

Purpose:

- one-off import of the legacy SQLite `fans.db` data into PostgreSQL
- uses the existing application sync logic
- copies:
  - users
  - fans
  - RPM lines
  - RPM points
  - efficiency points
  - product image rows

Use:

```bash
./migrate_sqlite_to_postgres.sh --sqlite-path data/fans.db --postgres-url "postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/fan_graphs"
```

If `.env.deploy` already contains the correct `DATABASE_URL`, you can omit `--postgres-url`.

### `postgres-compose.yml`

Purpose:

- local helper stack for a standalone Postgres instance
- useful for SIT/local database work

This is separate from the production deployment stack.

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

- `/api/cms/fans`
- `/api/cms/fans/{id}`

These endpoints use a dedicated CMS token, not the internal session-cookie login.

That token is configured with:

- `CMS_API_TOKEN` on the FastAPI side
- the same `CMS_API_TOKEN` is injected into WordPress as `FAN_GRAPHS_API_TOKEN`

### WordPress plugin

A custom plugin scaffold now lives at:

- [wordpress/plugins/fan-graphs-api/fan-graphs-api.php](/home/user1/Documents/fan_graphs_website/wordpress/plugins/fan-graphs-api/fan-graphs-api.php)

This plugin is intended for Elementor-friendly use via shortcodes.

Current shortcodes:

- `[fan_graphs_fans]`
- `[fan_graphs_fan id="123"]`

These can be placed inside Elementor’s shortcode widget to render fan data pulled from the FastAPI CMS endpoints.

### Basic WordPress bring-up

With `COMPOSE_PROFILES=wordpress` in `.env.deploy`, `./redeploy.sh` will start:

- `wordpress`
- `wordpress_db`

After deployment, open:

- `http://your-host:8003`

and complete the standard WordPress installer.

Once that is done, you can:

1. sign into WordPress admin
2. activate the `Fan Graphs API` plugin
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

The backup bundle currently captures:

- PostgreSQL SQL dump
- `data/product_images`
- `data/product_graphs`
- `data/product_pdfs` if present later
- WordPress MariaDB dump if the deployment WordPress stack is running
- WordPress `wp-content` snapshot if the deployment WordPress stack is running

That gives one zip archive containing both structured data and related media files.

## SIT to PROD initialisation

If SIT and deployment are configured to use the same PostgreSQL database, then they are already looking at the same app data and you do not need a SIT-to-PROD restore just to copy records across.

In that shared-database setup, backup/restore is still useful for:

- seeding a brand-new deployment database
- disaster recovery
- moving data to a completely different host

If SIT and deployment are not sharing the same database, the intended flow is:

1. create a backup from SIT:

```bash
./backup_bundle.sh --sit
```

2. restore that bundle into deployment:

```bash
./restore_bundle.sh backups/your_backup_file.zip --deploy
```

3. bring the deployment stack fully back up:

```bash
./redeploy.sh
```

## Notes

- Keep `AUTH_COOKIE_SECURE=true` in deployed HTTPS environments.
- Keep `AUTH_COOKIE_SECURE=false` for local SIT if you are serving over plain HTTP.
- The old shared `APP_PASSWORD` approach is obsolete.
- PostgreSQL is now the intended primary database.
