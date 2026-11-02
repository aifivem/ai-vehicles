import type { PanelSchema } from "@aifivem/shared";
import { DEFAULT_SPOTS } from "./cleanup/settings";

/** ai-vehicles' panel: what happens to vehicles players leave behind. */
export const schema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "car",
  files: {
    settings: {
      kind: "settings",
      sync: "admin",
      sections: {
        cleanup: { type: "bool" },
        cleanupScope: { type: "enum", values: ["unowned", "all"] },
        abandonMinutes: { type: "number", min: 5, max: 1440, integer: true },
        garageMinutes: { type: "number", min: 1, max: 1440, integer: true },
        scanSeconds: { type: "number", min: 5, max: 120, integer: true },
        ownedTo: { type: "enum", values: ["impound", "garage"] },
        garageSpots: {
          type: "list",
          max: 200,
          of: {
            type: "object",
            fields: {
              garage: {
                type: "text",
                min: 0,
                max: 32,
                pattern: "^[a-z0-9_]*$",
              },
              coords: { type: "vec3" },
              radius: { type: "number", min: 2, max: 100 },
            },
          },
        },
        notifyGarage: { type: "bool" },
        blacklist: { type: "names", lookup: "vehicle", max: 200, itemMax: 32 },
        keepDriven: { type: "bool" },
      },
      defaults: {
        cleanup: true,
        cleanupScope: "all",
        abandonMinutes: 120,
        garageMinutes: 20,
        scanSeconds: 15,
        ownedTo: "impound",
        garageSpots: DEFAULT_SPOTS,
        notifyGarage: true,
        blacklist: [],
        keepDriven: true,
      },
    },
  },
  tabs: [
    {
      id: "cleanup",
      file: "settings",
      icon: "clock",
      label: "ADMIN_TAB_CLEANUP",
      desc: "ADMIN_TAB_CLEANUP_DESC",
      cards: [
        {
          icon: "clock",
          title: "ADMIN_C_CLEANUP",
          desc: "ADMIN_C_CLEANUP_DESC",
          fields: [
            {
              widget: "switch",
              path: "cleanup",
              label: "ADMIN_F_CLEANUP",
              hint: "ADMIN_H_CLEANUP",
            },
            {
              widget: "select",
              path: "cleanupScope",
              label: "ADMIN_F_SCOPE",
              hint: "ADMIN_H_SCOPE",
              options: [
                { value: "all", label: "ADMIN_O_SCOPE_ALL" },
                { value: "unowned", label: "ADMIN_O_SCOPE_UNOWNED" },
              ],
            },
            {
              widget: "number",
              path: "abandonMinutes",
              label: "ADMIN_F_ABANDON",
              hint: "ADMIN_H_ABANDON",
              min: 5,
              max: 1440,
              step: 5,
              unit: "min",
            },
            {
              widget: "select",
              path: "ownedTo",
              label: "ADMIN_F_OWNED_TO",
              hint: "ADMIN_H_OWNED_TO",
              options: [
                { value: "impound", label: "ADMIN_O_IMPOUND" },
                { value: "garage", label: "ADMIN_O_GARAGE" },
              ],
            },
            {
              widget: "number",
              path: "scanSeconds",
              label: "ADMIN_F_SCAN",
              hint: "ADMIN_H_SCAN",
              min: 5,
              max: 120,
              step: 5,
              unit: "s",
            },
          ],
        },
        {
          icon: "square-parking",
          title: "ADMIN_C_SPOTS",
          desc: "ADMIN_C_SPOTS_DESC",
          fields: [
            {
              widget: "number",
              path: "garageMinutes",
              label: "ADMIN_F_GARAGE_MINUTES",
              hint: "ADMIN_H_GARAGE_MINUTES",
              min: 1,
              max: 1440,
              step: 5,
              unit: "min",
            },
            {
              widget: "switch",
              path: "notifyGarage",
              label: "ADMIN_F_NOTIFY",
              hint: "ADMIN_H_NOTIFY",
            },
            {
              widget: "list",
              path: "garageSpots",
              label: "ADMIN_F_SPOTS",
              addLabel: "ADMIN_ADD_SPOT",
              max: 200,
              min: 0,
              search: true,
              wrap: true,
              newRow: { garage: "", coords: { x: 0, y: 0, z: 0 }, radius: 12 },
              rows: [
                {
                  widget: "text",
                  path: "garage",
                  label: "ADMIN_F_SPOT_GARAGE",
                  hint: "ADMIN_H_SPOT_GARAGE",
                  placeholder: "ADMIN_P_SPOT_GARAGE",
                },
                {
                  widget: "point",
                  path: "coords",
                  label: "ADMIN_F_SPOT_COORDS",
                  ground: true,
                },
                {
                  widget: "number",
                  path: "radius",
                  label: "ADMIN_F_SPOT_RADIUS",
                  min: 2,
                  max: 100,
                  unit: "m",
                },
              ],
            },
          ],
        },
        {
          icon: "shield",
          title: "ADMIN_C_KEEP",
          desc: "ADMIN_C_KEEP_DESC",
          fields: [
            {
              widget: "tags",
              path: "blacklist",
              lookup: "vehicle",
              label: "ADMIN_F_BLACKLIST",
              hint: "ADMIN_H_BLACKLIST",
              placeholder: "ADMIN_P_BLACKLIST",
            },
            {
              widget: "switch",
              path: "keepDriven",
              label: "ADMIN_F_KEEP_DRIVEN",
              hint: "ADMIN_H_KEEP_DRIVEN",
            },
          ],
        },
      ],
    },
  ],
};
