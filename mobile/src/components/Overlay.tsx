import { createContext, useContext, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

// A lightweight "portal": render a floating node (e.g. a gloss bubble) in a full-screen layer above
// everything. The layer is pointer-transparent (box-none) so touches still reach the content beneath
// — important because the gloss bubble shows while you keep holding the word underneath it.
interface OverlayApi {
  show: (node: ReactNode) => void
  hide: () => void
}

const OverlayCtx = createContext<OverlayApi | null>(null)

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null)
  return (
    <OverlayCtx.Provider value={{ show: setNode, hide: () => setNode(null) }}>
      {children}
      {node != null && (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {node}
        </View>
      )}
    </OverlayCtx.Provider>
  )
}

export function useOverlay(): OverlayApi {
  const value = useContext(OverlayCtx)
  if (!value) throw new Error('useOverlay must be used within OverlayProvider')
  return value
}
