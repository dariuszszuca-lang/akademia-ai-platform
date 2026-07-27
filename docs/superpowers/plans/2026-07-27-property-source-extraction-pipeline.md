# Property Source Extraction Pipeline — Implementation Plan

> **Execution contract:** continue in `feat/property-sources-core`, use TDD,
> keep all AWS work local through CDK synthesis until the cloud gate is
> explicitly opened. Before any AWS account read, diff or deploy, re-read every
> cloud-safety file listed in `AGENTS.md`. Production remains a separate
> approval.

**Goal:** Turn a clean GuardDuty scan result into one idempotent, observable
processing job that validates the object, extracts evidence with Amazon
Bedrock or Transcribe, and sends only evidence-backed proposals to Studio
through a replay-safe callback.

**Architecture:** GuardDuty publishes an at-least-once EventBridge event. A
small starter Lambda validates the selected bucket/prefix and starts a Standard
Step Functions execution with a deterministic name. The workflow calls
separate validation, preparation, transcription, evidence and callback
workers. Workers obtain minimal trusted context from Studio and return results
over HMAC-authenticated endpoints. PostgreSQL remains the authority for source,
job, proposal and human-decision state.

**Verified platform facts on 2026-07-27:**

- GuardDuty uses at-least-once scan-result delivery and publishes
  `GuardDuty Malware Protection Object Scan Result`;
- clean status is `NO_THREATS_FOUND`; every other status is non-clean;
- Bedrock Converse accepts documents from S3, up to 4.5 MB per document and
  five documents per message;
- structured outputs work with Claude Haiku 4.5 through Converse, but Anthropic
  citations and structured outputs cannot be enabled in the same call;
- `eu.anthropic.claude-haiku-4-5-20251001-v1:0` is the EU geo inference ID
  available from `eu-central-1`;
- Transcribe batch supports MP3, MP4/M4A, WAV and WebM, and Polish `pl-PL`;
- Lambda Node.js 24 is supported through April 2028.

**Pinned dependencies:**

- `@aws-sdk/client-bedrock-runtime` 3.1095.0;
- `@aws-sdk/client-sfn` 3.1095.0;
- `@aws-sdk/client-transcribe` 3.1095.0;
- `@aws-sdk/client-secrets-manager` 3.1095.0;
- `esbuild` 0.28.1.

## Invariants

1. Only `NO_THREATS_FOUND` can enter extraction.
2. Duplicate GuardDuty events cannot create duplicate active work.
3. A callback secret never appears in a template, output, log, URL or error.
4. Callback authentication covers timestamp, nonce and the exact raw body.
5. A nonce is stored only as SHA-256 and claimed atomically once.
6. A callback can update only its matching source/job/checksum.
7. Worker output can create proposals only; it cannot create a confirmed fact.
8. Document text, evidence text and prompts never enter CloudWatch logs.
9. Model IDs, retry counts, timeouts and maximum output tokens are bounded
   configuration, never supplied by an uploaded document.
10. Every role is scoped to its exact bucket prefixes, key, model/profile,
    state machine, secret or log group.

## Slice A: Signed Studio callback control plane

### Task 1: HMAC contract and runtime configuration

Create:

- `src/features/property-sources/callback-auth.ts`;
- `src/features/property-sources/callback-auth.test.ts`;
- `src/features/property-sources/callback-config.ts`;
- `src/features/property-sources/callback-config.test.ts`.

Test first:

- exact signature over `timestamp + "\n" + nonce + "\n" + sha256(body)`;
- timing-safe comparison;
- maximum age 300 seconds and maximum future skew 30 seconds;
- nonce syntax and required headers;
- secret minimum 32 characters;
- failures return stable codes without body, signature or secret;
- static AWS credential variables are never read.

### Task 2: Atomic nonces and job lifecycle

Modify the domain/schema/repositories and generate an additive migration:

- add `waiting_external` and `needs_manual_review` job states;
- add `pipelineVersion`, `provider`, `providerCostMicrounits`,
  `currency`, `errorMessage`;
- add atomic `claimCallbackNonce(jobId, nonceHash, expiresAt)`;
- add transactional job-status updates with an explicit transition matrix;
- store only `sha256(nonce)`, never the raw nonce;
- reject a second claim with `CALLBACK_REPLAYED`.

PGlite tests must prove concurrency safety and rollback.

### Task 3: Internal context and result services

Create:

- `src/features/property-sources/callback-service.ts`;
- `src/features/property-sources/callback-service.test.ts`.

Context command:

1. validate source ID, idempotency key, attempt and pipeline version;
2. create/reuse the job;
3. claim the signed nonce;
4. return only source checksum, bytes, MIME, storage key, property type,
   transaction type and trusted field catalog.

Result command:

1. claim a new nonce;
2. lock and match job/source/checksum;
3. validate metrics and provider/model;
4. validate all proposals against evidence and the trusted catalog;
5. ingest proposals idempotently;
6. set source to `review_ready` and job to `succeeded`, or a safe failure
   state;
7. never call `createFact` or write `confirmed`.

### Task 4: Internal callback HTTP endpoints

Create:

- `POST /api/internal/property-sources/context`;
- `POST /api/internal/property-sources/result`;
- handler and route tests.

The handler must read raw bytes once, authenticate before JSON parsing and map
invalid signature, stale timestamp and replay to generic 401/409 responses. It
must never include provider errors, ARNs, document content or signatures.

## Slice B: Pure extraction contracts

### Task 5: Scan event and deterministic execution identity

Create pure modules under `src/features/property-sources/pipeline/`:

- GuardDuty event Zod schema;
- exact selected-bucket and `originals/` validation;
- source ID extraction from the opaque key;
- deterministic execution name from bucket, key, version and scan result;
- clean/non-clean routing;
- fixtures for every GuardDuty result status and duplicate delivery.

### Task 6: Object validation and media routing

Create pure validation for:

- exact byte count and base64 SHA-256 checksum;
- clean GuardDuty tag;
- magic bytes versus trusted MIME;
- PDF encryption/page limit;
- document/image/audio product limits;
- neutral Bedrock document name;
- safe product error mapping.

No uploaded name or document content may influence instructions.

### Task 7: Evidence and proposal schemas

Implement two independent passes:

1. citation-enabled evidence map from the original document;
2. structured-output proposal generation from evidence only.

Validate that:

- each proposal references an evidence ID returned by pass one;
- citations map to page, character, sheet/cell or audio time;
- unknown fields and extra properties are rejected;
- prompt-injection text remains quoted evidence;
- zero evidence produces zero proposals;
- structured output is retried at most once before
  `needs_manual_review`.

The primary model comes from bounded deployment configuration. The documented
pilot default is the EU Claude Haiku 4.5 inference profile; there is no silent
global-region fallback.

## Slice C: AWS orchestration

### Task 8: CDK pipeline foundation

Extend CDK assertion tests before implementation. Provision:

- SQS DLQ;
- EventBridge rule for the exact GuardDuty detail type, selected bucket and
  `originals/` prefix;
- starter Lambda with only `states:StartExecution` for one state machine;
- Standard Step Functions workflow with bounded retry/backoff/catch;
- dedicated Lambda log groups with 3-day dev and 14-day prod retention;
- Standard Workflow execution history plus metrics and alarms. Native Step
  Functions CloudWatch logging stays off because AWS requires
  `Resource: "*"`, which the workspace cloud policy forbids;
- generated Secrets Manager callback secret or imported exact ARN;
- CloudWatch alarms and dashboard;
- outputs for state machine ARN, callback secret ARN and pipeline version.

No deploy-time lookup and no unrestricted IAM statement.

### Task 9: Bundle isolated workers

Use `NodejsFunction` on Node.js 24 and bundle exact SDK versions.

Workers:

- starter;
- validator/preparer;
- Transcribe starter/status reader;
- Bedrock evidence mapper;
- Bedrock proposal builder;
- signed callback sender.

Each handler has unit tests with injected SDK clients. Logs contain only
technical IDs, duration, counts and safe error codes.

### Task 10: Preparation paths

- direct S3 document blocks only when each part is at most 4.5 MB;
- PDFs split into ordered parts, at most 20 pages per model request and 100
  pages total;
- DOCX paragraphs/tables extracted without executing embedded objects;
- XLSX/CSV values read without executing formulas or macros;
- images normalized below 3.75 MB and 8000 px;
- audio sent to Transcribe `pl-PL`, with output in `transcripts/`;
- work and transcript keys remain under lifecycle-managed prefixes.

## Slice D: Local quality and cloud gate

### Task 11: Full local verification

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run infra:test
npm run infra:synth
```

Inspect the synthesized state machine, all IAM policies, log retention,
alarms, retries, secret references and event pattern. Scan tracked source and
templates for static credentials/private keys.

### Task 12: Dev deployment gate

Only after the local gate:

1. re-read all cloud/COSTSEC rules;
2. confirm clean git and rollback hash;
3. inventory account, region, OIDC, S3, KMS, GuardDuty, budgets, CDK and model
   access;
4. produce `cdk diff`;
5. present cost/change summary;
6. inform Darek;
7. deploy only `dev` with synthetic data;
8. run harmless synthetic smoke tests;
9. keep production blocked pending explicit confirmation.

## Acceptance for this pipeline

- duplicate clean scan events produce one logical processing job;
- non-clean results never call Bedrock or Transcribe;
- 100% persisted proposals contain evidence and locators;
- 0 AI callbacks can create `confirmed` facts;
- callback replay, stale requests and mismatched source/job/checksum fail;
- provider/model/tokens/cost/duration are recorded;
- no document content or secret appears in logs;
- all supported pilot formats have success and controlled-error fixtures;
- full local quality gate passes before AWS `dev`;
- AWS `dev` processes only `DEMO —` synthetic properties.

## Official references

- <https://docs.aws.amazon.com/guardduty/latest/ug/monitor-with-eventbridge-s3-malware-protection.html>
- <https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.html>
- <https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html>
- <https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html>
- <https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Message.html>
- <https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html>
- <https://docs.aws.amazon.com/transcribe/latest/dg/how-input.html>
- <https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html>
- <https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html>
