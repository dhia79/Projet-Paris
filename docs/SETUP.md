# Manual setup checklist

Everything in this repository is written and committed. These are the steps that need an account,
a card, or a machine-local install — they cannot be done from the repo.

Work top to bottom; each section is independent of the ones below it.

---

## 1. Retire the old Firebase project (do this first)

The web API key `AIzaSy…FXPEM` is still in this repository's git history and is tied to a live
project. It is not a secret in the strict sense, but it identifies a real billable project.

1. [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
   → delete the browser key for `projet-paris-6bf57`.
2. [Firebase Console](https://console.firebase.google.com) → project settings → delete the project.

---

## 2. Local toolchain

| Tool | Needed for | Check |
| --- | --- | --- |
| Node 22+ | frontend | `node --version` |
| Go 1.23+ | `services/api-go` | `go version` |
| Docker Desktop | the whole compose stack | `docker --version` |
| PHP 8.3 + Composer | `services/admin-symfony` | `php --version` |
| R 4.4 + RStudio | `analytics/r` | `Rscript --version` |

Only Node is installed today. Nothing else in the repo depends on the missing tools until you run
the service that uses them.

After installing Go:

```bash
cd services/api-go && go mod tidy && go test ./...
```

`go.sum` is deliberately absent — `go mod tidy` is what writes it, and it needs network access.

After installing PHP:

```bash
cd services/admin-symfony && composer install && vendor/bin/phpunit
```

After installing R:

```bash
Rscript analytics/r/install_deps.R
```

---

## 3. Google Cloud

```bash
gcloud auth login
```

```bash
gcloud config set project YOUR_PROJECT_ID
```

```bash
gcloud services enable appengine.googleapis.com sqladmin.googleapis.com bigquery.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

```bash
gcloud app create --region=europe-west1
```

Billing must be enabled on the project before App Engine will accept a deploy.

---

## 4. Cloud SQL (MySQL 8)

1. Create the instance (console or `gcloud sql instances create`), region `europe-west1`.
2. Note the **connection name** — `project:region:instance`. Both the Go API and the pipeline read
   it from `INSTANCE_CONNECTION_NAME`.
3. Create the database and users:

```bash
gcloud sql databases create paris_fraicheur --instance=YOUR_INSTANCE
```

Create three users with least privilege rather than one shared account:

| User | Grants | Used by |
| --- | --- | --- |
| `paris_api` | `SELECT` on all tables | `services/api-go` |
| `paris_pipeline` | `SELECT, INSERT, UPDATE, DELETE` | Airflow |
| `paris_admin` | `SELECT, INSERT, UPDATE` on `citizen_reports` | Symfony |

4. Apply the schema:

```bash
mysql -h YOUR_HOST -u root -p < pipeline/sql/001_schema.sql
```

```bash
mysql -h YOUR_HOST -u root -p < pipeline/sql/002_seed.sql
```

(The compose stack applies both automatically on first boot — this is only for Cloud SQL.)

---

## 5. BigQuery

The dataset and table are created by the pipeline itself (`ensure_table`). You only need a service
account with `roles/bigquery.dataEditor`, and its key placed at `deploy/keys/gcp-sa.json` for local
runs. That directory is gitignored.

Leave `GCP_PROJECT` empty in `deploy/.env` to skip BigQuery entirely and run MySQL-only.

---

## 6. GitLab

1. Create the project and push this repository.
2. Settings → CI/CD → Variables, add:

| Variable | Type | Flags |
| --- | --- | --- |
| `GCP_PROJECT_ID` | variable | protected |
| `GCP_SA_KEY` | file | protected, masked |

The service account needs `roles/appengine.deployer`, `roles/appengine.serviceAdmin`,
`roles/cloudbuild.builds.editor` and `roles/storage.admin`.

---

## 7. Metabase

Start the stack, open http://localhost:3000, create the admin account in its own UI, then add a
database connection:

- Type: **MySQL**
- Host: `mysql` (inside the compose network) or `127.0.0.1` from the host
- Database: `paris_fraicheur`
- User: a read-only MySQL user

Good first questions to build: `v_arrondissement_stats` as a bar chart, and
`arrondissement_scores` ordered by `vulnerability_index`.

---

## 8. Symfony admin credentials

```bash
docker compose -f deploy/docker-compose.yml run --rm admin php bin/console security:hash-password
```

Paste the hash into `ADMIN_PASSWORD_HASH` in `deploy/.env`.
