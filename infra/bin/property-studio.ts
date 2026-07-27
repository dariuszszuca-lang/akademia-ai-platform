#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { readInfrastructureConfigFromEnv } from '../config'

const config = readInfrastructureConfigFromEnv()
const app = new App()

app.node.setContext('propertyStudioConfig', config)
app.synth()
