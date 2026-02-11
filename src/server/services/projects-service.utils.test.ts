import { describe, expect, it } from "vitest";
import { getRepoName, isSupportedRepoUrl } from "./projects-service.utils";

describe("projects-service utils", () => {
  it("accepts github https urls", () => {
    expect(isSupportedRepoUrl("https://github.com/org/repo")).toBe(true);
  });

  it("rejects non-github or non-https urls", () => {
    expect(isSupportedRepoUrl("http://github.com/org/repo")).toBe(false);
    expect(isSupportedRepoUrl("https://gitlab.com/org/repo")).toBe(false);
    expect(isSupportedRepoUrl("git@github.com:org/repo.git")).toBe(false);
  });

  it("extracts repo name with or without .git", () => {
    expect(getRepoName("https://github.com/org/deep-architecture")).toBe("deep-architecture");
    expect(getRepoName("https://github.com/org/deep-architecture.git")).toBe("deep-architecture");
  });
});
