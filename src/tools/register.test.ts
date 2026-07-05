import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { extractInputSchema } from "./register";

describe("extractInputSchema", () => {
  it("extracts body sub-schema from envelope { body, path, query }", () => {
    const envelope = z.object({
      body: z.object({ name: z.string(), age: z.number().optional() }),
      path: z.object({ id: z.string() }),
      query: z.object({ page: z.number().optional() }),
    });
    const shape = extractInputSchema(envelope);
    expect(shape).toHaveProperty("name");
    expect(shape).toHaveProperty("age");
    expect(shape).not.toHaveProperty("id");
    expect(shape).not.toHaveProperty("page");
  });

  it("extracts shape from flat z.object (no body key)", () => {
    const flat = z.object({ foo: z.string(), bar: z.number() });
    const shape = extractInputSchema(flat);
    expect(shape).toHaveProperty("foo");
    expect(shape).toHaveProperty("bar");
  });

  it("returns empty object for z.record", () => {
    const record = z.record(z.string(), z.never());
    const shape = extractInputSchema(record);
    expect(Object.keys(shape)).toHaveLength(0);
  });

  it("returns empty object for z.unknown", () => {
    const unknown = z.unknown();
    const shape = extractInputSchema(unknown);
    expect(Object.keys(shape)).toHaveLength(0);
  });

  it("replaces bigint fields with z.number().optional()", () => {
    const schema = z.object({
      count: z.bigint(),
      label: z.string(),
      maybeBig: z.bigint().optional(),
    });
    const shape = extractInputSchema(schema);
    const countDef = (shape.count as z.ZodTypeAny)._zod.def;
    expect(countDef.type).toBe("optional");
    const labelDef = (shape.label as z.ZodTypeAny)._zod.def;
    expect(labelDef.type).toBe("string");
  });
});
