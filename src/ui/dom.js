/**
 * Crea un elemento HTML. Las propiedades especiales son: class, text y los eventos (onclick,
 * onsubmit, ...); el resto se escribe como atributo. Los hijos pueden ser texto o nodos.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(
    ...children.flat().filter((child) => child !== null && child !== undefined && child !== false),
  );
  return node;
}
