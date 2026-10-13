import { z, type ZodTypeAny } from "zod";

type JsonSchema = Record<string, unknown>;
type ConversionMode = "generic" | "openai_strict";

function isOptionalSchema(schema: ZodTypeAny): schema is z.ZodOptional<ZodTypeAny> {
  return schema instanceof z.ZodOptional;
}

function isNullableSchema(schema: ZodTypeAny): schema is z.ZodNullable<ZodTypeAny> {
  return schema instanceof z.ZodNullable;
}

function unwrapSchema(
  schema: ZodTypeAny,
): { schema: ZodTypeAny; optional: boolean; nullable: boolean } {
  let current = schema;
  let optional = false;
  let nullable = false;

  while (true) {
    if (isOptionalSchema(current)) {
      optional = true;
      current = current.unwrap();
      continue;
    }
    if (isNullableSchema(current)) {
      nullable = true;
      current = current.unwrap();
      continue;
    }
    return { schema: current, optional, nullable };
  }
}

function applyNullable(
  schema: JsonSchema,
  nullable: boolean,
  mode: ConversionMode,
): JsonSchema {
  if (!nullable) {
    return schema;
  }

  if (mode === "openai_strict") {
    const currentType = schema.type;
    if (Array.isArray(currentType)) {
      return {
        ...schema,
        type: currentType.includes("null") ? currentType : [...currentType, "null"],
      };
    }
    if (typeof currentType === "string") {
      return {
        ...schema,
        type: currentType === "null" ? "null" : [currentType, "null"],
      };
    }
  }

  return {
    anyOf: [schema, { type: "null" }],
  };
}

function mapStringSchema(schema: z.ZodString): JsonSchema {
  const jsonSchema: JsonSchema = {
    type: "string",
  };

  for (const check of schema._def.checks ?? []) {
    switch (check.kind) {
      case "min":
        jsonSchema.minLength = check.value;
        break;
      case "max":
        jsonSchema.maxLength = check.value;
        break;
      case "email":
        jsonSchema.format = "email";
        break;
      case "url":
        jsonSchema.format = "uri";
        break;
      case "uuid":
        jsonSchema.format = "uuid";
        break;
      default:
        break;
    }
  }

  return jsonSchema;
}

function mapNumberSchema(schema: z.ZodNumber): JsonSchema {
  const jsonSchema: JsonSchema = {
    type: "number",
  };

  for (const check of schema._def.checks ?? []) {
    switch (check.kind) {
      case "min":
        if (check.inclusive === false) {
          jsonSchema.exclusiveMinimum = check.value;
        } else {
          jsonSchema.minimum = check.value;
        }
        break;
      case "max":
        if (check.inclusive === false) {
          jsonSchema.exclusiveMaximum = check.value;
        } else {
          jsonSchema.maximum = check.value;
        }
        break;
      case "int":
        jsonSchema.type = "integer";
        break;
      default:
        break;
    }
  }

  return jsonSchema;
}

function mapBooleanSchema(): JsonSchema {
  return { type: "boolean" };
}

function mapEnumSchema(schema: z.ZodEnum<[string, ...string[]]>): JsonSchema {
  return {
    type: "string",
    enum: [...schema._def.values],
  };
}

function mapLiteralSchema(schema: z.ZodLiteral<unknown>): JsonSchema {
  const literalValue = schema._def.value;
  const literalType =
    literalValue === null
      ? "null"
      : Array.isArray(literalValue)
        ? "array"
        : typeof literalValue;

  return {
    ...(literalType ? { type: literalType } : {}),
    const: literalValue,
  };
}

function mapArraySchema(schema: z.ZodArray<ZodTypeAny>, mode: ConversionMode): JsonSchema {
  const jsonSchema: JsonSchema = {
    type: "array",
    items: convertToJsonSchema(schema._def.type, mode),
  };

  if (schema._def.minLength) {
    jsonSchema.minItems = schema._def.minLength.value;
  }
  if (schema._def.maxLength) {
    jsonSchema.maxItems = schema._def.maxLength.value;
  }

  return jsonSchema;
}

function mapObjectSchema(schema: z.AnyZodObject, mode: ConversionMode): JsonSchema {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(schema.shape)) {
    const unwrapped = unwrapSchema(value as ZodTypeAny);
    const shouldBeNullable = unwrapped.nullable || (mode === "openai_strict" && unwrapped.optional);
    properties[key] = applyNullable(
      convertToJsonSchema(unwrapped.schema, mode),
      shouldBeNullable,
      mode,
    );
    if (mode === "openai_strict" || !unwrapped.optional) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    additionalProperties: false,
    required,
  };
}

function mapUnionSchema(
  schema: z.ZodUnion<[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>,
  mode: ConversionMode,
): JsonSchema {
  return {
    anyOf: schema._def.options.map((option) => convertToJsonSchema(option, mode)),
  };
}

function convertToJsonSchema(schema: ZodTypeAny, mode: ConversionMode): JsonSchema {
  const unwrapped = unwrapSchema(schema);
  const baseSchema = unwrapped.schema;
  let jsonSchema: JsonSchema;

  if (baseSchema instanceof z.ZodString) {
    jsonSchema = mapStringSchema(baseSchema);
  } else if (baseSchema instanceof z.ZodNumber) {
    jsonSchema = mapNumberSchema(baseSchema);
  } else if (baseSchema instanceof z.ZodBoolean) {
    jsonSchema = mapBooleanSchema();
  } else if (baseSchema instanceof z.ZodEnum) {
    jsonSchema = mapEnumSchema(
      baseSchema as unknown as z.ZodEnum<[string, ...string[]]>,
    );
  } else if (baseSchema instanceof z.ZodLiteral) {
    jsonSchema = mapLiteralSchema(baseSchema);
  } else if (baseSchema instanceof z.ZodArray) {
    jsonSchema = mapArraySchema(baseSchema, mode);
  } else if (baseSchema instanceof z.ZodObject) {
    jsonSchema = mapObjectSchema(baseSchema, mode);
  } else if (baseSchema instanceof z.ZodUnion) {
    jsonSchema = mapUnionSchema(
      baseSchema as unknown as z.ZodUnion<[ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>,
      mode,
    );
  } else {
    const typeName =
      typeof baseSchema._def?.typeName === "string"
        ? baseSchema._def.typeName
        : "UnknownSchema";
    throw new Error(`Unsupported Zod schema for OpenAI structured output: ${typeName}`);
  }

  return applyNullable(jsonSchema, unwrapped.nullable, mode);
}

export function zodSchemaToJsonSchema(schema: ZodTypeAny): JsonSchema {
  return convertToJsonSchema(schema, "generic");
}

export function zodSchemaToOpenAIStrictJsonSchema(schema: ZodTypeAny): JsonSchema {
  return convertToJsonSchema(schema, "openai_strict");
}

export function normalizeOpenAIStructuredOutput<T>(
  schema: ZodTypeAny,
  value: T,
): T {
  return normalizeValueForSchema(schema, value) as T;
}

function normalizeValueForSchema(schema: ZodTypeAny, value: unknown): unknown {
  const unwrapped = unwrapSchema(schema);
  const baseSchema = unwrapped.schema;

  if (value === null) {
    if (unwrapped.nullable) {
      return null;
    }
    if (unwrapped.optional) {
      return undefined;
    }
    return value;
  }

  if (value === undefined) {
    return value;
  }

  if (baseSchema instanceof z.ZodObject) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }

    const normalizedObject = { ...(value as Record<string, unknown>) };

    for (const [key, childSchema] of Object.entries(baseSchema.shape)) {
      const normalizedChild = normalizeValueForSchema(
        childSchema as ZodTypeAny,
        normalizedObject[key],
      );

      if (normalizedChild === undefined) {
        delete normalizedObject[key];
      } else {
        normalizedObject[key] = normalizedChild;
      }
    }

    return normalizedObject;
  }

  if (baseSchema instanceof z.ZodArray) {
    if (!Array.isArray(value)) {
      return value;
    }

    return value.map((item) => normalizeValueForSchema(baseSchema._def.type, item));
  }

  return value;
}
