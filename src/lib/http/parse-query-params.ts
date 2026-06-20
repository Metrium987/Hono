/**
 * Typed query-parameter parser.
 *
 * Replaces the previous loosely-typed Record<string, unknown> helper. The schema
 * argument drives both runtime coercion and the returned type, so callers get
 * strong typing without casts.
 */

export type ParamType = "string" | "number" | "boolean";

export interface ParamSpec {
  type: ParamType;
  required?: boolean;
  default?: string | number | boolean;
}

export type Schema = Record<string, ParamSpec>;

export type ParsedValue<S extends ParamSpec> =
  S["type"] extends "number" ? number :
  S["type"] extends "boolean" ? boolean :
  string;

export type ParsedQuery<S extends Schema> = {
  [K in keyof S]: ParsedValue<S[K]>;
};

type SearchParams = Record<string, string | string[] | undefined>;

export function parseQueryParams<S extends Schema>(
  searchParams: SearchParams,
  schema: S
): ParsedQuery<S> {
  const result = {} as Record<keyof S, string | number | boolean>;

  for (const [key, spec] of Object.entries(schema) as [keyof S & string, ParamSpec][]) {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;

    if (value === undefined || value === null || value === "") {
      if (spec.required) throw new Error(`Missing required query param: ${key}`);
      result[key] = (spec.default ?? null) as string | number | boolean;
      continue;
    }

    if (spec.type === "number") {
      const n = Number(value);
      if (Number.isNaN(n)) throw new Error(`Invalid number for ${key}: ${value}`);
      result[key] = n;
    } else if (spec.type === "boolean") {
      result[key] = value === "true" || value === "1";
    } else {
      result[key] = value;
    }
  }

  return result as ParsedQuery<S>;
}
