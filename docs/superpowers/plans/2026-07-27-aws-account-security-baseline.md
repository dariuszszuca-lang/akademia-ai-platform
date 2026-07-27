# AWS Account Security Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare AWS account `261965598943` for the first production Property Intelligence Studio deployment with an auditable security baseline and a verified CDK bootstrap.

**Architecture:** A dedicated CDK stack owns CloudTrail, AWS Config, retained encrypted buckets and a retained KMS key. A small tested command module applies account-level S3 Block Public Access because CloudFormation has no native resource for that account setting. The application stack remains separate and can only deploy after the baseline audit passes.

**Tech Stack:** TypeScript 5, AWS CDK v2, Vitest, AWS CLI v2, CloudFormation, AWS Config, CloudTrail, S3, KMS.

---

## File map

- Create `infra/account-public-access-block.ts`: guarded account-level S3
  configuration command with injected AWS CLI runner.
- Create `infra/account-public-access-block.test.ts`: account, region, write and
  postcondition tests.
- Create `infra/bin/enable-account-public-access-block.ts`: executable wrapper
  for profile `akademia-ai`.
- Create `infra/account-security-baseline-stack.ts`: retained CloudTrail and AWS
  Config resources.
- Create `infra/account-security-baseline-stack.test.ts`: synthesized-template
  security assertions.
- Create `infra/bin/account-baseline.ts`: CDK entry point independent of Vercel
  application variables.
- Modify `package.json`: baseline synth/CDK and account-public-block commands.
- Modify `docs/operations/aws-property-source-storage.md`: production order,
  verification and rollback.

### Task 1: Guard account-level S3 Block Public Access

**Files:**
- Create: `infra/account-public-access-block.test.ts`
- Create: `infra/account-public-access-block.ts`
- Create: `infra/bin/enable-account-public-access-block.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing guard tests**

Test a fake AWS CLI runner and assert:

```ts
it('stops before write when the caller account differs', () => {
  const cli = fakeCli({
    'sts get-caller-identity': JSON.stringify({ Account: '111122223333' }),
  })

  expect(() => enableAccountPublicAccessBlock(cli)).toThrow(
    'Refusing account 111122223333',
  )
  expect(cli.calls.some((call) => call.includes('put-public-access-block')))
    .toBe(false)
})

it('enables and verifies all four account-level blocks', () => {
  const cli = fakeCli({
    'sts get-caller-identity': JSON.stringify({ Account: '261965598943' }),
    's3control get-public-access-block': [
      noPublicBlockError,
      JSON.stringify({ PublicAccessBlockConfiguration: allTrue }),
    ],
  })

  expect(enableAccountPublicAccessBlock(cli)).toEqual(allTrue)
  expect(cli.calls).toContainEqual(expect.arrayContaining([
    's3control',
    'put-public-access-block',
    '--account-id',
    '261965598943',
  ]))
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run infra:test -- infra/account-public-access-block.test.ts
```

Expected: FAIL because `./account-public-access-block` does not exist.

- [ ] **Step 3: Implement the guarded command**

Expose constants for the exact account and region, an `AwsCliRunner` interface
and `enableAccountPublicAccessBlock`. The function must:

```ts
const EXPECTED_ACCOUNT = '261965598943'
const EXPECTED_REGION = 'eu-central-1'
const ALL_BLOCKED = {
  BlockPublicAcls: true,
  IgnorePublicAcls: true,
  BlockPublicPolicy: true,
  RestrictPublicBuckets: true,
} as const
```

It must call `sts get-caller-identity`, refuse a mismatch, read the old state,
call `s3control put-public-access-block` once with all four booleans, read the
new state and throw unless it exactly matches `ALL_BLOCKED`.

The executable wrapper uses `execFileSync('aws', args)` and prints only the
account, region and final boolean state. It must never print credentials.

- [ ] **Step 4: Add the package command**

Add:

```json
"infra:account-public-block": "tsx infra/bin/enable-account-public-access-block.ts"
```

- [ ] **Step 5: Run focused and full infrastructure tests**

Run:

```bash
npm run infra:test -- infra/account-public-access-block.test.ts
npm run infra:test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json infra/account-public-access-block.ts \
  infra/account-public-access-block.test.ts \
  infra/bin/enable-account-public-access-block.ts
git commit -m "feat: guard account public access baseline"
```

### Task 2: Add the account security baseline stack

**Files:**
- Create: `infra/account-security-baseline-stack.test.ts`
- Create: `infra/account-security-baseline-stack.ts`

- [ ] **Step 1: Write failing template tests**

Create `AccountSecurityBaselineStack` in a test app for account
`261965598943`, region `eu-central-1`. Assert:

```ts
template.resourceCountIs('AWS::KMS::Key', 1)
template.resourceCountIs('AWS::S3::Bucket', 2)
template.resourceCountIs('AWS::CloudTrail::Trail', 1)
template.resourceCountIs('AWS::Config::ConfigurationRecorder', 1)
template.resourceCountIs('AWS::Config::DeliveryChannel', 1)
template.resourceCountIs('AWS::Config::ConfigRule', 4)
```

Also assert retained KMS/buckets, rotation, KMS encryption, versioning,
BlockPublicAccess, TLS-only policies, lifecycle, a multi-region trail with
global events and log validation, continuous Config recording of supported and
global resources, and identifiers:

```ts
[
  'S3_BUCKET_PUBLIC_READ_PROHIBITED',
  'S3_BUCKET_PUBLIC_WRITE_PROHIBITED',
  'IAM_USER_MFA_ENABLED',
  'CLOUD_TRAIL_ENABLED',
]
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run infra:test -- infra/account-security-baseline-stack.test.ts
```

Expected: FAIL because `./account-security-baseline-stack` does not exist.

- [ ] **Step 3: Implement retained logging resources**

Create one rotating KMS key with `RemovalPolicy.RETAIN`, then:

```ts
new s3.Bucket(this, 'CloudTrailLogs', {
  bucketName: `cloudtrail-logs-${Stack.of(this).account}-${Stack.of(this).region}`,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.KMS,
  encryptionKey,
  bucketKeyEnabled: true,
  enforceSSL: true,
  objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
  versioned: true,
  removalPolicy: RemovalPolicy.RETAIN,
  lifecycleRules: [
    { abortIncompleteMultipartUploadAfter: Duration.days(1) },
    { noncurrentVersionExpiration: Duration.days(90) },
  ],
})
```

Create an equivalent retained AWS Config bucket with name
`aws-config-logs-<account>-<region>`.

- [ ] **Step 4: Implement CloudTrail**

Create `management-trail`:

```ts
new cloudtrail.Trail(this, 'ManagementTrail', {
  trailName: 'management-trail',
  bucket: cloudTrailBucket,
  encryptionKey,
  enableFileValidation: true,
  includeGlobalServiceEvents: true,
  isMultiRegionTrail: true,
  managementEvents: cloudtrail.ReadWriteType.ALL,
  sendToCloudWatchLogs: false,
})
```

- [ ] **Step 5: Implement AWS Config**

Create `AWS::IAM::ServiceLinkedRole` for `config.amazonaws.com`, use the
service-linked role ARN in `CfnConfigurationRecorder`, grant the Config service
principal only bucket ACL/list and exact-prefix put permissions, and configure
`CfnDeliveryChannel` with the Config bucket and KMS key. Add four
`CfnConfigRule` resources with the exact identifiers from Step 1 and dependency
on the recorder and delivery channel.

- [ ] **Step 6: Tag and verify GREEN**

Apply `Project=PropertyIntelligenceStudio`, `Env=prod`, `Owner=AI-Team`,
`CostCenter=PropertyStudio`, then run:

```bash
npm run infra:test -- infra/account-security-baseline-stack.test.ts
npm run infra:test
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add infra/account-security-baseline-stack.ts \
  infra/account-security-baseline-stack.test.ts
git commit -m "feat: add aws account security baseline stack"
```

### Task 3: Add independent baseline entry points and runbook

**Files:**
- Create: `infra/bin/account-baseline.ts`
- Modify: `package.json`
- Modify: `docs/operations/aws-property-source-storage.md`

- [ ] **Step 1: Add an exact-account CDK entry point**

The entry point must refuse any target other than the expected account and
region before constructing:

```ts
new AccountSecurityBaselineStack(app, 'AccountSecurityBaseline', {
  env: {
    account: '261965598943',
    region: 'eu-central-1',
  },
  terminationProtection: true,
})
```

- [ ] **Step 2: Add baseline commands**

Add:

```json
"infra:baseline:synth": "tsx infra/bin/account-baseline.ts",
"infra:baseline:cdk": "cdk --app 'npx tsx infra/bin/account-baseline.ts'"
```

- [ ] **Step 3: Document production order and rollback**

Document the exact order:

```bash
AWS_PROFILE=akademia-ai npm run infra:account-public-block
npx cdk bootstrap aws://261965598943/eu-central-1 \
  --profile akademia-ai --termination-protection \
  --tags Project=PropertyIntelligenceStudio \
  --tags Env=prod --tags Owner=AI-Team --tags CostCenter=PropertyStudio
npm run infra:baseline:cdk -- diff AccountSecurityBaseline \
  --profile akademia-ai
npm run infra:baseline:cdk -- deploy AccountSecurityBaseline \
  --profile akademia-ai --require-approval never
```

State that `RETAIN` resources and account public block are not removed by
application rollback.

- [ ] **Step 4: Verify locally**

Run:

```bash
npm run infra:baseline:synth
npm run infra:test
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit 0 and `cdk.out` remains ignored.

- [ ] **Step 5: Commit**

```bash
git add package.json infra/bin/account-baseline.ts \
  docs/operations/aws-property-source-storage.md
git commit -m "docs: add aws baseline deployment runbook"
```

### Task 4: Deploy and verify the account baseline

**Files:**
- Modify after verification:
  `PROJEKTY/AUTOFIRMA/COSTSEC/docs/SYSTEMY.md`
- Modify after verification:
  `PROJEKTY/AUTOFIRMA/COSTSEC/docs/CHANGELOG.md`

- [ ] **Step 1: Run production preflight**

Re-read all cloud safety files, confirm clean git state and record:

```bash
git rev-parse HEAD
aws sts get-caller-identity --profile akademia-ai --region eu-central-1
aws iam get-account-summary --profile akademia-ai --region eu-central-1
```

Expected account: `261965598943`; expected user:
`akademia-wojtka-admin-darek`; root MFA `1`; root keys `0`.

- [ ] **Step 2: Apply account public block**

Run:

```bash
AWS_PROFILE=akademia-ai npm run infra:account-public-block
```

Expected: all four booleans are `true`.

- [ ] **Step 3: Bootstrap CDK**

Run the exact bootstrap command from Task 3. Expected stack:
`CDKToolkit` in `CREATE_COMPLETE` with termination protection enabled.

- [ ] **Step 4: Review baseline diff**

Run baseline `cdk diff`. Confirm only:

- one retained KMS key;
- two retained private S3 buckets;
- one multi-region CloudTrail;
- one AWS Config recorder and delivery channel;
- four managed rules;
- Config service-linked role and scoped bucket policies.

Stop if the diff creates public resources, unbounded IAM policies or resources
outside `261965598943/eu-central-1`.

- [ ] **Step 5: Deploy baseline**

Run the exact baseline deploy command from Task 3.

- [ ] **Step 6: Verify live state**

Run read-only checks:

```bash
aws s3control get-public-access-block --account-id 261965598943 \
  --profile akademia-ai --region eu-central-1
aws cloudtrail get-trail-status --name management-trail \
  --profile akademia-ai --region eu-central-1
aws configservice describe-configuration-recorder-status \
  --profile akademia-ai --region eu-central-1
aws configservice describe-config-rules \
  --profile akademia-ai --region eu-central-1
```

Expected: four public blocks `true`, `IsLogging=true`, Config
`recording=true`, and four required rules.

- [ ] **Step 7: Update COSTSEC records**

Record the baseline stack name, retained resources, verified state, current
commit and rollback behavior without secret values.

### Task 5: Diff and deploy Property Source production infrastructure

**Files:**
- No source changes unless `cdk diff` reveals a policy or compatibility defect.
- Modify after deployment:
  `PROJEKTY/AUTOFIRMA/COSTSEC/docs/SYSTEMY.md`
- Modify after deployment:
  `PROJEKTY/AUTOFIRMA/COSTSEC/docs/CHANGELOG.md`

- [ ] **Step 1: Run complete release gates**

```bash
npm test
npm run infra:test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Create the production CDK diff**

Use only non-secret identifiers:

```bash
STUDIO_ENV=prod \
CDK_DEFAULT_ACCOUNT=261965598943 \
CDK_DEFAULT_REGION=eu-central-1 \
VERCEL_TEAM_SLUG=dariuszs-projects-5bb999c0 \
VERCEL_PROJECT_NAMES=akademia-ai-platform \
VERCEL_OIDC_ENVIRONMENTS=production \
STUDIO_CALLBACK_BASE_URL=https://akademia-ai-platform.vercel.app \
PROPERTY_SOURCE_PIPELINE_VERSION=property-source-v1 \
PROPERTY_SOURCE_BEDROCK_MODEL_ID=eu.anthropic.claude-sonnet-4-6 \
BILLING_ALERT_EMAIL=dariusz.szuca@gmail.com \
npm run infra:cdk -- diff PropertySourceStorage-prod \
  --profile akademia-ai
```

Review S3, KMS, GuardDuty, OIDC subject, five Lambdas, Step Functions, DLQ,
Secrets Manager, alarms and the tag-filtered 25 USD budget.

- [ ] **Step 3: Deploy the application stack**

Repeat the environment above with:

```bash
npm run infra:cdk -- deploy PropertySourceStorage-prod \
  --profile akademia-ai --require-approval never \
  --outputs-file /tmp/property-source-prod-outputs.json
```

The output file contains identifiers only and must be removed after Vercel
configuration.

- [ ] **Step 4: Configure Vercel without exposing secrets**

Pipe the CloudFormation identifiers into encrypted production variables:

- `AWS_REGION`;
- `PROPERTY_SOURCE_BUCKET`;
- `PROPERTY_SOURCE_KMS_KEY_ARN`;
- `PROPERTY_SOURCE_SIGNER_ROLE_ARN`.

Fetch the callback secret from Secrets Manager and pipe it directly to
`vercel env add PROPERTY_SOURCE_CALLBACK_SECRET production --sensitive`.
Never print or store the value. Remove the temporary output file.

- [ ] **Step 5: Publish application code**

Confirm `main` is clean and push the reviewed commits to `origin/main`. Wait
for the linked Vercel production deployment to reach `READY`.

- [ ] **Step 6: Run production smoke tests**

Verify:

- `/start` returns HTTP 200 or the expected login redirect;
- unauthenticated Property Source APIs reject access;
- a harmless synthetic PDF reaches the private bucket with KMS metadata;
- read access is denied before a clean GuardDuty result;
- a clean result starts exactly one Step Functions execution;
- callback creates evidence/proposals for the synthetic source;
- no Lambda, Step Functions or DLQ alarms are active;
- the object is not public and the temporary download URL expires.

- [ ] **Step 7: Update records and report**

Record deployment IDs, stack outputs by name, smoke-test results, Vercel
deployment URL, commit hash and rollback commit. Do not record secret values.
