import { createPortal } from 'react-dom'

export default function ModalScrim(props) {
  // Put the backdrop above the entire CRM, outside animated and scrolling sections.
  const target = document.getElementById('crm-app') || document.body
  return createPortal(<div {...props} />, target)
}
