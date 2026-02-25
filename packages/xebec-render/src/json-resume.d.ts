// Re-export types from json-resume-types package
export * from "json-resume-types";

// Keep the @jsonresume/schema module declaration for compatibility
declare module "@jsonresume/schema" {
  const schema: any;
  export default schema;
}
