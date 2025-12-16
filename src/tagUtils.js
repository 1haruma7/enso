export function parseTags(value) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
          .map((tag) => tag.replace(/^#+/, ""))
          .filter(Boolean)
      )
    );
  }

  if (typeof value !== "string") {
    return [];
  }

  const hashtagMatches = value.match(/#[^\s#,、\n]+/g);
  if (hashtagMatches && hashtagMatches.length > 0) {
    return Array.from(
      new Set(
        hashtagMatches
          .map((tag) => tag.trim().replace(/^#+/, ""))
          .filter(Boolean)
      )
    );
  }

  return Array.from(
    new Set(
      value
        .replace(/[,\uFF0C、\n]+/g, " ")
        .split(/\s+/g)
        .map((tag) => tag.trim().replace(/^#+/, ""))
        .filter(Boolean)
    )
  );
}
