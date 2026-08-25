#!/usr/bin/env node

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { DEFAULT_PROFILE_SOURCE, prepareGatewayContext, createGatewayServer } from './factory.mjs';

const context = await prepareGatewayContext();
void serveStdio(() => createGatewayServer(context));
console.error(`ARWP MCP gateway running on stdio with profile ${DEFAULT_PROFILE_SOURCE}`);
