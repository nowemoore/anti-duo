import { createContext, useContext } from 'react'

/**
 * How tall the floating tab bar is, measured by the app shell.
 *
 * The bar overlays the content rather than sitting in the column below it, so anything that reaches
 * the bottom of the screen has to account for it: a card ends above the bar, while a long scroll
 * runs underneath it and pads its content instead — which is what makes the glass worth having.
 */
export const TabBarContext = createContext(0)

export const useTabBarHeight = () => useContext(TabBarContext)
