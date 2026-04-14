import serverless from "serverless-http";
import app from "../../artifacts/api-server/src/app";

let cachedHandler: ReturnType<typeof serverless> | null = null;

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
  event.path = toApiPath(event.path || "/");
  return getHandler()(event, context);
};
