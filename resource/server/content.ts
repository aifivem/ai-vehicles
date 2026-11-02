import { AdminPanel } from "@aifivem/lib/server";
import { readCleanupSettings } from "./cleanup/settings";
import { schema } from "./schema";

export const panel = new AdminPanel(schema);
export const cleanupSettings = panel.view("settings", readCleanupSettings);
