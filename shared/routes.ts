import { z } from 'zod';
import { insertPostSchema, insertClientSchema, insertApprovalPostSchema, posts, clients, approvalPosts } from './schema';

/**
 * Standard error response schemas used across all API endpoints.
 */
export const errorSchemas = {
  /** Validation error with an optional field indicator. */
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  /** Resource not found error. */
  notFound: z.object({
    message: z.string(),
  }),
  /** Internal server error. */
  internal: z.object({
    message: z.string(),
  }),
};

/**
 * API route contract definitions.
 * Describes every REST endpoint with its HTTP method, path, input schema, and response schemas.
 * Used for type-safe API consumption on both client and server.
 */
export const api = {
  /** Client management endpoints. */
  clients: {
    /** GET /api/clients - List all clients. */
    list: {
      method: 'GET' as const,
      path: '/api/clients' as const,
      responses: {
        200: z.array(z.custom<typeof clients.$inferSelect>()),
      },
    },
    /** GET /api/clients/:id - Get a single client by ID. */
    get: {
      method: 'GET' as const,
      path: '/api/clients/:id' as const,
      responses: {
        200: z.custom<typeof clients.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    /** POST /api/clients - Create a new client. */
    create: {
      method: 'POST' as const,
      path: '/api/clients' as const,
      input: insertClientSchema,
      responses: {
        201: z.custom<typeof clients.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    /** PUT /api/clients/:id - Update an existing client. */
    update: {
      method: 'PUT' as const,
      path: '/api/clients/:id' as const,
      input: insertClientSchema.partial(),
      responses: {
        200: z.custom<typeof clients.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    /** DELETE /api/clients/:id - Delete a client. */
    delete: {
      method: 'DELETE' as const,
      path: '/api/clients/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  /** Post management endpoints. */
  posts: {
    /** GET /api/posts - List posts with optional search/filter query params. */
    list: {
      method: 'GET' as const,
      path: '/api/posts' as const,
      input: z.object({
        search: z.string().optional(),
        client: z.string().optional(),
        status: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof posts.$inferSelect>()),
      },
    },
    /** GET /api/posts/:id - Get a single post by ID. */
    get: {
      method: 'GET' as const,
      path: '/api/posts/:id' as const,
      responses: {
        200: z.custom<typeof posts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    /** POST /api/posts - Create a new post. */
    create: {
      method: 'POST' as const,
      path: '/api/posts' as const,
      input: insertPostSchema,
      responses: {
        201: z.custom<typeof posts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    /** PUT /api/posts/:id - Update an existing post. */
    update: {
      method: 'PUT' as const,
      path: '/api/posts/:id' as const,
      input: insertPostSchema.partial(),
      responses: {
        200: z.custom<typeof posts.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    /** DELETE /api/posts/:id - Delete a post. */
    delete: {
      method: 'DELETE' as const,
      path: '/api/posts/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  /** Approval post management endpoints. */
  approvals: {
    /** GET /api/approvals - List all approval posts. */
    list: {
      method: 'GET' as const,
      path: '/api/approvals' as const,
      responses: {
        200: z.array(z.custom<typeof approvalPosts.$inferSelect>()),
      },
    },
    /** GET /api/approvals/:id - Get a single approval post by ID. */
    get: {
      method: 'GET' as const,
      path: '/api/approvals/:id' as const,
      responses: {
        200: z.custom<typeof approvalPosts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    /** POST /api/approvals - Create a new approval post. */
    create: {
      method: 'POST' as const,
      path: '/api/approvals' as const,
      input: insertApprovalPostSchema,
      responses: {
        201: z.custom<typeof approvalPosts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    /** PUT /api/approvals/:id - Update an existing approval post. */
    update: {
      method: 'PUT' as const,
      path: '/api/approvals/:id' as const,
      input: insertApprovalPostSchema.partial(),
      responses: {
        200: z.custom<typeof approvalPosts.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    /** DELETE /api/approvals/:id - Delete an approval post. */
    delete: {
      method: 'DELETE' as const,
      path: '/api/approvals/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

/**
 * Builds a URL by replacing path parameters with provided values.
 * @param path - URL path template with :param placeholders (e.g., "/api/clients/:id").
 * @param params - Key-value map of parameter names to their values.
 * @returns The resolved URL string with all placeholders replaced.
 */
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

/** Request type for creating a new post, inferred from the API contract. */
export type CreatePostRequest = z.infer<typeof api.posts.create.input>;
/** Request type for updating a post, inferred from the API contract. */
export type UpdatePostRequest = z.infer<typeof api.posts.update.input>;
/** Request type for creating a new client, inferred from the API contract. */
export type CreateClientRequest = z.infer<typeof api.clients.create.input>;
/** Request type for updating a client, inferred from the API contract. */
export type UpdateClientRequest = z.infer<typeof api.clients.update.input>;
