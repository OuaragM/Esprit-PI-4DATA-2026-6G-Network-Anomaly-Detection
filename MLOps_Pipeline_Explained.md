# MLOps Pipeline — How It Was Built (For a Friend)

This document walks through the full machine learning pipeline I built for my **Esprit 4th-year PI project**: an AI system that detects cyber-attacks in IoT smart city networks running on 5G/6G. I'll explain every step, why I made each decision, and how all the pieces connect.

---

## What the System Does

The system watches network traffic and decides: **is this normal traffic, or is it an attack?**

It handles two different types of data:
- **5G data** — labeled (we know which flows are attacks)
- **6G data** — unlabeled (no labels, so we have to detect anomalies without knowing what an attack looks like)

The end product is a live web dashboard where you can upload network traffic CSVs and get real-time attack predictions.

---

## Big Picture: The 5 Layers

```
Raw Data
    ↓
Data Preprocessing & Feature Engineering   (src/)
    ↓
Model Research & Prototyping               (notebooks/ + MoE/Moe.ipynb)
    ↓
Production ML Package                      (moe-ids/)
    ↓
Web Dashboard + Microservices              (dashboard/)
```

---

## Step 1 — Data Preprocessing (`src/preprocessing.py`)

**What it does:** Takes raw CSV files and turns them into clean, usable data.

**5G inputs:** 4 CSV files — `Global`, `eMBB`, `mMTC`, `URLLC`
- Each represents a different 5G network slice
- They all have slightly different column schemas, so I had to align them to one common schema before combining

**6G input:** `AIoT-Sol` dataset
- Unlabeled real-world IoT traffic
- Much messier — more missing values, more weird protocols

**Steps inside the preprocessor (9–10 steps per dataset):**
1. Load raw CSV
2. Drop fully empty columns and rows
3. Handle missing values (median imputation for numerics)
4. Fix infinite values (`inf` → max, `-inf` → min)
5. Encode categorical columns (protocol names → numeric)
6. Align column schemas across datasets (so eMBB, mMTC, URLLC match Global's columns)
7. Export cleaned CSV → `*_CLEANED.csv`

The cleaned CSVs (`Global_CLEANED.csv`, `AIoT_6G_CLEANED.csv`) are saved to `MoE/` and used as the starting point for everything downstream.

---

## Step 2 — Feature Engineering (`src/feature_engineering.py`)

**What it does:** Takes cleaned data and builds better features for the models.

**Key transformations:**
- **One-Hot Encoding (OHE)** for protocol column — turns `TCP`, `UDP` etc. into separate binary columns
- **Correlation filtering** — drops features that are nearly identical to another feature (r > 0.90), since duplicate info wastes model capacity. Some pairs are protected and never dropped, because they carry different semantic meaning even if correlated
- **Outlier capping (Winsorization)** — clips extreme values at the 1st/99th percentile instead of dropping rows
- **Log transforms / Box-Cox** — makes skewed distributions more normal-shaped, which helps tree models and especially autoencoders

**Why this matters:** The 6G data has a lot of features that look correlated but aren't really redundant (e.g., different IDS metrics that happen to move together). Naively dropping them would hurt the anomaly detector.

---

## Step 3 — Exploratory Research (Jupyter Notebooks)

Before writing production code, I used Jupyter notebooks to explore the data and test model ideas.

```
notebooks/notebooks5g/   ← 5G EDA, cleaning experiments, model benchmarks
notebooks/notebooks6g/   ← 6G EDA, autoencoder prototypes
MoE/Moe.ipynb            ← Where I prototyped the final Mixture-of-Experts architecture
```

The notebooks are where I figured out:
- Which features matter most
- What thresholds work for anomaly detection
- How to combine multiple expert models with a gating network

Once the prototype worked in a notebook, I ported the logic into the production Python package (`moe-ids/moe_ids/`).

---

## Step 4 — The ML Architecture: Mixture of Experts (MoE)

This is the core ML design. Instead of one big model, I built **5 specialist models** (called experts) and a **gating network** that decides how much to trust each expert.

### Why MoE instead of one model?
- 5G and 6G data are fundamentally different (one has labels, one doesn't)
- Within 5G, different network slices (eMBB, mMTC, URLLC) have very different traffic patterns
- One model can't specialize in all of these at once

### The 5 Experts

| Expert | Data | Model Type | Detects |
|--------|------|-----------|---------|
| eMBB Expert | 5G eMBB slice | XGBoost classifier | Known attacks |
| mMTC Expert | 5G mMTC slice | XGBoost classifier | Known attacks |
| URLLC Expert | 5G URLLC slice | XGBoost classifier | Known attacks |
| TCP Expert | 6G TCP flows | Keras Autoencoder | Anomalies |
| UDP Expert | 6G UDP flows | Keras Autoencoder | Anomalies |

**XGBoost experts** are supervised — they were trained on labeled data (benign vs. attack).

**Autoencoder experts** are unsupervised — trained only on normal traffic. An autoencoder learns to reconstruct normal data; when it sees an attack, reconstruction error is high → that's the anomaly signal.

**Important:** For the 6G autoencoders, synthetic anomalies (SYN floods, port scans, DDoS perturbations) are injected only at validation/test time — never during training. This prevents leakage.

### The Gate Network

The gate is a small neural network (MLP):
```
input features → Dense(32, relu) → Dense(16, relu) → Dense(5, softmax)
                                                              ↓
                                               5 weights (one per expert)
```

It learns which expert to trust based on the input features. Then a custom Keras layer (`WeightedCombiner`) computes:

```
final_score = sigmoid(4 × (Σ gate_weight[i] × expert_score[i] − 0.5))
```

This produces a single probability: **P(attack)**.

### Calibration

Raw neural network outputs aren't well-calibrated probabilities. So after training, I apply **Platt scaling** (a logistic regression fit on validation predictions) to map outputs to proper probabilities.

### Threshold Optimization

Instead of defaulting to 0.5, I search for the threshold that maximizes F1-score on the validation set. This is important because attacks are rare — a standard 0.5 cutoff often misses too many.

---

## Step 5 — The Production ML Package (`moe-ids/`)

This is where the notebook prototype became production code.

### Directory structure

```
moe-ids/
├── moe_ids/               ← Core ML logic (Python package)
│   ├── moe.py             ← MoEPredictor: orchestrates the full predict pipeline
│   ├── experts.py         ← XGBoost + Autoencoder model builders
│   ├── gate.py            ← Gate network + WeightedCombiner (custom Keras layer)
│   ├── projection.py      ← Feature transforms specific to 5G vs. 6G
│   ├── schemas.py         ← Auto-detect whether input is 5G or 6G format
│   ├── calibration.py     ← Platt scaling implementation
│   ├── injection.py       ← Synthetic anomaly injection for test/validation
│   ├── config.py          ← All hyperparameters via Pydantic settings
│   └── logging.py         ← Structured logging with structlog
├── services/              ← 3 FastAPI microservices
│   ├── inference/         ← Handles predictions (port 8000)
│   ├── training/          ← Triggers retraining (port 8010)
│   └── monitoring/        ← Drift detection + alerts (port 8011)
├── scripts/
│   ├── train.py           ← CLI: full training pipeline end-to-end
│   ├── evaluate.py        ← Post-training evaluation
│   ├── detect_drift.py    ← Standalone drift detection script
│   └── promote.py         ← Auto-promote model to Production in MLflow
├── mlops/
│   └── mlflow_client.py   ← MLflow context managers for run tracking
├── monitoring/
│   ├── prometheus.yml     ← Scrape config for 6 targets
│   └── grafana/           ← Auto-provisioned Grafana dashboard JSON
└── tests/
    ├── unit/              ← Per-module unit tests
    └── integration/       ← API + training pipeline tests
```

### How a prediction works (step by step)

1. **Schema detection** (`schemas.py`) — looks at the column names of the input CSV and figures out if it's 5G (Argus format) or 6G (AIoT format)
2. **Projection** (`projection.py`) — applies the right feature transforms for that data type
3. **Expert scoring** (`experts.py`) — each of the 5 experts scores the input; output is a (n_rows × 5) matrix
4. **Gating** (`gate.py`) — gate network produces 5 weights; `WeightedCombiner` blends the expert scores
5. **Calibration** (`calibration.py`) — maps the combined score to a proper probability
6. **Output** — JSON with `predicted_label`, `attack_probability`, `expert_contributions`

---

## Step 6 — Model Training Pipeline (`scripts/train.py`)

This script trains all models end-to-end and logs everything to MLflow.

### What it does

1. Load cleaned CSVs from `MoE/`
2. Split 5G data: 80% train / 20% test (stratified by label)
3. Split 6G data: 80% train / 20% test (no label — test set gets synthetic anomalies injected)
4. Train 3 XGBoost slice experts (one per 5G slice)
5. Train 2 Keras autoencoders (one for TCP, one for UDP, trained on normal traffic only)
6. Train the gate network on the validation expert scores
7. Calibrate with Platt scaling on the validation set
8. Evaluate on the test set: accuracy, precision, recall, F1, ROC-AUC, PR-AUC
9. Save all model artifacts to `artefacts/production/`
10. Log params + metrics to MLflow
11. Push model quality metrics to Prometheus Pushgateway

### Model artifacts saved

| File | What it is |
|------|-----------|
| `gate_model.h5` | Keras gate network |
| `embb_expert.pkl` | XGBoost for eMBB slice |
| `mmtc_expert.pkl` | XGBoost for mMTC slice |
| `urllc_expert.pkl` | XGBoost for URLLC slice |
| `tcp_autoencoder.h5` | Keras autoencoder for TCP |
| `udp_autoencoder.h5` | Keras autoencoder for UDP |
| `scalers.pkl` | StandardScaler objects |
| `calibrator.pkl` | Platt scaling object |
| `model_metadata.json` | Version, timestamp, hyperparams, metrics |

### Auto-promotion

`scripts/promote.py` checks the MLflow run metrics and automatically promotes a model from `Staging` to `Production` if:
- F1 ≥ 0.90
- Recall ≥ 0.95
- PR-AUC ≥ 0.92

---

## Step 7 — MLflow (Experiment Tracking)

MLflow tracks every training run.

- **Experiment:** `unified_moe`
- **What gets logged:** all hyperparameters, all metrics (per run), model artifacts
- **Model registry:** models are versioned and staged (None → Staging → Production)
- **UI:** accessible at `http://localhost:5001` when running locally

This means I can compare runs, roll back to a previous model version, and see exactly which hyperparameters produced which results.

---

## Step 8 — Drift Detection (`moe-monitoring-svc`)

Models degrade over time as real-world traffic patterns shift. The monitoring service detects this automatically.

**It runs two statistical tests on recent predictions vs. the training baseline:**

1. **Population Stability Index (PSI)** — compares the distribution of attack rates over a 7-day rolling window vs. the training period. PSI > 0.2 = drift.
2. **Kolmogorov-Smirnov (KS) test** — two-sample test on raw prediction probabilities. p-value < 0.05 = significant shift.

**Data source:** Every batch prediction is logged to a PostgreSQL database (`monitoring_db`). The drift detector reads from there.

**Alert:** If drift is detected, a Slack message is posted (if `SLACK_WEBHOOK_URL` is set in the environment).

---

## Step 9 — The Dashboard (`dashboard/`)

The user-facing part. A React web app backed by 5 FastAPI microservices.

### Services

| Service | Port | What it does |
|---------|------|-------------|
| Frontend (Next.js) | 3000 | The web UI |
| API Gateway (FastAPI) | 8090 | Single entry point, JWT validation, routes requests |
| Auth Service | 8001 | Login, JWT tokens, user management (PostgreSQL) |
| Upload Service | 8002 | Accepts CSV files, stores in MinIO (S3-like), async processing via Celery |
| Inference Service | 8003 | Per-user prediction history, proxies to moe-inference |
| Report Service | 8004 | Generates PDF reports with reportlab |

### Pages in the frontend

- **Dashboard** — overview stats
- **Upload** — drag-and-drop CSV upload, async batch scoring
- **Real-time** — live feed of recent predictions (sampled)
- **History** — past prediction records
- **Drift** — drift alert status and history
- **Model Registry** — MLflow model versions and stages
- **Users** (admin only) — user management

### Request flow example

```
Browser
  → api-gateway:8090        (checks JWT)
  → inference-svc:8003      (logs per-user history)
  → moe-inference-svc:8000  (runs MoEPredictor)
  → monitoring_db           (writes prediction log)
```

---

## Step 10 — Infrastructure & Observability

Everything runs in Docker. One `docker-compose.yml` spins up **21 containers** across two internal networks:

- **`edge` network** — services accessible through the browser (frontend, gateway, MLflow UI, Grafana)
- **`data` network** — internal only (databases, Redis, MinIO, message brokers)

### Observability stack

| Tool | Port | Purpose |
|------|------|---------|
| MLflow | 5001 | Experiment tracking, model registry |
| Prometheus | 9090 | Metrics scraper (6 targets, 15s interval) |
| Grafana | 3001 | Dashboards (4 rows: inference, machine, containers, model quality) |
| Pushgateway | 9091 | Receives model training metrics from scripts |
| Node Exporter | 9100 | Host-level CPU/memory/disk metrics |
| cAdvisor | 8088 | Per-container resource metrics |

The Grafana dashboard auto-provisions from a JSON file — no manual setup needed.

---

## Step 11 — CI/CD (GitHub Actions)

Two workflow files in `.github/workflows/`:

### `ci.yml` — runs on every push/PR

1. **Quality job** (~2 min)
   - Code formatting check (black + ruff)
   - Linting (ruff)
   - Security scan (bandit + pip-audit for known CVEs)
   - Unit tests with coverage → uploaded to Codecov

2. **Model smoke test** (~8 min)
   - Runs `scripts/train.py` on small fixture CSVs (10 rows each)
   - Verifies the full training pipeline runs without crashing
   - Saves artifacts as GitHub Actions artifacts

3. **Frontend job**
   - Next.js build
   - Vitest unit tests (26 tests for UI components)

### `cd.yml` — manual trigger (for releases)

Builds and pushes 9 Docker images to DockerHub in a matrix:
```
moe-inference, moe-training, moe-monitoring
dashboard-gateway, dashboard-auth, dashboard-inference,
dashboard-upload, dashboard-report, dashboard-frontend
```

Then optionally does a full smoke test by spinning up the whole stack on the runner.

---

## The Full Pipeline at a Glance

```
Raw CSVs (5G + 6G)
       ↓
   preprocessing.py + feature_engineering.py
       ↓
   CLEANED CSVs (MoE/ directory)
       ↓
   Jupyter Notebook Research (Moe.ipynb)
       ↓
   moe_ids/ package (moe.py, experts.py, gate.py, ...)
       ↓
   scripts/train.py → model artifacts (.pkl, .h5)
       ↓
   MLflow (logged params + metrics + model registry)
       ↓
   moe-inference-svc:8000 (serving predictions)
       ↓
   monitoring_db (prediction logs)
       ↓
   moe-monitoring-svc:8011 (drift detection → Slack alerts)
       ↓
   Prometheus + Grafana (dashboards + alerting)
       ↓
   dashboard (Next.js + FastAPI) for the user
       ↓
   GitHub Actions CI/CD (automated testing + deployment)
```

---

## Key Design Decisions (and Why)

| Decision | Why |
|----------|-----|
| Mixture of Experts instead of one model | 5G and 6G have fundamentally different data distributions; one model can't specialize in both |
| Autoencoders for 6G (unsupervised) | 6G data has no labels, so supervised methods aren't possible; autoencoders learn what "normal" looks like |
| Synthetic anomaly injection at test time only | Prevents the autoencoder from seeing attack patterns during training (no leakage) |
| F1-optimal threshold instead of 0.5 | Attacks are rare; a fixed 0.5 cutoff misses too many in imbalanced datasets |
| Platt scaling calibration | Raw neural network outputs aren't real probabilities; calibration makes them trustworthy |
| PSI + KS for drift detection | PSI catches distributional shifts in aggregate; KS catches shifts in the raw score distribution — they complement each other |
| Microservices (inference / training / monitoring) | Decouples the hot inference path from slow training jobs; each can scale independently |
| MLflow model registry with auto-promotion | Prevents a model from going to production unless it meets minimum quality thresholds |
