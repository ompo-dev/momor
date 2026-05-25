import { useEffect, useState } from "react"

export type ShadcnTheme = "light" | "dark"

export function useShadcnTheme(): ShadcnTheme {
  const [theme, setTheme] = useState<ShadcnTheme>(() => {
    const attr = document.documentElement.getAttribute("data-theme")
    return attr === "light" ? "light" : "dark"
  })

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const attr = document.documentElement.getAttribute("data-theme")
      setTheme(attr === "light" ? "light" : "dark")
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })
    return () => observer.disconnect()
  }, [])

  return theme
}
