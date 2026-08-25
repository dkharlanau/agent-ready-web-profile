#!/usr/bin/env node

import { createServer } from 'node:http';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createArwpHttpGateway } from './http.mjs';

const bindHost = process.env.ARWP_HTTP_BIND || '127.0.0.1';
const port = Number(process.env.PORT || process.env.ARWP_HTTP_PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid HTTP port: ${port}`);
}

const gateway = await createArwpHttpGateway();
const nodeHandler = toNodeHandler(gateway);

const server = createServer((req, res) => {
  void nodeHandler(req, res);
});

server.listen(port, bindHost, () => {
  console.error(`ARWP MCP Streamable HTTP gateway listening on http://${bindHost}:${port}${process.env.ARWP_HTTP_PATH || '/mcp'}`);
});

async function shutdown(signal) {
  console.error(`ARWP MCP gateway received ${signal}; shutting down.`);
  await gateway.close();
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void shutdown(signal)
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error);
        process.exit(1);
      });
  });
}
