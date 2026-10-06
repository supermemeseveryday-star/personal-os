import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Personal OS",
    short_name: "Personal OS",
    description: "Tasks, projects, focus, learning and goals in one place. 任务、项目、专注、学习与目标。",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#f8f9fb",
    theme_color: "#ffffff",
    categories: ["productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Shown when long-pressing (mobile) or right-clicking (desktop) the installed app icon.
    shortcuts: [
      {
        name: "New task · 新建任务",
        short_name: "New task",
        url: "/tasks?new=task",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Calendar · 日历",
        short_name: "Calendar",
        url: "/calendar",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Log learning · 记录学习",
        short_name: "Learning",
        url: "/learning?new=learning",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
