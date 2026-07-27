# Property Source AWS Storage — Implementation Plan

> **Execution contract:** implement locally in the existing
> `feat/property-sources-core` worktree with TDD. CDK synthesis is local.
> Before any AWS account read, diff, bootstrap or deploy, re-read
> `.claude/rules/cloud_safety.md`,
> `.claude/rules/credential-protection.md` and the COSTSEC rules named in
> `AGENTS.md`. A production deployment requires a separate explicit
> confirmation.

**Goal:** Add a secure, direct browser-to-S3 upload path for property source
files without Vercel Blob or Vercel function body limits, using private
SSE-KMS storage, Vercel OIDC, exact short-lived upload grants and GuardDuty
Malware Protection for S3.

**Architecture:** The authenticated Next.js API creates the trusted source
record, derives an opaque `originals/...` key and asks an AWS object-store
adapter for a five-minute presigned POST. Vercel exchanges its OIDC token for
short-lived AWS credentials; there are no static AWS keys. CDK provisions one
private bucket and KMS key per environment, a narrowly trusted Vercel role, a
GuardDuty scanning role and a Malware Protection plan restricted to
`originals/`. Bucket policy denies reads until the managed scan tag is exactly
`NO_THREATS_FOUND`.

**Tech stack and verified package versions on 2026-07-27:**

- `aws-cdk-lib` 2.262.1;
- `aws-cdk` CLI 2.1133.0;
- `constructs` 10.7.1;
- `@aws-sdk/client-s3` 3.1095.0;
- `@aws-sdk/s3-presigned-post` 3.1095.0;
- `@aws-sdk/s3-request-presigner` 3.1095.0;
- `@vercel/oidc` 3.8.1;
- `@vercel/oidc-aws-credentials-provider` 3.3.1.

**Primary references:**

- <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_guardduty.CfnMalwareProtectionPlan.html>
- <https://docs.aws.amazon.com/guardduty/latest/ug/malware-protection-s3-iam-policy-prerequisite.html>
- <https://docs.aws.amazon.com/guardduty/latest/ug/tag-based-access-s3-malware-protection.html>
- <https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html>
- <https://vercel.com/docs/oidc/reference>

## Security invariants

1. No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` is added to code, Vercel
   variables, documentation or tests.
2. Region is exactly `eu-central-1`.
3. The bucket is private, owner-enforced, versioned, KMS encrypted and TLS-only.
4. Upload grant binds one object key, MIME, byte limit, SHA-256, source ID and
   KMS key. It expires after at most five minutes.
5. Vercel trust contains exact team, project and environment subjects. No
   wildcard subject is accepted.
6. The Vercel role cannot list the bucket, mutate GuardDuty tags, start AI
   workflows or access other AWS services.
7. GuardDuty scans only `originals/`, can use only the selected bucket/key and
   is the only principal allowed to write
   `GuardDutyMalwareScanStatus`.
8. No application principal can read an object unless the existing object tag
   is exactly `NO_THREATS_FOUND`.
9. Source storage keys do not contain original filenames, addresses or client
   data.
10. This slice does not process files. It only stores and protects them.

## Slice boundaries

Included:

- CDK app, configuration and assertion tests;
- KMS, S3, lifecycle, CORS and resource tags;
- Vercel team-issuer OIDC provider or imported provider;
- exact Vercel role trust and least-privilege S3/KMS policy;
- GuardDuty scanning role, Malware Protection plan and TBAC bucket policy;
- runtime AWS configuration validation;
- presigned POST adapter and safe clean-object download signer;
- source registration plus upload-grant orchestration;
- authenticated `POST /sources` and `GET /sources/:id/download`;
- migration/status support needed by upload failures;
- `.env.example` placeholders and operator/cost documentation;
- local tests, CDK assertions and synthesis.

Excluded:

- AWS deployment in this plan's default execution;
- EventBridge target, Step Functions, Bedrock and Transcribe;
- scan-result callback into the Studio database;
- browser upload component and review desk;
- synthetic file corpus and E2E browser upload.

---

## Task 1: Install pinned AWS/CDK dependencies and define safe config

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `infra/config.ts`
- Create: `infra/config.test.ts`
- Create: `infra/bin/property-studio.ts`
- Modify: `.gitignore` if CDK output is not already ignored

### Step 1: Write failing configuration tests

Test:

- only `dev` and `prod` environments;
- region must be `eu-central-1`;
- team and project names are non-empty slug-safe strings;
- production accepts only `production` as a Vercel environment;
- development accepts explicit `development` and/or `preview`;
- OIDC subjects are generated exactly as
  `owner:<team>:project:<project>:environment:<environment>`;
- optional existing OIDC provider ARN must be a valid IAM provider ARN;
- production config requires `billingAlertEmail`;
- no wildcard in team, project or subject values.

Expected API:

```ts
const config = parseInfrastructureConfig({
  studioEnv: 'dev',
  region: 'eu-central-1',
  account: '111122223333',
  vercelTeamSlug: 'ai-team',
  vercelProjectNames: ['akademia-ai-platform'],
  vercelEnvironments: ['development', 'preview'],
  billingAlertEmail: 'alerts@example.com',
})

expect(config.vercelSubjects).toEqual([
  'owner:ai-team:project:akademia-ai-platform:environment:development',
  'owner:ai-team:project:akademia-ai-platform:environment:preview',
])
```

### Step 2: Verify RED

```bash
npm test -- infra/config.test.ts
```

Expected: FAIL because `infra/config.ts` does not exist.

### Step 3: Install exact versions

```bash
npm install \
  @aws-sdk/client-s3@3.1095.0 \
  @aws-sdk/s3-presigned-post@3.1095.0 \
  @aws-sdk/s3-request-presigner@3.1095.0 \
  @vercel/oidc@3.8.1 \
  @vercel/oidc-aws-credentials-provider@3.3.1
npm install --save-dev \
  aws-cdk@2.1133.0 \
  aws-cdk-lib@2.262.1 \
  constructs@10.7.1
```

Do not run `npm audit fix`; dependency upgrades outside these pins need a
separate review.

Add scripts:

```json
{
  "infra:test": "vitest run infra",
  "infra:synth": "tsx infra/bin/property-studio.ts",
  "infra:cdk": "cdk --app 'npx tsx infra/bin/property-studio.ts'"
}
```

`infra:synth` must synthesize to `cdk.out` and perform no lookups or account
calls.

### Step 4: Implement config parsing

Use Zod. Export:

```ts
export type StudioEnvironment = 'dev' | 'prod'
export type InfrastructureConfig = {
  studioEnv: StudioEnvironment
  account: string
  region: 'eu-central-1'
  vercelTeamSlug: string
  vercelProjectNames: string[]
  vercelEnvironments: Array<'development' | 'preview' | 'production'>
  vercelSubjects: string[]
  oidcProviderArn?: string
  billingAlertEmail?: string
}

export function parseInfrastructureConfig(
  input: unknown,
): InfrastructureConfig
```

No default account ID, team or project. Missing values fail synthesis with a
clear field name, never with a secret value.

### Step 5: Run and commit

```bash
npm test -- infra/config.test.ts
npm run typecheck
git add package.json package-lock.json .gitignore infra
git commit -m "build: add aws infrastructure toolchain"
```

Expected: PASS.

---

## Task 2: Provision the private KMS/S3 storage foundation

**Files:**

- Create: `infra/property-source-storage-stack.ts`
- Create: `infra/property-source-storage-stack.test.ts`
- Modify: `infra/bin/property-studio.ts`

### Step 1: Write failing CDK assertion tests

Using `aws-cdk-lib/assertions`, assert:

- one customer-managed symmetric KMS key;
- key rotation enabled;
- no automatic key deletion;
- one S3 bucket with all Block Public Access settings true;
- bucket versioning enabled;
- bucket encryption uses the created KMS key;
- bucket ownership is `BucketOwnerEnforced`;
- bucket policy denies non-TLS requests;
- no public ACL/policy;
- lifecycle aborts incomplete multipart uploads after one day;
- `work/` and `transcripts/` expire after seven days;
- noncurrent versions expire after 90 days;
- CORS contains only POST for the upload path and the exact required headers;
- tags `Project=PropertyIntelligenceStudio`, `Env`, `Owner=AI-Team`,
  `CostCenter=PropertyStudio`.

### Step 2: Verify RED

```bash
npm test -- infra/property-source-storage-stack.test.ts
```

Expected: FAIL because the stack does not exist.

### Step 3: Implement storage resources

Use:

```ts
new kms.Key(this, 'PropertySourceKey', {
  enableKeyRotation: true,
  removalPolicy: RemovalPolicy.RETAIN,
  pendingWindow: Duration.days(30),
})

new s3.Bucket(this, 'PropertySourceBucket', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.KMS,
  encryptionKey,
  bucketKeyEnabled: true,
  enforceSSL: true,
  objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
  versioned: true,
  removalPolicy: RemovalPolicy.RETAIN,
  lifecycleRules: [...],
  cors: [...],
})
```

Do not set `autoDeleteObjects`. Do not hardcode a bucket name; let
CloudFormation create a globally unique physical name.

### Step 4: Run and commit

```bash
npm test -- infra/property-source-storage-stack.test.ts
npm run typecheck
git add infra
git commit -m "feat: define private property source storage"
```

---

## Task 3: Add GuardDuty Malware Protection and tag-based access

**Files:**

- Modify: `infra/property-source-storage-stack.ts`
- Modify: `infra/property-source-storage-stack.test.ts`

### Step 1: Write failing assertions

Assert:

- GuardDuty role trusts only
  `malware-protection-plan.guardduty.amazonaws.com`;
- EventBridge managed-rule actions are limited to the official
  `DO-NOT-DELETE-AmazonGuardDutyMalwareProtectionS3*` ARN and guarded by
  `events:ManagedBy`;
- S3 notification actions apply only to the selected bucket;
- validation object permission applies only to
  `malware-protection-resource-validation-object`;
- scan/tag/get permissions apply only to the selected bucket objects;
- KMS `GenerateDataKey` and `Decrypt` apply only to the selected key and
  `kms:ViaService=s3.eu-central-1.amazonaws.com`;
- `AWS::GuardDuty::MalwareProtectionPlan` protects only prefix `originals/`;
- tagging is enabled;
- bucket policy denies GetObject/GetObjectVersion unless existing scan tag is
  `NO_THREATS_FOUND`, except for the GuardDuty role;
- bucket policy denies mutation of the GuardDuty scan-status tag by other
  principals.

### Step 2: Verify RED

```bash
npm test -- infra/property-source-storage-stack.test.ts
```

Expected: the new assertions fail.

### Step 3: Implement the official GuardDuty policy

Create the role with exact actions from the AWS prerequisite policy. No
`Action: "*"`, no `Resource: "*"`.

Create:

```ts
new guardduty.CfnMalwareProtectionPlan(
  this,
  'PropertySourceMalwareProtection',
  {
    role: malwareRole.roleArn,
    protectedResource: {
      s3Bucket: {
        bucketName: bucket.bucketName,
        objectPrefixes: ['originals/'],
      },
    },
    actions: { tagging: { status: 'ENABLED' } },
  },
)
```

Add explicit dependency on the role policies and bucket policy so the plan
does not validate before permissions exist.

### Step 4: Run and commit

```bash
npm test -- infra/property-source-storage-stack.test.ts
npm run typecheck
git add infra
git commit -m "feat: protect property uploads with guardduty"
```

---

## Task 4: Add exact Vercel OIDC trust and signer permissions

**Files:**

- Modify: `infra/property-source-storage-stack.ts`
- Modify: `infra/property-source-storage-stack.test.ts`

### Step 1: Write failing assertions

Test both:

1. stack creates a team-scoped provider when no provider ARN is supplied;
2. stack imports an existing provider when the ARN is supplied and creates no
   duplicate provider.

For the role assert:

- trust action only `sts:AssumeRoleWithWebIdentity`;
- provider URL is `https://oidc.vercel.com/<team>`;
- client ID/audience is `sts.amazonaws.com`;
- `sub` is an exact array built from configured team/project/environment;
- no `StringLike` and no `*` in `sub`;
- base role permits only:
  - `s3:PutObject` under `originals/*`,
  - `s3:GetObject` and `s3:GetObjectTagging` under `originals/*`,
  - KMS `GenerateDataKey`, `Encrypt` and `Decrypt` on one key;
- the role cannot list bucket, tag objects, invoke Bedrock, Transcribe,
  EventBridge or Step Functions.

### Step 2: Verify RED

```bash
npm test -- infra/property-source-storage-stack.test.ts
```

### Step 3: Implement provider and role

Use the team issuer mode. Build condition keys from the issuer host/path:

```ts
const issuerConditionPrefix = `oidc.vercel.com/${teamSlug}`

{
  StringEquals: {
    [`${issuerConditionPrefix}:aud`]: 'sts.amazonaws.com',
    [`${issuerConditionPrefix}:sub`]: config.vercelSubjects,
  },
}
```

The current and future project names may coexist only when both exact names
are supplied in config during a controlled rename. Never use a wildcard.

Export stack outputs:

- bucket name;
- KMS key ARN;
- signer role ARN;
- region;
- malware protection plan ID.

Outputs contain identifiers, not secrets.

### Step 4: Run and commit

```bash
npm test -- infra/property-source-storage-stack.test.ts
npm run typecheck
git add infra
git commit -m "feat: add vercel oidc source signer role"
```

---

## Task 5: Add cost guardrails and local synthesis

**Files:**

- Modify: `infra/property-source-storage-stack.ts`
- Modify: `infra/property-source-storage-stack.test.ts`
- Create: `docs/operations/aws-property-source-storage.md`
- Create: `docs/operations/aws-property-source-cost-estimate.md`
- Modify: `.env.example`

### Step 1: Write failing assertions

For each stack:

- create an AWS Budget with the configured email;
- dev monthly threshold is USD 10;
- prod monthly threshold is USD 25;
- notifications fire at 50%, 80% and 100% actual spend;
- no budget can create resources or automatically spend;
- outputs have stable logical descriptions.

### Step 2: Implement cost guardrails

Use `AWS::Budgets::Budget`. The budget is an alert, not a spending cap.
Production config without an alert email must fail before synthesis.

Document a pilot scenario:

- 200 files/month;
- average 10 MB;
- roughly 2 GB new uploads/month;
- GuardDuty monthly free tier currently includes 1,000 requests and 1 GB;
- one KMS key costs USD 1/month before rotation surcharges;
- S3 request/storage and GuardDuty above-free-tier rates vary by region and
  must be checked in AWS Pricing Calculator immediately before deployment.

The document must separate official rates from assumptions and link the
official AWS pricing pages. It must not promise an exact bill.

### Step 3: Add non-secret runtime placeholders

`.env.example`:

```dotenv
AWS_REGION=eu-central-1
PROPERTY_SOURCE_BUCKET=
PROPERTY_SOURCE_KMS_KEY_ARN=
PROPERTY_SOURCE_SIGNER_ROLE_ARN=
```

Explicitly comment that static AWS access-key variables must not be added.

### Step 4: Run local synth

Use only placeholder identifiers and no AWS account calls:

```bash
STUDIO_ENV=dev \
CDK_DEFAULT_ACCOUNT=111122223333 \
CDK_DEFAULT_REGION=eu-central-1 \
VERCEL_TEAM_SLUG=example-team \
VERCEL_PROJECT_NAMES=akademia-ai-platform \
VERCEL_OIDC_ENVIRONMENTS=development,preview \
BILLING_ALERT_EMAIL=alerts@example.com \
npm run infra:synth
```

Inspect:

```bash
rg -n '"Resource": "\\*"|"Action": "\\*"|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY' cdk.out
```

Expected: no unrestricted resource/action and no static credential names in
the template.

### Step 5: Commit

```bash
git add infra docs/operations .env.example package.json
git commit -m "docs: add aws storage cost and operations guardrails"
```

---

## Task 6: Build the OIDC-backed S3 object-store adapter

**Files:**

- Create: `src/features/property-sources/object-store.ts`
- Create: `src/features/property-sources/object-store.test.ts`
- Create: `src/features/property-sources/aws-object-store.ts`
- Create: `src/features/property-sources/aws-object-store.test.ts`
- Create: `src/features/property-sources/aws-config.ts`
- Create: `src/features/property-sources/aws-config.test.ts`

### Step 1: Write failing configuration and policy tests

Test:

- missing runtime variable fails with the variable name only;
- region other than `eu-central-1` fails;
- role/key/bucket syntax is validated;
- no static access-key variable is read;
- exact upload session policy contains one object ARN and one KMS ARN;
- exact download policy contains one object ARN, one KMS ARN and no list
  permission;
- filename sanitization prevents CR/LF and quote injection in
  `Content-Disposition`.

### Step 2: Write failing adapter tests

Inject the external SDK functions at the network edge. Assert real adapter
behavior and captured AWS commands:

- object key starts with `originals/organizations/` and contains no filename;
- presigned POST expires in 300 seconds;
- conditions bind exact key, declared MIME, exact content length,
  base64 SHA-256, SSE-KMS key and source metadata;
- role session policy narrows the base role to the one object;
- a download tag other than `NO_THREATS_FOUND` returns
  `SOURCE_NOT_CLEAN`;
- clean download URL expires in 60 seconds;
- errors do not include bucket, role, KMS ARN or credentials.

### Step 3: Verify RED

```bash
npm test -- \
  src/features/property-sources/aws-config.test.ts \
  src/features/property-sources/object-store.test.ts \
  src/features/property-sources/aws-object-store.test.ts
```

Expected: FAIL because the modules do not exist.

### Step 4: Implement the abstraction

```ts
export type SourceUploadGrant = {
  method: 'POST'
  url: string
  fields: Record<string, string>
  expiresAt: string
}

export interface PropertySourceObjectStore {
  createUploadGrant(source: PropertySource): Promise<SourceUploadGrant>
  createCleanDownloadUrl(source: PropertySource): Promise<{
    url: string
    expiresAt: string
  }>
}
```

Use `awsCredentialsProvider` with:

- exact role ARN;
- `audience: 'sts.amazonaws.com'`;
- region in `clientConfig`;
- per-request inline session policy;
- non-sensitive role session name derived from source ID.

The S3 client must receive a credential provider, never resolved credentials.

### Step 5: Implement checksums and POST

Convert the trusted 64-character hex SHA-256 to base64. Presigned fields:

```ts
{
  'Content-Type': source.mediaType,
  'x-amz-checksum-sha256': checksumBase64,
  'x-amz-server-side-encryption': 'aws:kms',
  'x-amz-server-side-encryption-aws-kms-key-id': kmsKeyArn,
  'x-amz-meta-source-id': source.id,
}
```

Conditions include exact equality plus:

```ts
['content-length-range', source.sizeBytes, source.sizeBytes]
```

### Step 6: Run and commit

```bash
npm test -- \
  src/features/property-sources/aws-config.test.ts \
  src/features/property-sources/object-store.test.ts \
  src/features/property-sources/aws-object-store.test.ts
npm run typecheck
npm run lint
git add src/features/property-sources
git commit -m "feat: sign exact oidc backed source uploads"
```

---

## Task 7: Add upload orchestration and failure states

**Files:**

- Modify: `src/features/property-sources/domain.ts`
- Modify: `src/features/property-sources/domain.test.ts`
- Modify: `src/features/property-sources/schema.ts`
- Modify: `src/features/property-sources/schema.test.ts`
- Generate: next Drizzle migration
- Modify: `src/features/property-sources/repository.ts`
- Modify: `src/features/property-sources/memory-repository.ts`
- Modify: `src/features/property-sources/postgres-repository.ts`
- Modify: repository tests
- Create: `src/features/property-sources/upload-service.ts`
- Create: `src/features/property-sources/upload-service.test.ts`
- Modify: `src/features/property-sources/server-repository.ts`

### Step 1: Write failing state tests

Add:

- storage key is
  `originals/organizations/<org>/properties/<property>/sources/<source>/original`;
- source registration still ignores a client-provided key/status/organization;
- repository can transition only through allowed upload states;
- upload-grant success returns source plus grant;
- signer failure marks the source `failed` with safe code
  `upload_grant_failed`;
- stored error message is sanitized and contains no AWS identifiers;
- user cannot obtain a grant/download for another tenant;
- download requires source status `review_ready` or `completed`;
- no upload orchestration writes a confirmed fact.

Add missing domain statuses from the approved design:

- `validating`;
- `completed`.

Add source timestamps:

- `uploadedAt`;
- `processedAt`.

### Step 2: Verify RED

```bash
npm test -- \
  src/features/property-sources/domain.test.ts \
  src/features/property-sources/service.test.ts \
  src/features/property-sources/upload-service.test.ts \
  src/features/property-sources/postgres-repository.test.ts
```

### Step 3: Implement status transitions

Repository command:

```ts
updateSourceStatusInternal(
  sourceId: string,
  update: {
    status: PropertySourceStatus
    errorCode?: string | null
    errorMessage?: string | null
    uploadedAt?: Date | null
    processedAt?: Date | null
  },
): Promise<PropertySource | null>
```

Define an explicit transition matrix. Do not permit `deleted -> processing` or
`quarantined -> review_ready`.

### Step 4: Implement upload service

`PropertySourceUploadService.initiateUpload`:

1. calls tenant-safe `registerSource`;
2. calls object store for exact grant;
3. returns `{source, upload}`;
4. on signer failure writes safe failed status and rethrows
   `UPLOAD_GRANT_FAILED`.

`createDownloadUrl`:

1. authorizes property and source through `PropertySourceService`;
2. checks source application status;
3. delegates to clean-tag-enforcing object store.

### Step 5: Generate migration and run tests

```bash
DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/postgres' \
  npm run db:generate -- --name source_upload_lifecycle
npm test -- src/features/property-sources
```

Inspect migration for additive-only changes.

### Step 6: Commit

```bash
git add drizzle src/features/property-sources
git commit -m "feat: orchestrate protected property source uploads"
```

---

## Task 8: Expose authenticated upload and clean-download endpoints

**Files:**

- Modify: `src/features/property-sources/http.ts`
- Modify: `src/features/property-sources/http.test.ts`
- Modify: `src/features/property-sources/server-repository.ts`
- Modify: `src/app/api/properties/[propertyId]/sources/route.ts`
- Create:
  `src/app/api/properties/[propertyId]/sources/[sourceId]/download/route.ts`

### Step 1: Write failing HTTP tests

Cover:

- unauthenticated POST returns 401 before body parsing;
- valid POST returns 201 with source and exact POST grant;
- forged storage/org/status fields are ignored;
- invalid MIME/size/checksum returns 400;
- signer unavailable returns safe 503 `source_storage_unavailable`;
- no AWS ARN, bucket, policy or stack appears in errors;
- cross-tenant download returns 404;
- unscanned source returns 409 `source_not_clean`;
- clean source returns a 60-second URL;
- invalid source/property UUID returns 400.

### Step 2: Verify RED

```bash
npm test -- src/features/property-sources/http.test.ts
```

### Step 3: Extend handler dependencies

Keep route modules thin. Handler factory receives:

```ts
getUploadService: () => PropertySourceUploadService
```

Map:

- `UPLOAD_GRANT_FAILED` and missing AWS config -> 503;
- `SOURCE_NOT_CLEAN` -> 409;
- not found -> 404;
- Zod -> 400;
- unexpected -> generic 500.

### Step 4: Wire routes and verify build

```bash
npm test -- src/features/property-sources/http.test.ts
npm run typecheck
npm run lint
npm run build
```

Expected build routes:

- POST `/api/properties/[propertyId]/sources`;
- GET `/api/properties/[propertyId]/sources/[sourceId]/download`.

### Step 5: Commit

```bash
git add src/features/property-sources src/app/api/properties
git commit -m "feat: expose protected source upload api"
```

---

## Task 9: Verify local storage slice and prepare the cloud gate

### Step 1: Run full local quality gate

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run infra:test
```

Expected: all commands exit 0.

### Step 2: Synthesize with placeholder account only

```bash
STUDIO_ENV=dev \
CDK_DEFAULT_ACCOUNT=111122223333 \
CDK_DEFAULT_REGION=eu-central-1 \
VERCEL_TEAM_SLUG=example-team \
VERCEL_PROJECT_NAMES=akademia-ai-platform \
VERCEL_OIDC_ENVIRONMENTS=development,preview \
BILLING_ALERT_EMAIL=alerts@example.com \
npm run infra:synth
```

Expected: CloudFormation template is generated locally without account access.

### Step 3: Security scan

```bash
git diff --check
rg -n '"Action": "\\*"|"Resource": "\\*"|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY' \
  cdk.out src infra .env.example
rg -n 'AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|BEGIN (RSA|OPENSSH) PRIVATE KEY' .
```

Expected: no static credentials, unrestricted statements or private keys.
The literal forbidden variable names may appear only in a documentation
comment explaining that they are prohibited; if so, inspect manually.

### Step 4: Review generated IAM and resource policies

Manually confirm:

- exact OIDC subjects;
- no bucket listing for Vercel role;
- exact region;
- GuardDuty-only scan tag mutation;
- no read before clean tag;
- KMS resources are specific;
- RETAIN policies;
- budgets/tags/lifecycle.

### Step 5: Record cloud preflight, but do not execute it yet

Create an operator checklist in
`docs/operations/aws-property-source-storage.md`:

1. re-read cloud safety and credential protection rules;
2. read COSTSEC `CLOUD_SAFETY.md`, `ZASADY.md` and API inventory;
3. verify git clean and rollback hash;
4. `aws sts get-caller-identity` without printing credentials;
5. verify selected account and `eu-central-1`;
6. inventory existing OIDC providers, buckets, KMS aliases, GuardDuty plans,
   budgets and CDK bootstrap;
7. choose import versus create for OIDC provider;
8. run `cdk diff` and inspect changes/costs;
9. deploy only `dev` with synthetic data after informing Darek;
10. smoke test upload with a synthetic harmless file and an EICAR-safe
    procedure only if policy explicitly allows it;
11. production remains blocked pending explicit confirmation.

### Step 6: Commit verification documentation if changed

```bash
git add docs/operations
git commit -m "docs: add aws storage deployment runbook"
```

Do not create an empty commit. Do not push or deploy from this task.
