import type { Theme } from "@blocknote/mantine";

// Maps BlockNote's editor/menu/tooltip colors onto Momor's Zed-derived tokens
// (values mirror src/index.css). Passed to <BlockNoteView theme={...}> so the
// inline editor AND the portaled slash/side menus match the app theme.

export const momorDarkTheme: Theme = {
  colors: {
    editor: {
      text: "#dce0e5",
      background: "transparent", // blend into the content pane (bg-background)
    },
    menu: {
      text: "#dce0e5",
      background: "#3b414d", // --bg-elevated
    },
    tooltip: {
      text: "#a9afbc",
      background: "#363c46",
    },
    hovered: {
      text: "#dce0e5",
      background: "#454a56", // --bg-toggle-switch (row hover)
    },
    selected: {
      text: "#ffffff",
      background: "#74ade8", // --accent-primary
    },
    disabled: {
      text: "#878a98",
      background: "#2f343e",
    },
    shadow: "rgba(0, 0, 0, 0.4)",
    border: "#363c46", // --border-subtle (dark)
    sideMenu: "#878a98", // --text-tertiary (drag handle / +)
  },
  borderRadius: 6,
  fontFamily: "inherit",
};

export const momorLightTheme: Theme = {
  colors: {
    editor: {
      text: "#242529",
      background: "transparent",
    },
    menu: {
      text: "#242529",
      background: "#ffffff", // --bg-elevated (light)
    },
    tooltip: {
      text: "#ffffff",
      background: "#242529",
    },
    hovered: {
      text: "#242529",
      background: "#ebebec", // --bg-component
    },
    selected: {
      text: "#ffffff",
      background: "#5c78e2", // --accent-primary (light)
    },
    disabled: {
      text: "#7e8086",
      background: "#ebebec",
    },
    shadow: "rgba(0, 0, 0, 0.12)",
    border: "#dfdfe0", // --border-subtle (light)
    sideMenu: "#7e8086",
  },
  borderRadius: 6,
  fontFamily: "inherit",
};
