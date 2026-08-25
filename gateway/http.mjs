import {
  createMcpHandler,
  hostHeaderValidationResponse,
  originValidationResponse
} from '@modelcontextprotocol/server';
import { prepareGatewayContext, createGatewayServer } from './factory.mjs';

function splitList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function validateHostnames(hosts) {
  for (const host of hosts) {
    if (host.includes('://') || host.includes('/') || host.includes(' ')) {
      throw new Error(`Invalid allowed hostname: ${host}. Use hostnames such as mcp.example.com, without scheme or path.`);
    }
  }
  return hosts;
}

function validateOriginHostnames(origins) {
  for (const origin of origins) {
    if (origin.includes('://') || origin.includes('/') || origin.includes(' ')) {
      throw new Error(`Invalid allowed Origin hostname: ${origin}. MCP SDK origin validation expects hostnames, without scheme or path.`);
    }
  }
  return origins;
}

export async function createArwpHttpGateway({
  profileSource,
  allowedHosts = splitList(process.env.ARWP_HTTP_ALLOWED_HOSTS),
  allowedOrigins = splitList(process.env.ARWP_HTTP_ALLOWED_ORIGINS),
  endpointPath = process.env.ARWP_HTTP_PATH || '/mcp',
  responseMode = process.env.ARWP_HTTP_RESPONSE_MODE || undefined,
  ...contextOptions
} = {}) {
  const hosts = validateHostnames(allowedHosts);
  const origins = validateOriginHostnames(allowedOrigins);

  if (!hosts.length) {
    throw new Error('Remote MCP startup refused: set ARWP_HTTP_ALLOWED_HOSTS to the public MCP hostname.');
  }
  if (!endpointPath.startsWith('/') || endpointPath.includes('?') || endpointPath.includes('#')) {
    throw new Error(`ARWP_HTTP_PATH must be an absolute pathname such as /mcp: ${endpointPath}`);
  }
  if (responseMode && !['json', 'sse'].includes(responseMode)) {
    throw new Error('ARWP_HTTP_RESPONSE_MODE must be json, sse, or unset.');
  }

  const context = await prepareGatewayContext({
    profileSource,
    ...contextOptions
  });

  const handler = createMcpHandler(
    () => createGatewayServer(context),
    responseMode ? { responseMode } : undefined
  );

  return {
    ...handler,
    async fetch(request, options) {
      const url = new URL(request.url);
      if (url.pathname !== endpointPath) {
        return new Response('Not Found', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8' }
        });
      }

      const rejected =
        hostHeaderValidationResponse(request, hosts)
        ?? originValidationResponse(request, origins);

      if (rejected) return rejected;
      return handler.fetch(request, options);
    }
  };
}
