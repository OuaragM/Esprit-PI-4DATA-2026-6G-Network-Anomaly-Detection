# AI-Driven Attack Defense for IoT Smart Cities in 6G Networks

> **"Turning Network Signals into Smart City Resilience"**

A production-grade, MLOps-enabled intrusion detection system (IDS) for IoT-based smart cities operating in 5G/6G network environments. Built with a Mixture-of-Experts ensemble architecture, comprehensive CI/CD automation, and real-time monitoring.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Usage](#usage)
- [Performance Metrics](#performance-metrics)
- [Security](#security)
- [Testing & Validation](#testing--validation)
- [Deployment](#deployment)
- [Monitoring & Observability](#monitoring--observability)
- [Team](#team)
- [Academic Context](#academic-context)
- [Future Work](#future-work)
- [License](#license)

---

## 🎯 Overview

This project implements a comprehensive, production-ready anomaly detection platform designed to identify and mitigate cyber-attacks in IoT-powered smart city infrastructures within 5G/6G networks. The system combines advanced machine learning techniques with modern DevOps practices to deliver:

- **Real-time attack detection** with <200ms P95 inference latency
- **Scalable microservices architecture** with 21 containerized services
- **Intelligent model orchestration** via Mixture-of-Experts ensemble
- **Automated MLOps pipeline** with CI/CD, versioning, and drift detection
- **Production-grade security** with JWT authentication, RBAC, and comprehensive scanning
- **Real-time observability** via Prometheus, Grafana, and MLflow

---

## ⚠️ Problem Statement

### Business Challenge

Anomaly detection in network and IoT data is critical but suffers from:

- **Manual analysis bottleneck**: Slow, costly, and error-prone processes
- **Reactive security**: Traditional rule-based systems cannot detect evolved/zero-day attacks
- **Scale complexity**: Heterogeneous 5G/6G datasets with imbalanced classes
- **Operational overhead**: Lack of explainability and monitoring

### Technical Context

Rapid smart city digitalization, massive IoT device proliferation, and the shift toward 6G infrastructures are dramatically increasing cyber threat exposure. While reactive security systems are insufficient, deploying a proactive, behavior-based detection framework requires:

1. Handling heterogeneous traffic from multiple network scenarios (eMBB, mMTC, URLLC)
2. Detecting both known and zero-day attacks (one-class learning for 6G)
3. Maintaining model quality in production with concept drift detection
4. Scaling inference and retraining across distributed environments

### Business & Data Science Objectives

✅ **Service Continuity** → Early, behavior-based attack detection  
✅ **Operational Efficiency** → Precision, explainable alerts with minimal false positives  
✅ **Cost Reduction** → Scalable, maintainable, automated pipeline  

---

## ✨ Key Features

### Machine Learning

- ✅ **Supervised modeling**: XGBoost, Random Forest, Logistic Regression with 99%+ accuracy
- ✅ **Unsupervised learning**: Autoencoder + Isolation Forest for zero-day resilience
- ✅ **Mixture-of-Experts ensemble**: Specialized experts for eMBB, mMTC, URLLC + protocol-based autoencoders
- ✅ **Intelligent gating**: MLP-based weighted routing across experts with Platt calibration
- ✅ **Imbalance handling**: Stratified splits, class weighting, F1-optimized thresholds
- ✅ **Feature engineering**: Log transformations, correlation filtering, One-Hot encoding

### Data Processing

- ✅ Data preprocessing pipeline (cleaning, missing values, encoding)
- ✅ Outlier handling using IQR Winsorization
- ✅ Feature engineering (log transformations, correlation filtering)
- ✅ Balanced dataset evaluation and performance metrics
- ✅ Multi-dataset analysis (Global, eMBB, mMTC, URLLC 5G traffic scenarios)
- ✅ Support for both labeled 5G and unlabeled 6G datasets

### MLOps & Deployment

- ✅ **CI/CD Pipeline**: GitHub Actions with 5 CI jobs (~8 min) + 5 CD jobs (~40 min)
- ✅ **Model Versioning**: MLflow-driven experiment tracking and auto-promotion
- ✅ **Auto-Promotion Logic**: F1 ≥ 0.90, Recall ≥ 0.95, PR-AUC ≥ 0.92
- ✅ **Hot Reload**: Update models without service restart (`/admin/reload`)
- ✅ **Drift Detection**: PSI-based anomaly detection on 7-day windows with Slack alerts
- ✅ **Docker Containerization**: 9 production images, security scanning with Trivy
- ✅ **Code Quality**: Automated linting (ruff), formatting (black), security scanning (bandit)

### Infrastructure & Microservices

- ✅ **21 microservices** organized in 6 functional layers
- ✅ **Dual-network architecture**: edge (public) + data (internal) networks
- ✅ **Stateless design**: Horizontally scalable inference and training services
- ✅ **Async job processing**: Celery worker for batch prediction pipelines
- ✅ **5 data stores**: PostgreSQL, MLflow DB, Monitoring DB, Redis, MinIO
- ✅ **Rate limiting & caching**: Redis-backed request throttling

### Frontend & Observability

- ✅ **React 18 dashboard** with role-gated pages (10+ pages)
- ✅ **Real-time KPI cards**: Live accuracy, F1, ROC-AUC from MLflow
- ✅ **Upload & predict**: Drag-drop CSV interface with results table
- ✅ **Training control**: Trigger background training with custom epochs
- ✅ **i18n support**: English & French interface
- ✅ **Grafana dashboards**: 4 rows × 2–3 panels (inference, machine, containers, model quality)
- ✅ **Prometheus metrics**: 6 scrape jobs, 30-day retention
- ✅ **Pushgateway**: Model gauges (accuracy, F1, AUC, PR-AUC) integration

### Security

- ✅ JWT authentication + role-based access control (RBAC)
- ✅ Internal API key (X-Api-Key) for inter-microservice auth
- ✅ Admin-only gating on `/train/start` and `/drift/run`
- ✅ Automated security scanning: Trivy (FS + images), Bandit, pip-audit
- ✅ Secrets management: `.env.example` + auto-generated 64-char keys
- ✅ Password hashing: bcrypt with jose JWT library

---

## 🏗️ Architecture

### Layered Microservices Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (User)                         │
│                    :3000 / :8090                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────▼──────────────────┐
         │   🎨 Frontend Layer (1 service)   │
         │                                    │
         │   frontend-svc (Next.js 14)       │
         │   Port: 3000:3000                  │
         └──────────────────┬──────────────────┘
                           │
         ┌─────────────────▼──────────────────┐
         │   🚪 Edge Gateway (1 service)     │
         │                                    │
         │   api-gateway (FastAPI)           │
         │   Port: 8090:8090                  │
         │   JWT validation, routing          │
         └──────────┬──────────────┬──────────┘
                    │              │
        ┌───────────┴───────┐  ┌───┴──────────┐
        │                   │  │              │
    ┌───▼────────────┐  ┌──▼──▼──┐      ┌───▼─────┐
    │  🔐 Business   │  │   🤖   │      │    📊   │
    │  (5 services)  │  │   ML    │      │ MLOps   │
    │                │  │ (3 svc) │      │ (6 svc) │
    │ • auth-svc     │  │         │      │         │
    │ • upload-svc   │  │• moe-   │      │•mlflow  │
    │ • inference-   │  │ infer   │      │•prom    │
    │  svc           │  │• moe-   │      │•grafana │
    │ • report-svc   │  │ train   │      │•cadvisor│
    │ • celery-wkr   │  │• moe-   │      │•node-ex │
    │                │  │ monitor │      │•pushgw  │
    └────────┬───────┘  └────┬────┘      └───┬─────┘
             │               │               │
             └───────────────┼───────────────┘
                             │
             ┌───────────────▼──────────────┐
             │   💾 Data Plane (5 svc)     │
             │                              │
             │ • postgres                   │
             │ • mlflow_db                  │
             │ • monitoring_db              │
             │ • redis                      │
             │ • minio                      │
             └──────────────────────────────┘

NETWORKS:
  📍 edge network: Gateway-facing, public entry points
  📍 data network: Internal only, no direct browser access
```

### Request Flow Topology

```
Browser :3000/:8090
    │
    ├─→ frontend-svc (Next.js 14)
    │
    └─→ api-gateway (FastAPI)
        │
        ├─→ JWT verify, inject X-User-Id / X-User-Role / X-Api-Key
        │
        ├─→ /api/auth/*      → auth-svc
        ├─→ /api/predict/*   → inference-svc → moe-inference-svc
        ├─→ /api/train/*     → moe-training-svc
        ├─→ /api/drift/*     → moe-monitoring-svc
        └─→ /api/report/*    → report-svc
```

### Data Pipeline

```
Raw 5G + 6G Flow Data
  ↓
Unified Feature Projection (16 features)
  ↓
Global StandardScaler (normalize)
  ↓
┌─────────────────────────────────────────────────────┐
│         Mixture-of-Experts Ensemble                 │
├─────────────────────────────────────────────────────┤
│  Experts (specialized per dataset/protocol):        │
│  • XGBoost (eMBB)                                   │
│  • XGBoost (mMTC)                                   │
│  • XGBoost (URLLC)                                  │
│  • Autoencoder (TCP)                                │
│  • Autoencoder (UDP)                                │
├─────────────────────────────────────────────────────┤
│  Platt Calibration (probability alignment)         │
│  ↓                                                   │
│  Gate Network (MLP + Softmax)                       │
│  ↓                                                   │
│  Weighted Sum (gated mixture aggregation)           │
│  ↓                                                   │
│  Sigmoid Activation (bound to [0, 1])               │
└─────────────────────────────────────────────────────┘
  ↓
Output: Binary Classification Score (attack probability)
```

---

## 🛠️ Tech Stack

### Core ML & Data

| Component | Technology |
|-----------|-----------|
| **ML Framework** | scikit-learn, XGBoost, Keras/TensorFlow |
| **Data Processing** | Pandas, NumPy |
| **Anomaly Detection** | Isolation Forest, Autoencoders |
| **Feature Engineering** | Scikit-learn preprocessing |

### Backend & Microservices

| Component | Technology |
|-----------|-----------|
| **API Gateway** | FastAPI, Uvicorn |
| **ML Services** | FastAPI, joblib, pickle |
| **Auth & Security** | PyJWT, jose, bcrypt |
| **Async Jobs** | Celery, Redis |
| **PDF Generation** | reportlab |

### Frontend

| Component | Technology |
|-----------|-----------|
| **Framework** | React 18, Next.js 14, TypeScript |
| **Build Tool** | npm, Webpack (Next.js) |
| **Testing** | Vitest (26 unit tests) |
| **Styling** | Hand-rolled components (no external UI lib) |
| **i18n** | Custom EN/FR translation |

### Data & Persistence

| Component | Technology |
|-----------|-----------|
| **Primary DB** | PostgreSQL 16 |
| **Experiment Tracking** | MLflow 2.x + PostgreSQL backend |
| **Monitoring DB** | PostgreSQL 15 |
| **Cache & Broker** | Redis 7 |
| **Object Storage** | MinIO (S3-compatible) |

### MLOps & Observability

| Component | Technology |
|-----------|-----------|
| **Model Versioning** | MLflow (experiment tracking + registry) |
| **Metrics Collection** | Prometheus |
| **Visualization** | Grafana |
| **Container Metrics** | cAdvisor |
| **Host Metrics** | node-exporter |
| **Model Metrics Push** | Pushgateway |

### CI/CD & DevOps

| Component | Technology |
|-----------|-----------|
| **Container Runtime** | Docker, Docker Compose |
| **Orchestration** | Docker Compose (development & demo) |
| **CI/CD Platform** | GitHub Actions |
| **Code Quality** | Black, ruff, pytest |
| **Security Scanning** | Trivy, Bandit, pip-audit |
| **Container Scanning** | Trivy image scanning |

---

## 📁 Project Structure

```
project-root/
│
├── 📁 frontend/                          # React Next.js 14 dashboard
│   ├── src/
│   │   ├── components/
│   │   │   └── ui.tsx                    # Hand-rolled UI components
│   │   ├── pages/                        # 10 role-gated pages
│   │   │   ├── dashboard.tsx
│   │   │   ├── upload.tsx
│   │   │   ├── predict-history.tsx
│   │   │   ├── realtime.tsx
│   │   │   ├── drift.tsx
│   │   │   ├── model-registry.tsx
│   │   │   ├── users.tsx
│   │   │   ├── settings.tsx
│   │   │   └── account.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                    # API client with JWT retry
│   │   │   ├── auth.ts                   # JWT token management
│   │   │   └── i18n.ts                   # EN/FR translation
│   │   └── styles/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   └── Dockerfile
│
├── 📁 backend/                           # FastAPI microservices
│   ├── 📁 api_gateway/
│   │   ├── main.py                       # FastAPI router + JWT validation
│   │   ├── middleware.py                 # CORS, headers
│   │   └── Dockerfile
│   │
│   ├── 📁 auth_svc/
│   │   ├── main.py                       # JWT issuing, user CRUD
│   │   ├── models.py                     # User, AuditLog schemas
│   │   ├── db.py                         # PostgreSQL connection
│   │   └── Dockerfile
│   │
│   ├── 📁 upload_svc/
│   │   ├── main.py                       # Presigned MinIO uploads
│   │   ├── celery_tasks.py               # Async CSV processing
│   │   └── Dockerfile
│   │
│   ├── 📁 inference_svc/
│   │   ├── main.py                       # Business proxy layer
│   │   ├── models.py                     # Prediction history schema
│   │   └── Dockerfile
│   │
│   ├── 📁 report_svc/
│   │   ├── main.py                       # PDF generation (reportlab)
│   │   └── Dockerfile
│   │
│   ├── 📁 moe_inference_svc/
│   │   ├── main.py                       # Hot inference path
│   │   ├── predictor.py                  # MoE singleton + hot-reload
│   │   ├── db.py                         # Monitoring DB logging
│   │   ├── metrics.py                    # Prometheus counters
│   │   ├── auth.py                       # API key verification
│   │   └── Dockerfile
│   │
│   ├── 📁 moe_training_svc/
│   │   ├── main.py                       # Training orchestrator
│   │   ├── train.py                      # Training script
│   │   ├── scripts/
│   │   │   └── train_moe.py              # MoE training logic
│   │   └── Dockerfile
│   │
│   ├── 📁 moe_monitoring_svc/
│   │   ├── main.py                       # Drift detection service
│   │   ├── detect_drift.py               # PSI + KS tests
│   │   ├── slack_notifier.py             # Slack alerting
│   │   └── Dockerfile
│   │
│   ├── 📁 celery_worker/
│   │   ├── worker.py                     # Celery task runner
│   │   └── Dockerfile
│   │
│   ├── 📁 shared/
│   │   ├── preprocessing.py              # Data cleaning, encoding
│   │   ├── feature_engineering.py        # Log transforms, correlations
│   │   ├── models.py                     # Pydantic schemas
│   │   ├── config.py                     # Environment variables
│   │   └── logger.py                     # Structured logging
│   │
│   ├── requirements.txt                  # Python dependencies
│   └── Dockerfile.base                   # Multi-stage base image
│
├── 📁 data/                              # Datasets (not in repo)
│   ├── Global_clean.csv
│   ├── eMBB_clean.csv
│   ├── mMTC_clean.csv
│   └── URLLC_clean.csv
│
├── 📁 notebooks/                         # Jupyter notebooks
│   ├── data_cleaning.ipynb
│   ├── eda.ipynb
│   ├── modeling.ipynb
│   └── anomaly_detection.ipynb
│
├── 📁 scripts/
│   ├── init_env.py                       # Setup environment & secrets
│   ├── train_moe.py                      # Training entrypoint
│   ├── detect_drift.py                   # Drift detection script
│   └── smoke_test.sh                     # Post-deployment validation
│
├── 📁 models/                            # Trained artifacts
│   ├── artefacts/
│   │   ├── production/
│   │   │   ├── xgboost_embb.pkl
│   │   │   ├── xgboost_mmtc.pkl
│   │   │   ├── xgboost_urllc.pkl
│   │   │   ├── ae_tcp.pkl
│   │   │   ├── ae_udp.pkl
│   │   │   ├── gate_network.pkl
│   │   │   ├── scaler.pkl
│   │   │   ├── calibration_weights.pkl
│   │   │   └── baseline_stats.json
│   │   └── dev/
│   └── mlflow/ (experiment tracking)
│
├── 📁 config/
│   ├── prometheus.yml                    # Scrape config
│   ├── grafana-provisioning/
│   │   ├── datasources.yml
│   │   └── dashboards/
│   │       └── moe_ids_dashboard.json
│   └── nginx/
│       └── nginx.conf                    # Reverse proxy (optional)
│
├── 📁 .github/workflows/
│   ├── ci.yml                            # 5 CI jobs
│   ├── cd.yml                            # 5 CD jobs
│   └── security.yml                      # Trivy scanning
│
├── docker-compose.yml                    # 21 services orchestration
├── docker-compose.override.yml           # Dev overrides
├── .env.example                          # Environment template
├── .dockerignore
├── .gitignore
├── Makefile                              # Common commands
├── README.md                             # This file
├── TESTING_&_SETUP_GUIDE.md              # Detailed testing doc
├── ARCHITECTURE.md                       # Deep-dive architecture
├── SECURITY.md                           # Security hardening guide
└── LICENSE                               # MIT or Apache 2.0
```

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose (v2.20+)
- Python 3.11+ (for local development)
- Git
- 8GB RAM, 10GB disk space

### 1. Clone & Setup (3 minutes)

```bash
# Clone repository
git clone https://github.com/your-org/ids-6g-platform.git
cd ids-6g-platform

# Copy environment template and auto-generate secrets
cp .env.example .env
python scripts/init_env.py

# Verify .env was created
cat .env  # Should contain generated JWT_SECRET_KEY, DB passwords, etc.
```

### 2. Boot Stack (10 minutes first time)

```bash
# Build and start all 21 services
docker compose up --build -d

# Wait for services to stabilize (~2 min)
sleep 120

# Verify all services are running
docker compose ps  # All 21 services should show "Up"
```

### 3. Quick Test (2 minutes)

```bash
# Run the smoke test suite
bash scripts/smoke_test.sh

# Expected output:
# ✅ Microservices health check: PASS
# ✅ Prometheus scrape: PASS
# ✅ Frontend KPI cards: PASS
# ✅ MLflow integration: PASS
# ✅ Drift detection: PASS
# ... (13 total checks)
```

### 4. Access the System

| Service | URL | Credentials |
|---------|-----|-----------|
| **Dashboard** | http://localhost:3000 | admin@esprit.tn / Admin123! |
| **MLflow** | http://localhost:5000 | — (no auth) |
| **Grafana** | http://localhost:3001 | admin / admin |
| **API Docs** | http://localhost:8090/docs | — (Swagger UI) |
| **MinIO Console** | http://localhost:9001 | minioadmin / minioadmin |

### 5. Make Your First Prediction

```bash
# Download sample CSV (schema: 5G traffic features)
# Or use provided sample: data/sample_input.csv

# Via Dashboard:
# 1. Go to http://localhost:3000
# 2. Login with admin@esprit.tn / Admin123!
# 3. Click "Upload & Predict"
# 4. Drag-drop sample_input.csv
# 5. View results with attack probabilities

# Via API:
curl -X POST http://localhost:8090/api/predict/batch \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d @sample_input.json
```

---

## 📖 Detailed Setup

### Environment Configuration

Edit `.env` to customize:

```bash
# Database
POSTGRES_USER=ids_user
POSTGRES_PASSWORD=<auto-generated>
POSTGRES_DB=ids_platform

# ML Model Config
MODEL_THRESHOLD=0.60                # Decision threshold for attack classification
DRIFT_PSI_THRESHOLD=0.05            # Population Stability Index threshold
DRIFT_CHECK_INTERVAL_HOURS=24       # Drift detection frequency

# Training
TRAINING_EPOCHS=10
BATCH_SIZE=32
VALIDATION_SPLIT=0.1

# JWT & Auth
JWT_ALGORITHM=HS256
JWT_EXPIRY_MINUTES=60
JWT_REFRESH_EXPIRY_DAYS=7

# Slack Alerting (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#alerts

# MinIO S3
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<auto-generated>
MINIO_BUCKET_UPLOADS=uploads
MINIO_BUCKET_EXPORTS=exports
```

### Manual Startup (without Docker)

For local development:

```bash
# 1. Start PostgreSQL (requires local DB or Docker container)
docker run -d \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine

# 2. Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# 3. Start MLflow
mlflow server --backend-store-uri postgresql://... --default-artifact-root s3://...

# 4. Install Python dependencies
pip install -r backend/requirements.txt --break-system-packages

# 5. Start each service in separate terminal
cd backend/moe_inference_svc && python -m uvicorn main:app --host 0.0.0.0 --port 8000
cd backend/moe_training_svc && python -m uvicorn main:app --host 0.0.0.0 --port 8010
# ... (repeat for other services)

# 6. Start frontend
cd frontend && npm install && npm run dev
```

### Dataset Download

The 5G/6G datasets are too large for GitHub. Download them:

```bash
# Access the dataset folder
# 👉 https://drive.google.com/drive/folders/1QHhjL0muKQa_dtk52HXc6WW7MTUyG1nR?usp=sharing

# Extract to data/ directory:
# data/Global_clean.csv
# data/eMBB_clean.csv
# data/mMTC_clean.csv
# data/URLLC_clean.csv
```

---

## 💡 Usage

### Via Web Dashboard

1. **Login**: http://localhost:3000
2. **Upload CSV**: Drag-drop 5G/6G network traffic file
3. **View Results**: See predictions with attack probabilities per row
4. **Export Report**: Generate PDF with verdicts and metadata
5. **Monitor Training**: Trigger retraining and watch KPI cards auto-update

### Via API

#### Authentication

```bash
# Login
curl -X POST http://localhost:8090/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@esprit.tn","password":"Admin123!"}'

# Response:
# {"access_token":"eyJhbGci...","refresh_token":"...","expires_in":3600}

# Store token
TOKEN="eyJhbGci..."
```

#### Predictions

```bash
# Batch predict
curl -X POST http://localhost:8090/api/predict/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "flows": [
      {"packets": 100, "bytes": 5000, "latency": 10, ...},
      ...
    ]
  }'

# Real-time predict
curl -X POST http://localhost:8090/api/predict/realtime \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"flow": {...}}'

# View history
curl http://localhost:8090/api/predict/history \
  -H "Authorization: Bearer $TOKEN"
```

#### Training & Monitoring

```bash
# Trigger training
curl -X POST http://localhost:8090/api/train/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"epochs": 10}'

# Check training status
curl http://localhost:8090/api/train/status \
  -H "Authorization: Bearer $TOKEN"

# View drift detection result
curl http://localhost:8090/api/drift/last \
  -H "Authorization: Bearer $TOKEN"

# Manual drift check
curl -X POST http://localhost:8090/api/drift \
  -H "Authorization: Bearer $TOKEN"
```

#### Model Management

```bash
# Get current model metrics
curl http://localhost:8090/model/metrics \
  -H "Authorization: Bearer $TOKEN"

# Hot-reload (update model without restart)
curl -X POST http://localhost:8090/admin/reload \
  -H "Authorization: Bearer $TOKEN"
```

### Via Command Line

```bash
# Train a new model
python backend/scripts/train_moe.py \
  --data-path data/ \
  --epochs 10 \
  --experiment-name unified_moe_dev

# Detect drift
python backend/scripts/detect_drift.py \
  --monitoring-db postgresql://... \
  --baseline-stats models/baseline_stats.json

# Batch prediction
python -c "
import pandas as pd
from backend.shared.models import load_predictor
df = pd.read_csv('sample.csv')
predictor = load_predictor('models/artefacts/production/')
preds = predictor.predict_batch(df)
print(preds)
"
```

---

## 📊 Performance Metrics

### Model Performance (MOE Ensemble)

| Metric | Value | Notes |
|--------|-------|-------|
| **Accuracy** | ~93% | Balanced across all experts |
| **F1-Score** | ~92% | Equal precision-recall trade-off |
| **ROC-AUC** | ~97% | Excellent attack/benign separation |
| **PR-AUC** | ~95% | High confidence on positive predictions |
| **Recall (Attacks)** | ~99% | Catches 99%+ of true attacks |
| **Precision** | ~87% | ~13% false positive rate |

### System Performance & Benchmarks

| Metric | Value | Details |
|--------|-------|---------|
| **P95 Inference Latency** | <200ms | Per batch of 100 rows |
| **Throughput** | 500+/min | Predictions per minute |
| **Training Cycle** | 3–5 min | Full 5G + 6G, 10 epochs |
| **Drift Check Time** | <30s | PSI on 7-day window |
| **Artifact Size** | ~100 MB | Per production version (5 experts + gate) |
| **Memory (inference)** | ~800 MB | Loaded MoE singleton |
| **Memory (training)** | ~3 GB | Peak during epoch loop |

### 5G Supervised Modeling (XGBoost Baseline)

| Model | Accuracy | Recall | F1-Score | PR-AUC |
|-------|----------|--------|----------|--------|
| **XGBoost ⭐** | 99.59% | 99.93% | 99.60% | 99.99% |
| Random Forest | 99.48% | 99.80% | 99.49% | 99.99% |
| Logistic Regression | 92.25% | 97.97% | 92.83% | 97.52% |

---

## 🔐 Security

### API Security

- ✅ **JWT Authentication**: HS256 tokens with refresh mechanism
- ✅ **Role-Based Access Control (RBAC)**: admin, analyst, viewer roles
- ✅ **Internal API Key**: X-Api-Key for inter-microservice auth
- ✅ **Admin-Only Endpoints**: `/train/start`, `/drift/run` restricted
- ✅ **CORS Headers**: Validated origin enforcement

### Code Quality & Scanning

- ✅ **Linting**: ruff for Python code quality
- ✅ **Formatting**: black for consistent code style
- ✅ **Security**: bandit for vulnerability detection
- ✅ **Dependency Scanning**: pip-audit for known CVEs
- ✅ **Filesystem Scanning**: Trivy FS scan in CI
- ✅ **Image Scanning**: Trivy image scan in CD (SARIF report)

### Secrets Management

- ✅ **Auto-Generated Keys**: 64-char random strings via `scripts/init_env.py`
- ✅ **.env Template**: `.env.example` with all required vars (no secrets hardcoded)
- ✅ **Environment Variables**: All secrets via ENV, never in code
- ✅ **Password Hashing**: bcrypt for user passwords (cost factor 12)

### Network Security

- ✅ **Dual-Network Architecture**:
  - **edge network**: Gateway + frontend + public services
  - **data network**: Databases + internal only (no browser access)
- ✅ **Port Exposure**: Only :3000 (frontend) & :8090 (API) public
- ✅ **Service-to-Service**: Internal X-Api-Key on data network

### Monitoring & Alerting

- ✅ **Drift Alerts**: Slack integration for PSI anomalies
- ✅ **Error Logging**: Structured logs with request IDs
- ✅ **Audit Trail**: PostgreSQL audit_log table for all auth events
- ✅ **Prometheus Metrics**: Security metrics (auth failures, rate limits)

---

## ✅ Testing & Validation

### Automated Tests

```bash
# Run unit tests
cd backend && pytest tests/ -v --cov=.

# Run frontend tests
cd frontend && npm run test

# Run integration tests (with docker-compose running)
bash scripts/smoke_test.sh
```

### End-to-End Validation Suite (13 parts)

The smoke_test.sh script verifies:

1. ✅ **Microservices Health**: All 3 ML + gateway on correct ports
2. ✅ **Prometheus Scrape**: 6 jobs UP, node/cadvisor metrics present
3. ✅ **Gateway Routing**: Auth → token → /train/status, /drift, /predict work
4. ✅ **Frontend KPI**: 4 cards (accuracy/F1/AUC/run-id) render live MLflow values
5. ✅ **Pushgateway**: 5 model gauges published post-training
6. ✅ **Grafana**: 4 rows × 2–3 panels (inference/machine/container/model quality)
7. ✅ **MLflow Logging**: Metrics visible → reflected on front within 30s
8. ✅ **Drift + Slack**: PSI triggers, posts to channel
9. ✅ **Database Connectivity**: PostgreSQL + MLflow DB + Monitoring DB healthy
10. ✅ **File Storage**: MinIO buckets accessible
11. ✅ **API Documentation**: Swagger UI at :8090/docs
12. ✅ **Prediction Accuracy**: Known test set achieves >99% F1
13. ✅ **Model Reload**: Hot-reload updates weights without downtime

### CI/CD Results

| Stage | Duration | Jobs | Status |
|-------|----------|------|--------|
| **CI** | ~8 min | 5 | ✅ Pass |
| **CD** | ~40 min | 5 | ✅ Pass |

**CI Jobs**:
- quality (lint+format+security)
- model (MLflow experiment)
- trivy-fs (filesystem scan)
- frontend (build)
- notify (Slack)

**CD Jobs**:
- build-and-push (9 Docker images to DockerHub)
- train-and-log (full training run → MLflow)
- deploy-smoke-test (boot stack → verify all endpoints)
- security-scan (Trivy all images → SARIF)
- notify (Slack with status)

---

## 🚢 Deployment

### Docker Compose (Development & Demo)

```bash
# Full stack deployment
docker compose up -d

# Logs
docker compose logs -f moe-inference-svc

# Shutdown
docker compose down
```

### Kubernetes (Production-Ready)

Helm charts are scaffolded in `/deploy/helm/`:

```bash
# Install Helm chart
helm install ids-platform ./deploy/helm/ids-platform \
  --namespace ids-system \
  --create-namespace \
  -f deploy/helm/values-prod.yaml

# Upgrade
helm upgrade ids-platform ./deploy/helm/ids-platform

# Uninstall
helm uninstall ids-platform -n ids-system
```

### Cloud Deployment

**AWS ECS/EKS**:
```bash
# Push images to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker tag ids-frontend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/ids-frontend:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/ids-frontend:latest
```

**GCP Cloud Run**:
```bash
# Deploy frontend
gcloud run deploy ids-frontend \
  --image gcr.io/my-project/ids-frontend:latest \
  --platform managed \
  --region us-central1
```

---

## 📈 Monitoring & Observability

### Prometheus Metrics

Access http://localhost:9090

Scrape jobs (every 15s):
- **inference** (moe-inference-svc:8000/metrics)
- **training** (moe-training-svc:8010/metrics)
- **monitoring** (moe-monitoring-svc:8011/metrics)
- **node** (node-exporter:9100)
- **cadvisor** (cadvisor:8088)
- **pushgateway** (pushgateway:9091)

Sample queries:

```promql
# Inference latency (p95)
histogram_quantile(0.95, rate(inference_latency_seconds_bucket[5m]))

# Model accuracy
model_accuracy{environment="production"}

# Error rate
rate(api_errors_total[5m])

# Container memory usage
container_memory_usage_bytes{container_label_io_kubernetes_pod_name=~"moe.*"}
```

### Grafana Dashboards

Access http://localhost:3001 (admin/admin)

Auto-provisioned dashboard: **MoE IDS Platform** with 4 rows:

1. **Inference Row**: P95 latency, throughput, errors
2. **Machine Row**: CPU, memory, disk I/O
3. **Containers Row**: Per-service metrics (moe-*, ids-*)
4. **Model Quality Row**: Accuracy, F1, AUC, PR-AUC trends

### MLflow Experiment Tracking

Access http://localhost:5000

- **Experiment**: `unified_moe` (dev) vs `unified_moe_cd` (CD pipeline)
- **Logged Metrics**: accuracy, F1, AUC, PR-AUC per expert
- **Artifacts**: Scalers, expert models, gate weights, calibration, timestamp
- **Auto-Promotion**: F1 ≥ 0.90 → 'Production' stage

---

## 👥 Team

**Project Lead**: RESINET (Team Name)

**Team Members**:
- Mohamed Seifeddine Ouarag
- Nawres Bensethom
- Hadil Fatnassi
- Mohamed Khaled Benhmida
- Maram Kaouach
- Amine Trabelsi

**Supervisors**:
- Bouraoui Rahma
- Cherif Safa
- Mejri Ameni

---

## 🎓 Academic Context

**Institution**: Esprit School of Engineering, Tunisia  
**Program**: PIDEV – 4th Year Engineering Program  
**Academic Year**: 2025–2026  
**Course**: Advanced Machine Learning & MLOps  

This project demonstrates production-grade ML systems engineering, covering:
- Advanced anomaly detection techniques (supervised + unsupervised)
- Mixture-of-Experts ensemble architecture
- Real-world data preprocessing at scale
- CI/CD automation & infrastructure-as-code
- Microservices design & deployment
- Security hardening & compliance
- Observability & monitoring best practices

---

## 🔮 Future Work

### Short Term (Next Sprint)

- [ ] Deep Learning models (LSTM, GRU, Transformers) for temporal patterns
- [ ] Real-time streaming integration (Kafka, Apache Flink)
- [ ] Advanced explainability (SHAP, LIME) for predictions
- [ ] Multi-model ensemble voting mechanism
- [ ] Advanced data augmentation for imbalanced classes

### Medium Term (Next Quarter)

- [ ] Kubernetes orchestration with Helm
- [ ] Federated learning for distributed edge devices
- [ ] Model compression & quantization (ONNX)
- [ ] A/B testing framework for model variants
- [ ] Advanced synthetic data generation (GAN-based)

### Long Term (Strategic)

- [ ] Real IoT device integration & live data pipelines
- [ ] Graph neural networks for network topology analysis
- [ ] Zero-shot learning for unknown attack patterns
- [ ] Adversarial robustness testing
- [ ] Compliance reporting (GDPR, HIPAA)
- [ ] Multi-tenant SaaS architecture

---

## 📝 License

This project is licensed under the **MIT License** – see [LICENSE](LICENSE) for details.

**For academic use**: Please cite this work as:

```bibtex
@inproceedings{resinet2026,
  title={AI-Driven Attack Defense for IoT Smart Cities in 6G Networks},
  author={Ouarag, MS and Bensethom, N and Fatnassi, H and others},
  booktitle={Esprit Engineering Program},
  year={2026}
}
```

---

## 📚 Additional Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Deep-dive into system design
- **[TESTING_&_SETUP_GUIDE.md](TESTING_&_SETUP_GUIDE.md)**: Comprehensive testing procedures
- **[SECURITY.md](SECURITY.md)**: Security hardening checklist
- **[API_REFERENCE.md](API_REFERENCE.md)**: Complete API endpoint documentation
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**: Common issues & solutions

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Before submitting**:
- Run `black`, `ruff`, `pytest` locally
- Ensure all tests pass
- Update documentation
- Follow commit message conventions

---

## ❓ Support & Questions

- **Issues**: [GitHub Issues](https://github.com/your-org/ids-6g-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/ids-6g-platform/discussions)
- **Email**: contact@ids-platform.org
- **Slack**: [Join our workspace](https://ids-platform.slack.com)

---

## 🎉 Acknowledgments

- Esprit School of Engineering for academic supervision
- Open-source community (scikit-learn, FastAPI, React, Docker)
- Contributors and maintainers

