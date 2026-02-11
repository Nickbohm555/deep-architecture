const GITHUB_HTTPS_PREFIX = "https://github.com/";

export function isSupportedRepoUrl(repoUrl: string) {
  return repoUrl.startsWith(GITHUB_HTTPS_PREFIX);
}

export function getRepoName(repoUrl: string) {
  const trimmed = repoUrl.replace(/\.git$/, "").split("/");
  return trimmed[trimmed.length - 1] || "unknown";
}
