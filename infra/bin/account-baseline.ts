#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { AccountSecurityBaselineStack } from '../account-security-baseline-stack'

const EXPECTED_ACCOUNT = '261965598943'
const EXPECTED_REGION = 'eu-central-1'

const account = process.env.CDK_DEFAULT_ACCOUNT ?? EXPECTED_ACCOUNT
const region = process.env.CDK_DEFAULT_REGION ?? EXPECTED_REGION

if (account !== EXPECTED_ACCOUNT || region !== EXPECTED_REGION) {
  throw new Error(
    `Refusing AWS baseline target ${account}/${region}; expected ${EXPECTED_ACCOUNT}/${EXPECTED_REGION}`,
  )
}

const app = new App({ outdir: 'cdk.out' })

new AccountSecurityBaselineStack(app, 'AccountSecurityBaseline', {
  env: {
    account: EXPECTED_ACCOUNT,
    region: EXPECTED_REGION,
  },
  description:
    'Property Intelligence Studio AWS account security baseline',
  terminationProtection: true,
})

app.synth()
