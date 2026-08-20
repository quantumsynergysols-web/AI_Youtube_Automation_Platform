import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import Landing from './pages/Landing'

/**
 * Renders the real Landing component to static HTML for the shareable design
 * review.
 *
 * Exists because the share file was previously hand-converted from the app, and
 * drifted twice — most visibly when a mismatched closing tag silently swallowed
 * the entire nav. Rendering the actual component means the share can only ever
 * be wrong in the same way the product is wrong.
 */
export function render(): string {
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <Landing />
    </StaticRouter>,
  )
}
