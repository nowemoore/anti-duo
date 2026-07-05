// The bundled content payload (../public/content.json), typed as the shared Content shape.
declare module '@content' {
  import type { Content } from '@shared/types'
  const content: Content
  export default content
}
