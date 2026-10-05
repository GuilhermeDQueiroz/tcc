// Observe mounted/reused content and Vue's teleported dialogs. LoadingState emits
// completion after its minimum duration and fade, so entrance never runs behind it.
export function installEntranceEffects(root: HTMLElement) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const selector = '.sidebar,.app-header,.analytics-page > nav,.filter-chips,.context-controls,.search-panel,.metric-card,.backlog-combined,.analysis-frame,.calendar-grid > *,tbody > tr,.order-search-form,.order-local-filters > label,.analysis-config,.filter-drawer,.filter-tab-panel,[role="dialog"]'
  const animations = new WeakMap<Element, Animation>()
  const queued = new Set<Element>()
  let frame = 0
  const blocked = (element: Element) => {
    const local = element.closest('.analysis-frame,.filter-drawer,[role="dialog"]')
    return Boolean(document.querySelector('.loading-screen') || element.closest('[aria-busy="true"],.loading-state') || local?.querySelector('.loading-state'))
  }
  const reveal = (element: Element, delay = 0) => {
    if (!element.isConnected || blocked(element)) return
    intersection.unobserve(element)
    if(animations.get(element)?.playState==='running')return
    animations.get(element)?.cancel()
    // Fixed overlays and row geometry stay steady; only their opacity animates.
    const fadeOnly = reduced.matches || element.matches('.sidebar,.app-header,.analysis-config,.analysis-expanded,[role="dialog"],tbody > tr') || Boolean(element.closest('.analysis-frame,.filter-drawer,[role="dialog"]') && !element.matches('.analysis-frame,.filter-drawer,[role="dialog"]'))
    const animation = element.animate(fadeOnly ? [{opacity:0},{opacity:1}] : [{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}], {duration:element.matches('.metric-card,.backlog-combined') ? 850 : 700,delay,fill:'backwards',easing:'cubic-bezier(0.22,0.61,0.36,1)'})
    animations.set(element,animation)
  }
  const intersection = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) reveal(entry.target)
  }, { threshold: 0.04 })
  const register = (node: Element, replay = false) => {
    if (replay) node.querySelectorAll('[data-loading-reveal]').forEach(element=>element.removeAttribute('data-loading-reveal'))
    const elements = [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)]
    let cardIndex=0
    for (const element of elements) {
      if (!replay && element.hasAttribute('data-entrance')) continue
      element.setAttribute('data-entrance','ready')
      // Let the browser report rows visible inside each scroll area. Measuring
      // every off-screen row here forces layout across the entire dashboard.
      if(element.matches('tbody > tr')){
        if(replay)intersection.unobserve(element)
        intersection.observe(element)
        continue
      }
      const rect = element.getBoundingClientRect()
      if (rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth) {
        const isCard=element.matches('.metric-card,.backlog-combined')
        reveal(element,isCard ? Math.min(cardIndex++*35,210) : 0)
      }
      else intersection.observe(element)
    }
  }
  const schedule = (scope: Element) => {
    queued.add(scope)
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const scopes = [...queued];queued.clear()
      for (const scope of scopes) if (!scopes.some(other => other !== scope && other.contains(scope)) && !blocked(scope)) register(scope,true)
    })
  }
  const ready = (event: Event) => {
    const scope = (event as CustomEvent<Element>).detail
    if (scope instanceof Element) schedule(scope)
  }
  // Hold the data behind the exiting curtain, so it cannot appear at full opacity
  // and then disappear again when its entrance starts. Never hide the loader itself.
  const prepare = (event: Event) => {
    const scope = (event as CustomEvent<Element>).detail
    if (!(scope instanceof Element)) return
    scope.querySelectorAll('.metric-card,.backlog-combined,.chart-host,.table-scroll,.table-footer,.calendar-grid,.filter-tab-panel').forEach(element=>{
      if (!element.querySelector('.loading-state')) element.setAttribute('data-loading-reveal','waiting')
    })
  }
  register(root)
  const mutations = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.oldValue === 'true' && (record.target as Element).getAttribute('aria-busy') !== 'true') schedule(record.target as Element)
        continue
      }
      for (const node of record.addedNodes) if (node instanceof Element) register(node)
      for (const node of record.removedNodes) if (node instanceof Element) {
        intersection.unobserve(node)
        node.querySelectorAll('[data-entrance]').forEach(element => intersection.unobserve(element))
      }
      const target = record.target instanceof Element ? record.target : record.target.parentElement
      if (!target || target.closest('.loading-state,.analysis-config,[role="tooltip"]')) continue
      // Local sorting, pagination and metric/view changes replay only their analysis.
      const scope = target.closest('.analysis-frame,.metric-card,.backlog-combined,.context-controls')
      if (scope) schedule(scope)
    }
  })
  mutations.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'], attributeOldValue: true })
  window.addEventListener('dashboard:content-ready',ready)
  window.addEventListener('dashboard:content-will-reveal',prepare)
  window.addEventListener('pagehide', () => { mutations.disconnect(); intersection.disconnect(); cancelAnimationFrame(frame);window.removeEventListener('dashboard:content-ready',ready);window.removeEventListener('dashboard:content-will-reveal',prepare) }, { once: true })
}
