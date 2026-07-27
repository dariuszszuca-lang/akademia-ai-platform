#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { readInfrastructureConfigFromEnv } from '../config'
import { PropertySourceStorageStack } from '../property-source-storage-stack'

const config = readInfrastructureConfigFromEnv()
const app = new App({ outdir: 'cdk.out' })

new PropertySourceStorageStack(
  app,
  `PropertySourceStorage-${config.studioEnv}`,
  {
    env: { account: config.account, region: config.region },
    config,
    description: `Property Intelligence Studio protected source storage (${config.studioEnv})`,
  },
)

app.synth()
