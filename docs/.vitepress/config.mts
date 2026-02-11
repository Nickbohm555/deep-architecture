import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Deep Architecture Docs",
  description: "Live documentation for the deep-architecture workspace.",
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Overview", link: "/" },
      { text: "Architecture", link: "/architecture" },
      { text: "API", link: "/api" },
      { text: "Schema", link: "/schema" },
      { text: "Workers", link: "/workers" },
      { text: "Changelog", link: "/changelog" }
    ],
    sidebar: [
      {
        text: "Documentation",
        items: [
          { text: "Overview", link: "/" },
          { text: "Architecture", link: "/architecture" },
          { text: "API", link: "/api" },
          { text: "Schema", link: "/schema" },
          { text: "Workers", link: "/workers" },
          { text: "Changelog", link: "/changelog" }
        ]
      }
    ],
    search: {
      provider: "local"
    }
  }
});
