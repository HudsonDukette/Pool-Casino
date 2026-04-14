import serverless from "serverless-http";
import app from "../../artifacts/api-server/src/app";

let cachedHandler: ReturnType<typeof serverless> | null = null;
let invocationCount = 0;

function getHandler() {
  if (!cachedHandler) {
    cachedHandler = serverless(app);
  }
  return cachedHandler;
}

function toApiPath(pathname: string): string {
  const functionPrefix = "/.netlify/functions/api";
  if (!pathname.startsWith(functionPrefix)) return pathname;

  const rest = pathname.slice(functionPrefix.length);
  if (!rest || rest === "/") return "/api";
  return rest.startsWith("/api/") || rest === "/api" ? rest : `/api${rest}`;
}

export const handler = async (event: any, context: any) => {
  const originalPath = event.path || "/";
  const mappedPath = toApiPath(originalPath);
  event.path = mappedPath;

  invocationCount += 1;
  console.info("[netlify-api] invocation", {
    invocationCount,
    requestId: context?.awsRequestId ?? context?.requestId ?? null,
    method: event.httpMethod,
    originalPath,
    mappedPath,
  });

  return getHandler()(event, context);
};
