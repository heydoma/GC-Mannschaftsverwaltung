# Deployment – GC-Mannschaftsverwaltung

Dieses Verzeichnis enthält alles was für den Betrieb auf einem Kubernetes-Cluster benötigt wird.

```
deploy/
  helm/                  ← Helm Chart (App + PostgreSQL + Keycloak)
    Chart.yaml
    values.yaml          ← Alle Werte dokumentiert, sichere Defaults
    values.prod.yaml     ← Deine echten Werte (in .gitignore, nie committen)
    templates/
      backend-deployment.yaml
      backend-service.yaml
      backend-configmap.yaml
      frontend-deployment.yaml
      frontend-service.yaml
      ingress.yaml       ← Wildcard-Routing + TLS
      networkpolicy.yaml ← DB-Isolation
      secrets.yaml       ← Fallback wenn kein Sealed Secret
  sealed-secrets/        ← Vorlagen zum Versiegeln (in .gitignore)
    postgres-secret.yaml
    keycloak-secret.yaml
```

---

## Architektur

```
Internet
  │  HTTPS :443
  ▼
nginx-Ingress-Controller        (einziger öffentlicher Eintrittspunkt)
  ├── meinclub.de /api/*    →   Backend  (FastAPI :8000)
  ├── meinclub.de /*        →   Frontend (nginx   :80)
  ├── *.meinclub.de /api/*  →   Backend  (Tenant via Host-Header)
  ├── *.meinclub.de /*      →   Frontend
  └── auth.meinclub.de /*   →   Keycloak (:8080)

Backend
  ├── → PostgreSQL :5432   ✅  (NetworkPolicy erlaubt)
  └── → Keycloak   :8080   ✅  (JWT-Validierung)

Alles andere → PostgreSQL       ❌  (NetworkPolicy blockt)
```

### Multi-Tenancy

Jedes Team bekommt eine eigene Subdomain, z.B. `herren1.meinclub.de`.  
Das Backend liest den `Host`-Header und löst daraus das Datenbankschema auf (`tenant_1`, `tenant_2` …).  
Ein neues Team braucht **keine Ingress-Änderung** – nur einen DB-Eintrag.

### TLS-Zertifikate

| Domain | Typ | Solver |
|---|---|---|
| `meinclub.de` | Einzelzertifikat | HTTP01 |
| `*.meinclub.de` | Wildcard | DNS01 (Cloudflare / Route53) |
| `auth.meinclub.de` | Einzelzertifikat | HTTP01 |

---

## Voraussetzungen im Cluster

```bash
# 1. nginx-ingress-controller
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# 2. cert-manager
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true

# 3. Sealed Secrets Controller
helm upgrade --install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system
```

Außerdem: ein CNI-Plugin mit NetworkPolicy-Support (Calico, Cilium oder Weave –  
bei den meisten Managed-Clustern bereits vorinstalliert).

---

## Secrets verwalten (Sealed Secrets)

Passwörter werden **verschlüsselt in Git gespeichert** – nur der Cluster-Controller kann sie entschlüsseln.

```bash
# 1. Vorlage ausfüllen (wird nicht committet)
nano deploy/sealed-secrets/postgres-secret.yaml
nano deploy/sealed-secrets/keycloak-secret.yaml

# 2. Versiegeln (braucht aktiven Cluster-Zugriff)
kubeseal --format yaml \
  < deploy/sealed-secrets/postgres-secret.yaml \
  > deploy/sealed-secrets/postgres.sealedsecret.yaml

kubeseal --format yaml \
  < deploy/sealed-secrets/keycloak-secret.yaml \
  > deploy/sealed-secrets/keycloak.sealedsecret.yaml

# 3. Versiegelte Dateien committen (sicher – verschlüsselt)
git add deploy/sealed-secrets/*.sealedsecret.yaml

# 4. Im Cluster anwenden
kubectl apply -f deploy/sealed-secrets/postgres.sealedsecret.yaml -n golf
kubectl apply -f deploy/sealed-secrets/keycloak.sealedsecret.yaml -n golf
```

`.gitignore` ist so konfiguriert:
- `*-secret.yaml` → **ignoriert** (Klartext)
- `*.sealedsecret.yaml` → **erlaubt** (verschlüsselt)

---

## Erstmaliges Deployment

```bash
# 1. Helm-Dependencies laden (PostgreSQL + Keycloak Sub-Charts)
cd deploy/helm
helm dependency update

# 2. values.prod.yaml anlegen (Vorlage: values.yaml)
cp values.yaml values.prod.yaml
# → Domain, Image-Repository, ggf. lokale Passwörter eintragen

# 3. Sealed Secrets im Cluster anwenden (siehe oben)

# 4. Deployen
helm upgrade --install gcm . \
  --namespace golf --create-namespace \
  -f values.yaml \
  -f values.prod.yaml \
  --wait --timeout 5m
```

---

## CI/CD Pipeline

### `ci.yml` – läuft bei jedem Push und Pull Request

| Job | Was |
|---|---|
| `backend-tests` | Python 3.12, alle Migrationen dynamisch, pytest |
| `frontend-build` | Node 20, `npm run build` als Smoke-Test |

### `release.yml` – Push auf `main` + manueller Deploy

**Automatisch bei Push auf `main`:**
- Backend-Image → `ghcr.io/.../gc-backend:<sha7>` + `:latest`
- Frontend-Image → `ghcr.io/.../gc-frontend:<sha7>` + `:latest`
- VITE-Variablen werden zur Build-Zeit eingebettet (kommen aus GitHub Secrets)

**Manuell (Actions → Release → Run workflow):**
- `confirm_deploy = ja` → zusätzlich Helm-Deploy auf den Cluster
- `image_tag` → optional spezifischen Tag deployen (leer = aktueller Commit)

### Benötigte GitHub Secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Wert |
|---|---|
| `KUBE_CONFIG` | `kubectl config view --raw \| base64` |
| `HELM_VALUES_PROD` | Inhalt deiner `values.prod.yaml` |
| `VITE_KEYCLOAK_URL` | z.B. `https://auth.meinclub.de` |

Optional: unter **Settings → Environments** ein Environment `production` anlegen  
und einen Required Reviewer eintragen – dann braucht der Deploy-Job eine manuelle Freigabe.

---

## Nützliche Befehle

```bash
# Status aller Pods
kubectl get pods -n golf

# Logs Backend
kubectl logs -l app=gcm-backend -n golf --tail=100 -f

# Helm-Status
helm status gcm -n golf

# Rollback auf vorherige Version
helm rollback gcm -n golf

# Alle Ingress-Regeln
kubectl get ingress -n golf

# NetworkPolicies prüfen
kubectl get networkpolicy -n golf
```
