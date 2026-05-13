# ─────────────────────────────────────────────────────────────────────────────
# Verado — local CI mirror
#
# Run the exact checks that GitHub Actions runs, before pushing.
#   make ci          → full CI (python + frontend)
#   make ci-python   → moe-ids lint/security/tests
#   make ci-frontend → dashboard/frontend lint + production build
#   make ci-quick    → linters only (fast pre-commit gate)
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: ci ci-python ci-frontend ci-quick \
        py-install py-format-check py-lint py-security py-test \
        front-install front-lint front-build front-test \
        docker-build-local clean

ci: ci-python ci-frontend
	@echo ""
	@echo "  ✓ Local CI passed. Safe to push."

ci-quick: py-lint front-lint
	@echo "  ✓ Quick lint passed."

# ── Python (moe-ids) ────────────────────────────────────────────────────────
ci-python: py-format-check py-lint py-security py-test

py-install:
	cd moe-ids && pip install -e ".[dev,api,mlflow]"

py-format-check:
	$(MAKE) -C moe-ids format-check

py-lint:
	$(MAKE) -C moe-ids lint

py-security:
	$(MAKE) -C moe-ids security

py-test:
	cd moe-ids && pytest tests/unit -v --cov=moe_ids --cov-report=term

# ── Frontend (dashboard/frontend) ───────────────────────────────────────────
ci-frontend: front-install front-lint front-test front-build

front-install:
	cd dashboard/frontend && npm install --no-audit --prefer-offline

front-lint:
	cd dashboard/frontend && npm run lint

front-test:
	cd dashboard/frontend && npm test

front-build:
	cd dashboard/frontend && NEXT_PUBLIC_API_URL=http://localhost:8090 npm run build

# ── Docker (local arm64 build sanity check) ─────────────────────────────────
# Requires buildx + QEMU set up locally. Builds all 8 backend images for arm64
# without pushing — catches arm-specific issues before the CD workflow does.
docker-build-local:
	docker buildx create --use --name verado-builder 2>/dev/null || docker buildx use verado-builder
	@for svc in \
	    "moe-inference:moe-ids:services/inference/Dockerfile" \
	    "moe-training:moe-ids:services/training/Dockerfile" \
	    "moe-monitoring:moe-ids:services/monitoring/Dockerfile" \
	    "dashboard-gateway:dashboard/gateway:Dockerfile" \
	    "dashboard-auth:dashboard/auth:Dockerfile" \
	    "dashboard-inference:dashboard/inference:Dockerfile" \
	    "dashboard-upload:dashboard/upload:Dockerfile" \
	    "dashboard-report:dashboard/report:Dockerfile"; do \
	  name=$$(echo $$svc | cut -d: -f1); \
	  ctx=$$(echo $$svc | cut -d: -f2); \
	  dfile=$$(echo $$svc | cut -d: -f3); \
	  echo "→ build $$name (linux/arm64)"; \
	  docker buildx build --platform linux/arm64 --load -t local/$$name:dev -f $$ctx/$$dfile $$ctx || exit 1; \
	done
	@echo "  ✓ All 8 backend images build for linux/arm64"

clean:
	rm -rf dashboard/frontend/.next dashboard/frontend/node_modules
	rm -rf moe-ids/.pytest_cache moe-ids/.ruff_cache moe-ids/coverage.xml
