export type RequestIdentity = {
  ownerId: string;
  email: string;
  name: string;
};

export function getRequestIdentity(request: Request): RequestIdentity | null {
  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) return null;

  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get(
    "oai-authenticated-user-full-name-encoding",
  );
  let name = email;
  if (encodedName) {
    try {
      name = encoding === "percent-encoded-utf-8"
        ? decodeURIComponent(encodedName)
        : encodedName;
    } catch {
      name = email;
    }
  }

  return { ownerId: email.toLowerCase(), email, name };
}

export function requireRequestIdentity(request: Request): RequestIdentity {
  const identity = getRequestIdentity(request);
  if (!identity) {
    throw new Response("Authentication required", { status: 401 });
  }
  return identity;
}

export function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected error";
  const isSchemaError = message.includes("no such table");
  return Response.json(
    {
      error: isSchemaError
        ? "The database schema is not ready yet. Redeploy the latest version."
        : message,
    },
    { status: isSchemaError ? 503 : 500 },
  );
}
